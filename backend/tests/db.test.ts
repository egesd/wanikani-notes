import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCachedNote, setCachedNote, deleteCachedNote, initTestDb, closeDb } from '../src/services/db.js';

describe('db service', () => {
  beforeEach(() => {
    initTestDb();
  });

  afterEach(() => {
    closeDb();
  });

  it('returns undefined for missing word', () => {
    expect(getCachedNote('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves a note', () => {
    setCachedNote('捕獲', 'Test note text', ['seizure', 'catching']);
    const cached = getCachedNote('捕獲');
    expect(cached).toBeDefined();
    expect(cached!.word).toBe('捕獲');
    expect(cached!.note_text).toBe('Test note text');
    expect(cached!.synonyms).toEqual(['seizure', 'catching']);
  });

  it('overwrites existing note on re-insert', () => {
    setCachedNote('捕獲', 'Version 1', []);
    setCachedNote('捕獲', 'Version 2', ['new']);
    const cached = getCachedNote('捕獲');
    expect(cached!.note_text).toBe('Version 2');
    expect(cached!.synonyms).toEqual(['new']);
  });

  it('deletes a cached note', () => {
    setCachedNote('捕獲', 'To delete', []);
    deleteCachedNote('捕獲');
    expect(getCachedNote('捕獲')).toBeUndefined();
  });

  it('handles empty synonyms array', () => {
    setCachedNote('走る', 'Run note', []);
    const cached = getCachedNote('走る');
    expect(cached!.synonyms).toEqual([]);
  });

  it('stores multiple words independently', () => {
    setCachedNote('捕獲', 'Note 1', ['a']);
    setCachedNote('走る', 'Note 2', ['b']);
    expect(getCachedNote('捕獲')!.note_text).toBe('Note 1');
    expect(getCachedNote('走る')!.note_text).toBe('Note 2');
  });
});
