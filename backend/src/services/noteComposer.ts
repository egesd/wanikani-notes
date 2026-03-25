import type {
  WKSubject,
  WKMeaning,
  WKReading,
  LexicalEntry,
  SentenceExample,
  GeneratedNote,
} from '@shared/types.js';
import { findBestEntry } from './lexicalService.js';
import { rankSentences } from './sentenceService.js';

// ── Public API ──

export function composeNote(
  subject: WKSubject,
  lexical: LexicalEntry[],
  sentences: SentenceExample[],
): GeneratedNote {
  // Sanitize incoming data — external API payloads may contain nulls
  const safeLexical = lexical.map(sanitizeEntry);

  const chars = subject.data.characters;
  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
  const primaryReading =
    subject.data.readings?.find((r: WKReading) => r.primary)?.reading ?? '';

  const entry = findBestEntry(chars, safeLexical);
  const ranked = rankSentences(sentences, chars);

  const sections: string[] = [];

  // Context
  const context = buildContext(chars, primaryReading, primaryMeaning, entry);
  sections.push(`Context:\n${context}`);

  // Register
  const register = inferRegister(entry);
  if (register) {
    sections.push(`Register:\n${register}`);
  }

  // Synonyms
  const synonyms = extractSynonyms(primaryMeaning, subject, entry);
  if (synonyms.length > 0) {
    sections.push(`Synonyms:\n${synonyms.map((s) => `- ${s}`).join('\n')}`);
  }

  // Compare
  const compare = buildCompare(chars, entry);
  if (compare) {
    sections.push(`Compare:\n${compare}`);
  }

  // Common patterns
  const patterns = extractPatterns(chars, ranked, entry);
  if (patterns.length > 0) {
    sections.push(
      `Common patterns:\n${patterns.join('\n')}`,
    );
  }

  // Something more to add?
  const extras = buildExtras(entry, subject);
  if (extras) {
    sections.push(`Something more to add?\n${extras}`);
  }

  // Example
  const example = pickBestExample(ranked);
  if (example) {
    let exLine = `Example:\n${example.japanese}`;
    if (example.english) exLine += `\n→ ${example.english}`;
    sections.push(exLine);
  }

  return {
    noteText: sections.join('\n\n'),
    synonyms,
  };
}

// ── Helpers ──

function buildContext(
  word: string,
  reading: string,
  primaryMeaning: string,
  entry: LexicalEntry | undefined,
): string {
  let line = word;
  if (reading) line += ` (${reading})`;
  line += ` means "${primaryMeaning}"`;

  if (entry) {
    // Add extra glosses that differ from primary meaning
    const extraGlosses = entry.glosses
      .filter((g) => g.toLowerCase() !== primaryMeaning.toLowerCase())
      .slice(0, 2);
    if (extraGlosses.length > 0) {
      line += ` — also: ${extraGlosses.join(', ')}`;
    }
    line += '.';

    // Usage context line
    const usageParts: string[] = [];

    if (entry.fields && entry.fields.length > 0) {
      usageParts.push(
        `Commonly used in ${entry.fields.join(', ')} contexts`,
      );
    } else if (entry.common === false) {
      usageParts.push(
        'A less common word, typically found in formal or specialized contexts',
      );
    } else if (entry.common) {
      usageParts.push('A commonly used word in everyday Japanese');
    }

    if (entry.jlpt) {
      usageParts.push(entry.jlpt);
    }

    if (usageParts.length > 0) {
      line += ` ${usageParts.join('. ')}.`;
    }
  } else {
    line += '.';
  }

  return line;
}

function inferRegister(entry: LexicalEntry | undefined): string | undefined {
  if (!entry) return undefined;

  const allTokens = [
    ...(entry.tags ?? []),
    ...(entry.info ?? []),
    ...(entry.fields ?? []),
    ...entry.partsOfSpeech,
  ].filter(Boolean).map((t) => t.toLowerCase());

  if (allTokens.some((t) => t.includes('honorific') || t.includes('sonkeigo')))
    return 'Formal / honorific (sonkeigo).';
  if (allTokens.some((t) => t.includes('humble') || t.includes('kenjougo')))
    return 'Formal / humble (kenjougo).';
  if (allTokens.some((t) => t.includes('polite')))
    return 'Polite / formal.';
  if (allTokens.some((t) => t.includes('formal') || t.includes('literary')))
    return 'Formal / literary.';
  if (allTokens.some((t) => t.includes('colloquial') || t.includes('slang')))
    return 'Casual / colloquial.';
  if (allTokens.some((t) => t.includes('archaic') || t.includes('archaism')))
    return 'Archaic.';
  if (allTokens.some((t) => t.includes('vulgar')))
    return 'Vulgar / informal.';

  // Domain-based register
  const fields = entry.fields ?? [];
  if (fields.some((f) => /law|legal/i.test(f))) return 'Formal / legal.';
  if (fields.some((f) => /medicine|medical/i.test(f)))
    return 'Technical / medical.';
  if (fields.some((f) => /comput|tech/i.test(f)))
    return 'Technical / computing.';
  if (fields.length > 0)
    return `Domain-specific (${fields.join(', ')}).`;

  return undefined;
}

/**
 * Extract safe synonyms for WaniKani meaning_synonyms.
 * Only short, unambiguous English equivalents that won't cause wrong answers.
 */
function extractSynonyms(
  primaryMeaning: string,
  subject: WKSubject,
  entry: LexicalEntry | undefined,
): string[] {
  const primaryLower = primaryMeaning.toLowerCase();
  const seen = new Set<string>();
  const candidates: string[] = [];

  const BLOCKED = new Set([
    'thing', 'stuff', 'matter', 'something', 'one', 'it',
  ]);

  function addCandidate(text: string) {
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    if (key === primaryLower) return;
    if (BLOCKED.has(key)) return;
    // Skip multi-word phrases (more than 3 words)
    if (text.split(/\s+/).length > 3) return;
    seen.add(key);
    candidates.push(text);
  }

  // From lexical glosses
  if (entry) {
    for (const gloss of entry.glosses) {
      addCandidate(gloss.trim());
    }
  }

  // From WaniKani accepted (non-primary) meanings
  for (const m of subject.data.meanings) {
    if (!m.primary && m.accepted_answer) {
      addCandidate(m.meaning);
    }
  }

  return candidates.slice(0, 4);
}

function buildCompare(
  word: string,
  entry: LexicalEntry | undefined,
): string | undefined {
  if (!entry) return undefined;

  const seeAlso = entry.seeAlso ?? [];
  if (seeAlso.length === 0) return undefined;

  const compareWord = seeAlso[0];
  return `- ${word} vs ${compareWord}`;
}

/**
 * Extract common usage patterns from sentence evidence and POS data.
 * Each pattern includes the collocation and, when available, the source
 * sentence's English translation for context.
 */
function extractPatterns(
  word: string,
  sentences: SentenceExample[],
  entry: LexicalEntry | undefined,
): string[] {
  const patterns: string[] = [];

  // For suru verbs, generate the standard pattern
  const isSuru =
    entry?.partsOfSpeech.some((p) => /suru|する/i.test(p)) ?? false;
  if (isSuru) {
    patterns.push(`- Xを${word}する`);
  }

  // Extract real collocations from sentence evidence
  for (const s of sentences) {
    if (patterns.length >= 3) break;
    const text = s.japanese;
    const idx = text.indexOf(word);
    if (idx < 1) continue;

    // Look for "noun + particle + word" before the target
    const before = text.slice(Math.max(0, idx - 20), idx);
    const match = before.match(
      /([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]{1,8}[をがにでと])$/u,
    );
    if (!match) continue;

    const afterWord = text.slice(
      idx + word.length,
      idx + word.length + 3,
    );
    let suffix = '';
    if (isSuru && /^[しすさせそ]/.test(afterWord)) {
      suffix = 'する';
    }

    const pat = match[1] + word + suffix;
    if (patterns.some((p) => p.includes(pat))) continue;

    let line = `- ${pat}`;
    if (s.english) {
      line += ` → ${s.english}`;
    }
    patterns.push(line);
  }

  return patterns.slice(0, 3);
}

function buildExtras(
  entry: LexicalEntry | undefined,
  subject: WKSubject,
): string | undefined {
  const parts: string[] = [];

  // Parts of speech
  const pos = entry?.partsOfSpeech ?? subject.data.parts_of_speech ?? [];
  if (pos.length > 0) {
    parts.push(`Parts of speech: ${pos.join(', ')}.`);
  }

  // Usage notes / info
  const info = entry?.info ?? [];
  if (info.length > 0) {
    parts.push(`Notes: ${info.join('; ')}.`);
  }

  // See-also references
  const seeAlso = (entry?.seeAlso ?? []).slice(0, 3);
  if (seeAlso.length > 0) {
    parts.push(`See also: ${seeAlso.join(', ')}.`);
  }

  // Tags
  const tags = entry?.tags ?? [];
  if (tags.length > 0) {
    parts.push(`Tags: ${tags.join(', ')}.`);
  }

  // Antonyms
  const antonyms = entry?.antonyms ?? [];
  if (antonyms.length > 0) {
    parts.push(`Antonyms: ${antonyms.join(', ')}.`);
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

function pickBestExample(
  ranked: SentenceExample[],
): SentenceExample | undefined {
  return ranked[0];
}

/** Strip nulls/non-strings from all string-array fields of a LexicalEntry. */
function sanitizeEntry(e: LexicalEntry): LexicalEntry {
  const strs = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  return {
    ...e,
    glosses: strs(e.glosses),
    partsOfSpeech: strs(e.partsOfSpeech),
    tags: strs(e.tags),
    info: strs(e.info),
    seeAlso: strs(e.seeAlso),
    fields: strs(e.fields),
    antonyms: strs(e.antonyms),
  };
}
