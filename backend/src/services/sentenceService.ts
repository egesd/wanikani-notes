import type { SentenceExample, TatoebaSentence, JotobaSentence } from '@shared/types.js';
import * as tatoebaProvider from './tatoeba.js';
import * as jotobaProvider from './jotoba.js';
import { cacheGet, cacheSet } from './cacheService.js';

function tatoebaToSentence(s: TatoebaSentence): SentenceExample {
  // translations is [[direct], [indirect]] — search both levels
  const english = s.translations
    .flat()
    .find((t) => t.lang === 'eng');

  // Tatoeba provides ruby HTML in transcriptions
  const furigana = (s.transcriptions ?? [])
    .find((t) => t.script === 'Hrkt');

  return {
    japanese: s.text,
    english: english?.text,
    furiganaHtml: furigana?.html,
    source: 'tatoeba',
  };
}

function jotobaToSentence(s: JotobaSentence): SentenceExample {
  // Jotoba furigana is bracket-notation like [漢字|かんじ] — convert to ruby HTML
  const furiganaHtml = s.furigana
    ? bracketFuriganaToHtml(s.furigana)
    : undefined;

  return {
    japanese: s.content,
    english: s.translation || undefined,
    furiganaHtml,
    source: 'jotoba',
  };
}

/** Convert bracket furigana notation [漢字|かんじ] to ruby HTML. */
function bracketFuriganaToHtml(text: string): string {
  return text.replace(
    /\[([^|\]]+)\|([^\]]+)\]/g,
    '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>',
  );
}

/**
 * Score a sentence for quality. Higher = better for study notes.
 * Prefers short, natural sentences that contain the target word
 * and have an English translation.
 */
function scoreSentence(s: SentenceExample, word: string): number {
  const text = s.japanese;
  if (!text.includes(word)) return -1;

  let score = 0;
  const len = text.length;

  // Ideal length for a WaniKani note: 5–30 chars
  if (len >= 5 && len <= 30) score += 3;
  else if (len > 30 && len <= 50) score += 2;
  else if (len > 50) score += 1;
  else score += 0; // very short

  // Has English translation
  if (s.english) score += 2;

  // Prefer Tatoeba (real usage evidence)
  if (s.source === 'tatoeba') score += 1;

  return score;
}

/**
 * Rank sentences by quality, filtering out irrelevant ones.
 */
export function rankSentences(
  sentences: SentenceExample[],
  word: string,
): SentenceExample[] {
  return sentences
    .map((s) => ({ s, score: scoreSentence(s, word) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.s);
}

/**
 * Fetch sentences from Tatoeba and Jotoba in parallel.
 * Both sources are merged; failures are tolerated.
 */
export async function fetchSentences(word: string): Promise<SentenceExample[]> {
  const cacheKey = `sentences:${word}`;
  const cached = cacheGet<SentenceExample[]>(cacheKey);
  if (cached) return cached;

  const [tatoebaResult, jotobaResult] = await Promise.allSettled([
    tatoebaProvider.searchSentences(word),
    jotobaProvider.searchSentences(word),
  ]);

  const sentences: SentenceExample[] = [];

  if (tatoebaResult.status === 'fulfilled') {
    sentences.push(...tatoebaResult.value.map(tatoebaToSentence));
  }

  if (jotobaResult.status === 'fulfilled') {
    sentences.push(...jotobaResult.value.map(jotobaToSentence));
  }

  cacheSet(cacheKey, sentences);
  return sentences;
}
