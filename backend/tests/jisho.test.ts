import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchWords } from '../src/services/jisho.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchWords', () => {
  it('sends GET request to Jisho with encoded keyword', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    await searchWords('走る');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://jisho.org/api/v1/search/words?keyword=%E8%B5%B0%E3%82%8B',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns words from response data', async () => {
    const fakeWords = [
      { slug: '走る', is_common: true, tags: [], jlpt: [], japanese: [], senses: [] },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: fakeWords }),
    });

    const result = await searchWords('走る');
    expect(result).toEqual(fakeWords);
  });

  it('returns empty array when response has no data key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const result = await searchWords('nonexistent');
    expect(result).toEqual([]);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(searchWords('走る')).rejects.toThrow('Jisho words error: 503');
  });
});
