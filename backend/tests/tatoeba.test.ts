import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchSentences } from '../src/services/tatoeba.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchSentences (Tatoeba)', () => {
  it('sends GET request to Tatoeba with encoded query', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await searchSentences('捕獲');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://tatoeba.org/api_v0/search?from=jpn&to=eng&query=%E6%8D%95%E7%8D%B2',
    );
  });

  it('returns sentences from response', async () => {
    const fakeSentences = [
      {
        id: 123,
        text: '彼らはキツネを捕獲した。',
        lang: 'jpn',
        translations: [[{ id: 456, text: 'They captured a fox.', lang: 'eng' }]],
      },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: fakeSentences }),
    });

    const result = await searchSentences('捕獲');
    expect(result).toEqual(fakeSentences);
  });

  it('returns empty array when response has no results key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await searchSentences('x');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(searchSentences('x')).rejects.toThrow('Tatoeba search error: 500');
  });
});
