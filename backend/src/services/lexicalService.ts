import type { LexicalEntry, JotobaWord, JishoWord } from '@shared/types.js';
import * as jotobaProvider from './jotoba.js';
import * as jishoProvider from './jisho.js';
import { cacheGet, cacheSet } from './cacheService.js';

/** Convert a Jotoba word result into a unified LexicalEntry. */
function jotobaToLexical(w: JotobaWord): LexicalEntry {
  return {
    word: w.reading.kanji ?? w.reading.kana,
    reading: w.reading.kana,
    glosses: w.senses.flatMap((s) => s.glosses ?? []).filter(Boolean),
    partsOfSpeech: [...new Set(w.senses.flatMap((s) => s.pos ?? []).filter(Boolean))],
    common: w.common,
    tags: [...new Set(w.senses.flatMap((s) => s.misc ?? []).filter(Boolean))],
    info: w.senses.map((s) => s.information).filter((v): v is string => typeof v === 'string' && v.length > 0),
    seeAlso: [...new Set(w.senses.flatMap((s) => s.xref ?? []).filter(Boolean))],
    fields: [...new Set(w.senses.flatMap((s) => s.field ?? []).filter(Boolean))],
    antonyms: [...new Set(w.senses.flatMap((s) => s.antonym ?? []).filter(Boolean))],
    source: 'jotoba',
  };
}

/** Convert a Jisho word result into a unified LexicalEntry. */
function jishoToLexical(w: JishoWord): LexicalEntry {
  return {
    word: w.slug,
    reading: w.japanese[0]?.reading,
    glosses: w.senses.flatMap((s) => s.english_definitions ?? []).filter(Boolean),
    partsOfSpeech: [...new Set(w.senses.flatMap((s) => s.parts_of_speech ?? []).filter(Boolean))],
    jlpt: w.jlpt?.[0]?.replace('jlpt-', 'JLPT-').toUpperCase(),
    common: w.is_common,
    tags: [...new Set([...(w.tags ?? []), ...w.senses.flatMap((s) => s.tags ?? [])].filter(Boolean))],
    info: w.senses.flatMap((s) => s.info ?? []).filter(Boolean),
    seeAlso: [...new Set(w.senses.flatMap((s) => s.see_also ?? []).filter(Boolean))],
    source: 'jisho',
  };
}

/**
 * Supplement Jotoba-sourced entries with Jisho data (e.g. JLPT level)
 * when available. Mutates entries in place.
 */
function supplementFromJisho(entries: LexicalEntry[], jishoWords: JishoWord[]): void {
  for (const entry of entries) {
    const match =
      jishoWords.find((w) => w.slug === entry.word) ??
      jishoWords.find((w) => w.japanese.some((j) => j.word === entry.word));
    if (!match) continue;

    if (!entry.jlpt && match.jlpt.length > 0) {
      entry.jlpt = match.jlpt[0].replace('jlpt-', 'JLPT-').toUpperCase();
    }
  }
}

/**
 * Find the best-matching lexical entry for the given characters.
 */
export function findBestEntry(
  characters: string,
  entries: LexicalEntry[],
): LexicalEntry | undefined {
  return (
    entries.find((e) => e.word === characters) ??
    entries[0]
  );
}

/**
 * Fetch unified lexical data. Jotoba is primary; Jisho is fallback.
 * Both are fetched in parallel for speed.
 */
export async function fetchLexical(word: string): Promise<LexicalEntry[]> {
  const cacheKey = `lexical:${word}`;
  const cached = cacheGet<LexicalEntry[]>(cacheKey);
  if (cached) return cached;

  const [jotobaResult, jishoResult] = await Promise.allSettled([
    jotobaProvider.searchWords(word),
    jishoProvider.searchWords(word),
  ]);

  // Prefer Jotoba results
  if (jotobaResult.status === 'fulfilled' && jotobaResult.value.length > 0) {
    const entries = jotobaResult.value.map(jotobaToLexical);

    // Supplement with Jisho data (e.g. JLPT level)
    if (jishoResult.status === 'fulfilled') {
      supplementFromJisho(entries, jishoResult.value);
    }

    cacheSet(cacheKey, entries);
    return entries;
  }

  // Fall back to Jisho
  if (jishoResult.status === 'fulfilled' && jishoResult.value.length > 0) {
    const fallback = jishoResult.value.map(jishoToLexical);
    cacheSet(cacheKey, fallback);
    return fallback;
  }

  return [];
}
