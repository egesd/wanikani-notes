import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(import.meta.dirname, '../../../data');
const DB_PATH = path.join(DB_DIR, 'notes.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      word TEXT PRIMARY KEY,
      note_text TEXT NOT NULL,
      synonyms TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

export interface CachedNote {
  word: string;
  note_text: string;
  synonyms: string[];
  created_at: string;
}

export function getCachedNote(word: string): CachedNote | undefined {
  const row = getDb()
    .prepare('SELECT word, note_text, synonyms, created_at FROM notes WHERE word = ?')
    .get(word) as { word: string; note_text: string; synonyms: string; created_at: string } | undefined;

  if (!row) return undefined;

  return {
    word: row.word,
    note_text: row.note_text,
    synonyms: JSON.parse(row.synonyms),
    created_at: row.created_at,
  };
}

export function setCachedNote(word: string, noteText: string, synonyms: string[]): void {
  getDb()
    .prepare(
      'INSERT OR REPLACE INTO notes (word, note_text, synonyms, created_at) VALUES (?, ?, ?, datetime(\'now\'))',
    )
    .run(word, noteText, JSON.stringify(synonyms));
}

export function deleteCachedNote(word: string): void {
  getDb().prepare('DELETE FROM notes WHERE word = ?').run(word);
}

/** For testing: initialize with an in-memory database. */
export function initTestDb(): void {
  db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      word TEXT PRIMARY KEY,
      note_text TEXT NOT NULL,
      synonyms TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/** For testing: close and reset the database. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
