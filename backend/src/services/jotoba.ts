import type { JotobaSentence, JotobaWord } from '@shared/types.js';

const JOTOBA_BASE = 'https://jotoba.de';

export async function searchWords(query: string): Promise<JotobaWord[]> {
  const res = await fetch(`${JOTOBA_BASE}/api/search/words`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, language: 'English', no_english: false }),
  });
  if (!res.ok) {
    throw new Error(`Jotoba words error: ${res.status}`);
  }
  const json = await res.json();
  return (json.words ?? []) as JotobaWord[];
}

export async function searchSentences(query: string): Promise<JotobaSentence[]> {
  const res = await fetch(`${JOTOBA_BASE}/api/search/sentences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, language: 'English', no_english: false }),
  });
  if (!res.ok) {
    throw new Error(`Jotoba sentences error: ${res.status}`);
  }
  const json = await res.json();
  return (json.sentences ?? []) as JotobaSentence[];
}
