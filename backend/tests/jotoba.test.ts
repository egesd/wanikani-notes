import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSentences, searchWords } from '../src/services/jotoba.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchWords (Jotoba)', () => {
  it('sends correct request to Jotoba words endpoint', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ words: [] }),
    });

    await searchWords('食べる');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://jotoba.de/api/search/words',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '食べる', language: 'English', no_english: false }),
      },
    );
  });

  it('returns words from response', async () => {
    const fakeWords = [
      {
        reading: { kana: 'たべる', kanji: '食べる' },
        senses: [{ glosses: ['to eat'], pos: ['Ichidan verb'], misc: [], field: [], dialect: [], xref: [], antonym: [], information: '' }],
        common: true,
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ words: fakeWords }),
    });

    const result = await searchWords('食べる');
    expect(result).toEqual(fakeWords);
  });

  it('returns empty array when response has no words key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await searchWords('x');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(searchWords('x')).rejects.toThrow('Jotoba words error: 500');
  });
});

describe('searchSentences', () => {
  it('sends correct request to Jotoba', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sentences: [] }),
    });

    await searchSentences('食べる');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://jotoba.de/api/search/sentences',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '食べる', language: 'English', no_english: false }),
      },
    );
  });

  it('returns sentences from response', async () => {
    const fakeSentences = [
      { content: '犬が走る。', furigana: '', translation: 'The dog runs.', language: 'English' },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ sentences: fakeSentences }),
    });

    const result = await searchSentences('走る');
    expect(result).toEqual(fakeSentences);
  });

  it('returns empty array when response has no sentences key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await searchSentences('x');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    await expect(searchSentences('x')).rejects.toThrow('Jotoba sentences error: 403');
  });
});
