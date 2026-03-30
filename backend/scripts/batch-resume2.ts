/**
 * Resume from chunk 3+: reads JSONL, skips words already in DB,
 * submits remaining in chunks.
 *
 * Usage:
 *   cd backend && caffeinate -i npx tsx scripts/batch-resume2.ts 2>&1 | tee ../data/batch-resume2.log
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Database from 'better-sqlite3';

dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) { console.error('Missing OPENAI_API_KEY'); process.exit(1); }

const openai = new OpenAI({ apiKey: OPENAI_KEY.replace(/[^\x20-\x7E]/g, '').trim() });

const DB_DIR = path.resolve(import.meta.dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'notes.db');
const JSONL_PATH = path.join(DB_DIR, 'batch-input.jsonl');

// Open DB and find which words we already have
fs.mkdirSync(DB_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    word TEXT PRIMARY KEY,
    note_text TEXT NOT NULL,
    synonyms TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

const existingWords = new Set(
  (db.prepare('SELECT word FROM notes').all() as { word: string }[]).map((r) => r.word),
);
console.log(`DB already has ${existingWords.size} notes`);

// Read JSONL and filter out already-completed words
const allLines = fs.readFileSync(JSONL_PATH, 'utf-8').trim().split('\n');
const remaining = allLines.filter((line) => {
  const parsed = JSON.parse(line);
  return !existingWords.has(parsed.custom_id);
});
console.log(`${remaining.length} remaining out of ${allLines.length} total`);

if (remaining.length === 0) {
  console.log('Nothing to do!');
  db.close();
  process.exit(0);
}

// Also check if there are in-progress batches we can retrieve
console.log('\nChecking for existing in-progress/completed batches...');
const batches = await openai.batches.list({ limit: 10 });
for (const b of batches.data) {
  if (b.status === 'completed' && b.output_file_id) {
    console.log(`  Found completed batch ${b.id} — downloading results...`);
    const response = await openai.files.content(b.output_file_id);
    const text = await response.text();
    const resultLines = text.trim().split('\n');
    let inserted = 0;
    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO notes (word, note_text, synonyms, created_at) VALUES (?, ?, ?, datetime('now'))",
    );
    const tx = db.transaction(() => {
      for (const line of resultLines) {
        const result = JSON.parse(line);
        const word = result.custom_id;
        const content = result.response?.body?.choices?.[0]?.message?.content?.trim();
        if (content && !existingWords.has(word)) {
          insertStmt.run(word, content, '[]');
          existingWords.add(word);
          inserted++;
        }
      }
    });
    tx();
    console.log(`  Inserted ${inserted} new notes from batch ${b.id}`);
  }
}

// Recalculate remaining
const stillRemaining = allLines.filter((line) => {
  const parsed = JSON.parse(line);
  return !existingWords.has(parsed.custom_id);
});
console.log(`\n${stillRemaining.length} still remaining after recovering completed batches`);

if (stillRemaining.length === 0) {
  console.log('All done!');
  db.close();
  process.exit(0);
}

// Submit remaining in chunks
const CHUNK_SIZE = 750;
const chunks: string[][] = [];
for (let i = 0; i < stillRemaining.length; i += CHUNK_SIZE) {
  chunks.push(stillRemaining.slice(i, i + CHUNK_SIZE));
}
console.log(`Submitting ${chunks.length} chunk(s)...`);

const insert = db.prepare(
  "INSERT OR REPLACE INTO notes (word, note_text, synonyms, created_at) VALUES (?, ?, ?, datetime('now'))",
);

let totalSuccess = 0;
let totalFailed = 0;

for (let c = 0; c < chunks.length; c++) {
  const chunk = chunks[c];
  console.log(`\n── Chunk ${c + 1}/${chunks.length} (${chunk.length} requests) ──`);

  const chunkPath = path.join(DB_DIR, `batch-chunk-${c}.jsonl`);
  fs.writeFileSync(chunkPath, chunk.join('\n') + '\n');

  console.log('  Uploading...');
  const file = await openai.files.create({
    file: fs.createReadStream(chunkPath),
    purpose: 'batch',
  });
  console.log(`  File: ${file.id}`);

  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });
  console.log(`  Batch: ${batch.id}`);

  console.log('  Waiting...');
  let completed: OpenAI.Batches.Batch | undefined;
  while (true) {
    try {
      const status = await openai.batches.retrieve(batch.id);
      process.stdout.write(
        `\r  Status: ${status.status} (${status.request_counts?.completed ?? 0}/${status.request_counts?.total ?? '?'})    `,
      );

      if (status.status === 'completed') {
        console.log('\n  Done!');
        completed = status;
        break;
      }
      if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'expired') {
        console.error(`\n  Batch ${status.status}: ${JSON.stringify(status.errors)}`);
        totalFailed += chunk.length;
        break;
      }
    } catch (err: any) {
      console.warn(`\n  Poll error (retrying in 60s): ${err.message}`);
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }

  if (completed?.output_file_id) {
    const response = await openai.files.content(completed.output_file_id);
    const text = await response.text();
    const resultLines = text.trim().split('\n');

    const insertChunk = db.transaction(() => {
      for (const line of resultLines) {
        const result = JSON.parse(line);
        const word = result.custom_id;
        const content = result.response?.body?.choices?.[0]?.message?.content?.trim();
        if (content) {
          insert.run(word, content, '[]');
          totalSuccess++;
        } else {
          console.warn(`  No content for ${word}`);
          totalFailed++;
        }
      }
    });
    insertChunk();
  }

  fs.unlinkSync(chunkPath);
}

db.close();
console.log(`\nAll done! ${totalSuccess} new notes inserted, ${totalFailed} failed.`);
console.log(`Total in DB: ${existingWords.size + totalSuccess}`);
