import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after global mock
import { lookup, generate, save } from '../src/lib/api';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lookup', () => {
  it('sends POST to /api/lookup with word and token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ subjects: [], words: [], sentences: [] }),
    });

    await lookup('走る', 'my-token');

    expect(mockFetch).toHaveBeenCalledWith('/api/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: '走る', token: 'my-token' }),
    });
  });

  it('returns parsed response on success', async () => {
    const expected = { subjects: [{ id: 1 }], words: [], sentences: [] };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(expected),
    });

    const result = await lookup('走る', 'tok');
    expect(result).toEqual(expected);
  });

  it('throws with error message from server on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid token' }),
    });

    await expect(lookup('走る', 'bad')).rejects.toThrow('Invalid token');
  });

  it('throws with statusText if JSON parse fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(lookup('走る', 'tok')).rejects.toThrow('Internal Server Error');
  });
});

describe('generate', () => {
  it('sends POST to /api/generate', async () => {
    const body = {
      subject: { id: 1 } as any,
      words: [],
      sentences: [],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ noteText: 'test', synonyms: [] }),
    });

    await generate(body);

    expect(mockFetch).toHaveBeenCalledWith('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('returns noteText and synonyms', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ noteText: 'Context:\ntest', synonyms: ['a'] }),
    });

    const result = await generate({ subject: {} as any, words: [], sentences: [] });
    expect(result.noteText).toContain('Context:');
    expect(result.synonyms).toEqual(['a']);
  });
});

describe('save', () => {
  it('sends POST to /api/save', async () => {
    const body = {
      token: 'tok',
      subjectId: 42,
      meaningNote: 'note',
      meaningSynonyms: ['s'],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, action: 'created', studyMaterial: {} }),
    });

    await save(body);

    expect(mockFetch).toHaveBeenCalledWith('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  });

  it('returns action and success status', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, action: 'updated', studyMaterial: { id: 1 } }),
    });

    const result = await save({ token: 't', subjectId: 1, meaningNote: '', meaningSynonyms: [] });
    expect(result.success).toBe(true);
    expect(result.action).toBe('updated');
  });

  it('throws on server error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Save failed' }),
    });

    await expect(
      save({ token: 't', subjectId: 1, meaningNote: '', meaningSynonyms: [] }),
    ).rejects.toThrow('Save failed');
  });
});
