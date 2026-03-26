/**
 * Resume script: reads the existing batch-input.jsonl, splits into chunks
 * under the 2M token limit, and submits them sequentially.
 *
 * Usage:
 *   cd backend && caffeinate -i npx tsx scripts/batch-resume.ts 2>&1 | tee ../data/batch-resume.log
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

// Read the full JSONL
const allLines = fs.readFileSync(JSONL_PATH, 'utf-8').trim().split('\n');
console.log(`Loaded ${allLines.length} requests from ${JSONL_PATH}`);

// Build synonyms map from the JSONL custom_ids (synonyms are stored separately)
// We'll insert with empty synonyms since the main script stored them in memory
// The synonyms were in the main script's memory — we'll just use empty arrays

// Split into chunks of ~2000 requests (~300 tokens each = ~600K tokens per chunk, well under 2M)
const CHUNK_SIZE = 2000;
const chunks: string[][] = [];
for (let i = 0; i < allLines.length; i += CHUNK_SIZE) {
  chunks.push(allLines.slice(i, i + CHUNK_SIZE));
}
console.log(`Split into ${chunks.length} chunks of up to ${CHUNK_SIZE} requests`);

// Submit and process each chunk
let totalSuccess = 0;
let totalFailed = 0;

// Prepare DB
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
const insert = db.prepare(
  "INSERT OR REPLACE INTO notes (word, note_text, synonyms, created_at) VALUES (?, ?, ?, datetime('now'))",
);

for (let c = 0; c < chunks.length; c++) {
  const chunk = chunks[c];
  console.log(`\n── Chunk ${c + 1}/${chunks.length} (${chunk.length} requests) ──`);

  // Write chunk to temp file
  const chunkPath = path.join(DB_DIR, `batch-chunk-${c}.jsonl`);
  fs.writeFileSync(chunkPath, chunk.join('\n') + '\n');

  // Upload
  console.log('  Uploading...');
  const file = await openai.files.create({
    file: fs.createReadStream(chunkPath),
    purpose: 'batch',
  });
  console.log(`  File: ${file.id}`);

  // Submit
  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });
  console.log(`  Batch: ${batch.id}`);

  // Poll
  console.log('  Waiting...');
  let completed: OpenAI.Batches.Batch;
  while (true) {
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
    await new Promise((r) => setTimeout(r, 30_000));
  }

  // Process results
  if (completed!.output_file_id) {
    const response = await openai.files.content(completed!.output_file_id);
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

  // Clean up chunk file
  fs.unlinkSync(chunkPath);
}

db.close();
console.log(`\nAll done! ${totalSuccess} inserted, ${totalFailed} failed.`);
