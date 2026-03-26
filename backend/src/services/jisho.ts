import type { JishoWord } from '@shared/types.js';

const JISHO_BASE = 'https://jisho.org/api/v1';

export async function searchWords(query: string): Promise<JishoWord[]> {
  const url = `${JISHO_BASE}/search/words?keyword=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    throw new Error(`Jisho words error: ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? []) as JishoWord[];
}
