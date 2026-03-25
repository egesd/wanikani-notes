import type { TatoebaSentence } from '@shared/types.js';

const TATOEBA_BASE = 'https://tatoeba.org';

export async function searchSentences(query: string): Promise<TatoebaSentence[]> {
  const url = `${TATOEBA_BASE}/api_v0/search?from=jpn&to=eng&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Tatoeba search error: ${res.status}`);
  }
  const json = await res.json();
  return (json.results ?? []) as TatoebaSentence[];
}
