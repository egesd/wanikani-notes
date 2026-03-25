import type { LexicalEntry, CompareWord } from '@shared/types.js';
import { fetchLexical } from './lexicalService.js';

/** Keep only real strings from an array that may contain nulls/objects. */
const strs = (arr: unknown[]): string[] =>
  arr.filter((v): v is string => typeof v === 'string');

/**
 * Score a candidate word for how likely it is to be confused with the target.
 * Higher score = more confusable.
 *
 * Priority: same reading > overlapping glosses > same POS > shared kanji.
 */
export function scoreCandidate(
  target: LexicalEntry,
  candidate: LexicalEntry,
): number {
  let score = 0;

  // Same reading = strongest signal (homophones), but only if
  // the candidate is a common word (obscure homophones aren't useful)
  if (
    target.reading &&
    candidate.reading &&
    target.reading === candidate.reading
  ) {
    score += candidate.common ? 10 : 2;
  }

  // Overlapping English glosses
  const targetGlosses = new Set(
    strs(target.glosses).map((g) => g.toLowerCase()),
  );
  const glossOverlap = strs(candidate.glosses).filter((g) =>
    targetGlosses.has(g.toLowerCase()),
  );
  score += glossOverlap.length * 3;

  // Same part of speech
  const targetPos = new Set(
    strs(target.partsOfSpeech).map((p) => p.toLowerCase()),
  );
  const posOverlap = strs(candidate.partsOfSpeech).filter((p) =>
    targetPos.has(p.toLowerCase()),
  );
  score += posOverlap.length;

  // Shared kanji characters
  const targetKanji = [...target.word].filter((c) =>
    /[\u4e00-\u9faf]/.test(c),
  );
  const candidateKanji = new Set(
    [...candidate.word].filter((c) => /[\u4e00-\u9faf]/.test(c)),
  );
  const sharedKanji = targetKanji.filter((k) => candidateKanji.has(k));
  score += sharedKanji.length * 2;

  return score;
}

/**
 * Build a short natural-language explanation of *when to use which* word.
 * Focus: help a learner pick the right word, not just list differences.
 */
export function buildExplanation(
  target: LexicalEntry,
  candidate: LexicalEntry,
): string {
  const tGlosses = strs(target.glosses);
  const cGlosses = strs(candidate.glosses);
  const tFirst = tGlosses[0] ?? '?';
  const cFirst = cGlosses[0] ?? '?';

  // Same reading — homophone pair: focus on when to use which
  if (
    target.reading &&
    candidate.reading &&
    target.reading === candidate.reading
  ) {
    return `Both read ${target.reading}. Use ${target.word} for "${tFirst}"; use ${candidate.word} for "${cFirst}".`;
  }

  // Overlapping glosses — near-synonyms: say what each one emphasizes
  const candidateGlossSet = new Set(cGlosses.map((g) => g.toLowerCase()));
  const targetGlossSet = new Set(tGlosses.map((g) => g.toLowerCase()));
  const overlap = tGlosses.filter((g) =>
    candidateGlossSet.has(g.toLowerCase()),
  );
  if (overlap.length > 0) {
    const uniqueTarget = tGlosses.find(
      (g) => !candidateGlossSet.has(g.toLowerCase()),
    );
    const uniqueCandidate = cGlosses.find(
      (g) => !targetGlossSet.has(g.toLowerCase()),
    );
    if (uniqueTarget && uniqueCandidate) {
      return `Use ${target.word} when you mean "${uniqueTarget}"; use ${candidate.word} when you mean "${uniqueCandidate}".`;
    }
    return `Both can mean "${overlap[0]}". Use ${target.word} (${tFirst}) vs ${candidate.word} (${cFirst}) depending on context.`;
  }

  // Shared kanji — explain the relationship briefly
  const targetKanji = [...target.word].filter((c) =>
    /[\u4e00-\u9faf]/.test(c),
  );
  const candidateKanjiSet = new Set(
    [...candidate.word].filter((c) => /[\u4e00-\u9faf]/.test(c)),
  );
  const shared = targetKanji.filter((k) => candidateKanjiSet.has(k));
  if (shared.length > 0) {
    return `Share kanji ${shared.join('')}. Use ${target.word} for "${tFirst}"; use ${candidate.word} for "${cFirst}".`;
  }

  // Fallback
  return `${candidate.word} (${cFirst}) is related but used in different situations.`;
}

/**
 * Find the best confusion candidate from a provided list.
 */
export function findCompareCandidate(
  target: LexicalEntry,
  allEntries: LexicalEntry[],
): CompareWord | undefined {
  const candidates = allEntries.filter((e) => e.word !== target.word);
  if (candidates.length === 0) return undefined;

  const scored = candidates
    .map((c) => ({ entry: c, score: scoreCandidate(target, c) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return undefined;

  const best = scored[0];
  return {
    word: best.entry.word,
    reading: best.entry.reading,
    explanation: buildExplanation(target, best.entry),
  };
}

/**
 * Actively search for a compare candidate by looking up:
 * 1. The reading (to find homophones)
 * 2. The seeAlso cross-references (to find near-synonyms with full data)
 * Falls back to the inline entries and seeAlso text if lookups fail.
 */
export async function findCompareCandidateAsync(
  target: LexicalEntry,
  inlineEntries: LexicalEntry[],
): Promise<CompareWord | undefined> {
  // First try inline entries (already available, no network)
  const inlineResult = findCompareCandidate(target, inlineEntries);

  // Collect search terms for active lookup
  const searchTerms: string[] = [];

  // Search by reading to find homophones
  if (target.reading) {
    searchTerms.push(target.reading);
  }

  // Search seeAlso references to get full lexical data for them
  const seeAlso = target.seeAlso ?? [];
  for (const ref of seeAlso.slice(0, 2)) {
    searchTerms.push(ref);
  }

  if (searchTerms.length === 0) return inlineResult;

  // Fetch candidates in parallel, tolerate failures
  const results = await Promise.allSettled(
    searchTerms.map((term) => fetchLexical(term)),
  );

  const fetched: LexicalEntry[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      fetched.push(...r.value);
    }
  }

  // Combine inline + fetched, dedup by word
  const seen = new Set(inlineEntries.map((e) => e.word));
  const combined = [...inlineEntries];
  for (const e of fetched) {
    if (!seen.has(e.word)) {
      seen.add(e.word);
      combined.push(e);
    }
  }

  const activeResult = findCompareCandidate(target, combined);

  // Pick the best between inline and active results
  if (!activeResult) return inlineResult;
  if (!inlineResult) return activeResult;

  // Prefer whichever scored higher (re-score to compare)
  const inlineEntry = combined.find((e) => e.word === inlineResult.word);
  const activeEntry = combined.find((e) => e.word === activeResult.word);
  if (inlineEntry && activeEntry) {
    const inlineScore = scoreCandidate(target, inlineEntry);
    const activeScore = scoreCandidate(target, activeEntry);
    return activeScore >= inlineScore ? activeResult : inlineResult;
  }

  return activeResult;
}
