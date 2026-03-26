/**
 * Batch pre-generation script.
 *
 * Fetches all WaniKani vocabulary subjects, looks up lexical + sentence data
 * for each, builds prompts, and submits to OpenAI's Batch API.
 *
 * Usage:
 *   WANIKANI_TOKEN=... OPENAI_API_KEY=... npx tsx scripts/batch-generate.ts
 *
 * Steps:
 *   1. Fetch all vocabulary subjects from WaniKani (paginated)
 *   2. For each word: fetch lexical + sentence data, build prompt
 *   3. Write JSONL batch file
 *   4. Upload to OpenAI Batch API
 *   5. Poll for completion
 *   6. Parse results and insert into SQLite
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Database from 'better-sqlite3';

// Load .env from project root
dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });
import { SYSTEM_PROMPT, buildPrompt, type PromptInput } from '../src/services/promptBuilder.js';
import { fetchLexical, findBestEntry } from '../src/services/lexicalService.js';
import { fetchSentences, rankSentences } from '../src/services/sentenceService.js';
import { findCompareCandidateAsync } from '../src/services/compareWordService.js';
import type { WKSubject, WKMeaning, LexicalEntry } from '../../shared/types.js';

const WK_TOKEN = process.env.WANIKANI_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!WK_TOKEN) {
  console.error('Missing WANIKANI_TOKEN env var');
  process.exit(1);
}
if (!OPENAI_KEY) {
  console.error('Missing OPENAI_API_KEY env var');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

const WK_BASE = 'https://api.wanikani.com/v2';
const WK_HEADERS = {
  Authorization: `Bearer ${WK_TOKEN}`,
  'Wanikani-Revision': '20170710',
};

const DB_DIR = path.resolve(import.meta.dirname, '../../data');
const DB_PATH = path.join(DB_DIR, 'notes.db');
const JSONL_PATH = path.join(DB_DIR, 'batch-input.jsonl');

// ── Step 1: Fetch all vocabulary subjects ──

async function fetchAllSubjects(): Promise<WKSubject[]> {
  const subjects: WKSubject[] = [];
  let url: string | null =
    `${WK_BASE}/subjects?types=vocabulary,kana_vocabulary`;

  console.log('Fetching all WaniKani vocabulary subjects...');

  while (url) {
    const res: Response = await fetch(url, { headers: WK_HEADERS });
    if (!res.ok) throw new Error(`WaniKani API error: ${res.status}`);
    const json: any = await res.json();
    subjects.push(...(json.data as WKSubject[]));
    url = json.pages?.next_url ?? null;
    process.stdout.write(`\r  Fetched ${subjects.length} subjects...`);
  }

  console.log(`\n  Total: ${subjects.length} subjects`);
  return subjects;
}

// ── Step 2: Build prompts ──

function sanitizeEntry(e: LexicalEntry): LexicalEntry {
  const strs = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  return {
    ...e,
    glosses: strs(e.glosses),
    partsOfSpeech: strs(e.partsOfSpeech),
    tags: strs(e.tags),
    info: strs(e.info),
    seeAlso: strs(e.seeAlso),
    fields: strs(e.fields),
    antonyms: strs(e.antonyms),
  };
}

async function buildPromptForSubject(
  subject: WKSubject,
): Promise<{ prompt: string; synonyms: string[] } | null> {
  const word = subject.data.characters;

  try {
    const [lexicalRaw, sentencesRaw] = await Promise.all([
      fetchLexical(word),
      fetchSentences(word),
    ]);

    const lexical = lexicalRaw.map(sanitizeEntry);
    const entry = findBestEntry(word, lexical);
    const ranked = rankSentences(sentencesRaw, word);
    const compare = entry
      ? await findCompareCandidateAsync(entry, lexical)
      : undefined;

    const input: PromptInput = {
      subject,
      entry,
      sentences: ranked.slice(0, 5),
      compare,
    };

    // Extract synonyms from entry glosses (reuse logic from noteComposer)
    const primaryMeaning =
      subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
    const synonyms = entry
      ? entry.glosses
          .filter((g: string) => g.toLowerCase() !== primaryMeaning.toLowerCase())
          .slice(0, 4)
      : [];

    return { prompt: buildPrompt(input), synonyms };
  } catch (err) {
    console.warn(`  Skipping ${word}: ${err instanceof Error ? err.message : 'unknown error'}`);
    return null;
  }
}

// ── Step 3: Write JSONL ──

interface BatchLine {
  custom_id: string;
  method: string;
  url: string;
  body: {
    model: string;
    messages: { role: string; content: string }[];
    temperature: number;
    max_completion_tokens: number;
  };
}

function writeBatchJsonl(
  items: { word: string; prompt: string }[],
): void {
  const lines = items.map((item): BatchLine => ({
    custom_id: item.word,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model: 'gpt-5.4-nano',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: item.prompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
    },
  }));

  fs.writeFileSync(
    JSONL_PATH,
    lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
  );

  console.log(`Wrote ${lines.length} requests to ${JSONL_PATH}`);
}

// ── Step 4: Submit batch ──

async function submitBatch(): Promise<string> {
  console.log('Uploading batch file to OpenAI...');

  const file = await openai.files.create({
    file: fs.createReadStream(JSONL_PATH),
    purpose: 'batch',
  });

  console.log(`  File uploaded: ${file.id}`);

  const batch = await openai.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
  });

  console.log(`  Batch created: ${batch.id}`);
  return batch.id;
}

// ── Step 5: Poll for completion ──

async function waitForBatch(batchId: string): Promise<OpenAI.Batches.Batch> {
  console.log('Waiting for batch completion...');

  while (true) {
    const batch = await openai.batches.retrieve(batchId);
    const status = batch.status;

    process.stdout.write(
      `\r  Status: ${status} (${batch.request_counts?.completed ?? 0}/${batch.request_counts?.total ?? '?'} completed)  `,
    );

    if (status === 'completed') {
      console.log('\n  Batch completed!');
      return batch;
    }

    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      throw new Error(`Batch ${status}: ${JSON.stringify(batch.errors)}`);
    }

    // Poll every 30 seconds
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

// ── Step 6: Parse results and insert into DB ──

async function processResults(
  batch: OpenAI.Batches.Batch,
  synonymsMap: Map<string, string[]>,
): Promise<void> {
  if (!batch.output_file_id) {
    throw new Error('No output file in completed batch');
  }

  console.log('Downloading results...');
  const response = await openai.files.content(batch.output_file_id);
  const text = await response.text();
  const lines = text.trim().split('\n');

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

  let success = 0;
  let failed = 0;

  const insertMany = db.transaction(() => {
    for (const line of lines) {
      const result = JSON.parse(line);
      const word = result.custom_id;
      const content =
        result.response?.body?.choices?.[0]?.message?.content?.trim();

      if (content) {
        const synonyms = synonymsMap.get(word) ?? [];
        insert.run(word, content, JSON.stringify(synonyms));
        success++;
      } else {
        console.warn(`  No content for ${word}`);
        failed++;
      }
    }
  });

  insertMany();
  db.close();

  console.log(`Inserted ${success} notes (${failed} failed)`);
}

// ── Main ──

async function main(): Promise<void> {
  // Step 1
  const subjects = await fetchAllSubjects();

  // Step 2: Build prompts (parallel batches for speed)
  console.log('Building prompts (fetching lexical + sentence data)...');
  const batchItems: { word: string; prompt: string }[] = [];
  const synonymsMap = new Map<string, string[]>();
  let skipped = 0;

  const CONCURRENCY = 10;
  for (let i = 0; i < subjects.length; i += CONCURRENCY) {
    const chunk = subjects.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      chunk.map((subject) => buildPromptForSubject(subject)),
    );

    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      const word = chunk[j].data.characters;
      if (r.status === 'fulfilled' && r.value) {
        batchItems.push({ word, prompt: r.value.prompt });
        synonymsMap.set(word, r.value.synonyms);
      } else {
        skipped++;
      }
    }

    process.stdout.write(
      `\r  [${Math.min(i + CONCURRENCY, subjects.length)}/${subjects.length}] (${batchItems.length} built, ${skipped} skipped)    `,
    );

    // Brief pause between batches to be polite to APIs
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `\n  Built ${batchItems.length} prompts (${skipped} skipped)`,
  );

  // Step 3
  fs.mkdirSync(DB_DIR, { recursive: true });
  writeBatchJsonl(batchItems);

  // Step 4
  const batchId = await submitBatch();

  // Step 5
  const completedBatch = await waitForBatch(batchId);

  // Step 6
  await processResults(completedBatch, synonymsMap);

  console.log('Done!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
