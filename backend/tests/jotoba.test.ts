import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSentences } from '../src/services/jotoba.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
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
