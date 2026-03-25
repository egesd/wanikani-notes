import type {
  WKSubject,
  WKMeaning,
  WKReading,
  LexicalEntry,
  SentenceExample,
  GeneratedNote,
  EnrichedNote,
  CompareWord,
} from '@shared/types.js';
import { findBestEntry } from './lexicalService.js';
import { rankSentences } from './sentenceService.js';
import { findCompareCandidate, findCompareCandidateAsync } from './compareWordService.js';

// ── Public API ──

export async function composeNote(
  subject: WKSubject,
  lexical: LexicalEntry[],
  sentences: SentenceExample[],
): Promise<GeneratedNote> {
  const safeLexical = lexical.map(sanitizeEntry);

  const chars = subject.data.characters;
  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
  const primaryReading =
    subject.data.readings?.find((r: WKReading) => r.primary)?.reading ?? '';

  const entry = findBestEntry(chars, safeLexical);
  const ranked = rankSentences(sentences, chars);

  const enriched: EnrichedNote = {
    word: chars,
    reading: primaryReading || undefined,
    coreMeaning: buildCoreMeaning(primaryMeaning, entry, ranked),
    usedFor: buildUsedFor(entry, ranked, chars),
    register: inferRegister(entry),
    safeSynonyms: extractSynonyms(primaryMeaning, subject, entry),
    compare: await buildCompare(entry, safeLexical),
    commonPatterns: extractPatterns(chars, ranked, entry),
    example: pickBestExample(ranked),
    extraNotes: [],
  };

  // Suppress "Used for" redundancy when register already says it
  if (enriched.register && enriched.usedFor) {
    const deduped = deduplicateWithRegister(enriched.usedFor, enriched.register);
    enriched.usedFor = deduped === 'General use.' ? undefined : deduped;
  }

  const omitted = detectOmitted(enriched);

  return {
    noteText: renderNote(enriched),
    synonyms: enriched.safeSynonyms,
    omitted: omitted.length > 0 ? omitted : undefined,
  };
}

// ── Rendering ──

function renderNote(note: EnrichedNote): string {
  const sections: string[] = [];

  if (note.coreMeaning) {
    sections.push(`Core meaning:\n${note.coreMeaning}`);
  }

  if (note.usedFor) {
    sections.push(`Used for:\n${note.usedFor}`);
  }

  if (note.register) {
    sections.push(`Register:\n${note.register}`);
  }

  if (note.compare) {
    let line = note.compare.word;
    if (note.compare.reading) line += ` (${note.compare.reading})`;
    line += `\n${note.compare.explanation}`;
    sections.push(`Do not confuse with:\n${line}`);
  }

  if (note.commonPatterns.length > 0) {
    sections.push(`Common patterns:\n${note.commonPatterns.join('\n')}`);
  }

  if (note.example) {
    let exLine = note.example.japanese;
    if (note.example.english) exLine += `\n→ ${note.example.english}`;
    sections.push(`Example:\n${exLine}`);
  }

  return sections.join('\n\n');
}

function detectOmitted(note: EnrichedNote): string[] {
  const omitted: string[] = [];
  if (!note.coreMeaning) omitted.push('Core meaning');
  if (!note.usedFor) omitted.push('Used for');
  if (!note.register) omitted.push('Register');
  if (!note.compare) omitted.push('Do not confuse with');
  if (note.commonPatterns.length === 0) omitted.push('Common patterns');
  if (!note.example) omitted.push('Example');
  return omitted;
}

// ── Section Builders ──

/**
 * Build a core meaning that adds distinction beyond the WaniKani gloss.
 * Instead of just "Capture (seizure)", tries to say *what kind of* capture.
 */
function buildCoreMeaning(
  primaryMeaning: string,
  entry: LexicalEntry | undefined,
  sentences: SentenceExample[],
): string | undefined {
  if (!entry) return undefined;

  // Gather distinguishing context: fields, POS, info
  const qualifiers: string[] = [];

  // Domain qualifier from fields
  if (entry.fields && entry.fields.length > 0) {
    qualifiers.push(entry.fields.join('/'));
  }

  // Extract typical objects from sentence evidence (nouns before を + word)
  const objects = extractTypicalObjects(entry.word, sentences);
  if (objects.length > 0) {
    qualifiers.push(`of ${objects.join(', ')}`);
  }

  if (qualifiers.length > 0) {
    const extra = entry.glosses.find(
      (g) => g.toLowerCase() !== primaryMeaning.toLowerCase() && g.split(/\s+/).length <= 3,
    );
    let meaning = primaryMeaning;
    if (extra) meaning += ` / ${extra}`;
    return `${meaning} (${qualifiers.join('; ')})`;
  }

  // No external signal beyond what WaniKani already shows — omit
  return undefined;
}

/**
 * Extract nouns that typically appear as objects (before を) of the target word
 * from sentence evidence.
 */
function extractTypicalObjects(word: string, sentences: SentenceExample[]): string[] {
  const objects: string[] = [];
  const seen = new Set<string>();

  for (const s of sentences) {
    if (objects.length >= 3) break;
    const text = s.japanese;
    const idx = text.indexOf(word);
    if (idx < 1) continue;

    const before = text.slice(Math.max(0, idx - 15), idx);
    const match = before.match(
      /([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]{1,6})を$/u,
    );
    if (!match) continue;

    const obj = match[1];
    if (seen.has(obj)) continue;
    seen.add(obj);
    objects.push(obj);
  }

  return objects;
}

/**
 * Build "Used for" from lexical metadata + sentence evidence.
 * Focuses on what situations/objects the word applies to.
 */
function buildUsedFor(
  entry: LexicalEntry | undefined,
  sentences: SentenceExample[],
  word: string,
): string | undefined {
  if (!entry) return undefined;

  const parts: string[] = [];

  // Domain context from fields — this is real external signal
  if (entry.fields && entry.fields.length > 0) {
    parts.push(`Typically used in ${entry.fields.join(' and ')} contexts`);
  }

  // Uncommon marker — WaniKani doesn't surface this
  if (entry.common === false) {
    parts.push('Less common; found in formal or specialized writing');
  }

  // Info notes from dictionary (but skip register-like ones — those go in Register)
  if (entry.info && entry.info.length > 0) {
    const relevant = entry.info.filter(
      (i) => i.length > 0 && !/formal|colloquial|polite|humble|honorific|archaic|vulgar|slang/i.test(i),
    );
    if (relevant.length > 0) parts.push(relevant.join('; '));
  }

  if (entry.jlpt) {
    parts.push(entry.jlpt);
  }

  // If we only have JLPT and nothing else, that's borderline filler — but keep it
  // since WaniKani doesn't show JLPT level
  if (parts.length === 0) return undefined;
  return parts.join('. ') + '.';
}

/**
 * Remove redundancy between "Used for" and "Register" sections.
 * If register already says "Formal / literary", strip "Less common; found in formal..." from usedFor.
 */
function deduplicateWithRegister(usedFor: string, register: string): string {
  const regLower = register.toLowerCase();

  // If register already covers formality, strip generic formality statements from usedFor
  if (regLower.includes('formal') || regLower.includes('literary') || regLower.includes('polite')) {
    usedFor = usedFor
      .replace(/Less common; found in formal or specialized writing\.?\s*/i, '')
      .replace(/\.\s*\./g, '.');
  }

  // If register already covers casualness
  if (regLower.includes('casual') || regLower.includes('colloquial') || regLower.includes('slang')) {
    usedFor = usedFor
      .replace(/Everyday use\.?\s*/i, '')
      .replace(/\.\s*\./g, '.');
  }

  const trimmed = usedFor.replace(/^[\s.]+|[\s.]+$/g, '');
  if (!trimmed) return 'General use.';
  return trimmed.endsWith('.') ? trimmed : trimmed + '.';
}

function inferRegister(entry: LexicalEntry | undefined): string | undefined {
  if (!entry) return undefined;

  const allTokens = [
    ...(entry.tags ?? []),
    ...(entry.info ?? []),
    ...(entry.fields ?? []),
    ...entry.partsOfSpeech,
  ]
    .filter(Boolean)
    .map((t) => t.toLowerCase());

  if (allTokens.some((t) => t.includes('honorific') || t.includes('sonkeigo')))
    return 'Formal / honorific.';
  if (allTokens.some((t) => t.includes('humble') || t.includes('kenjougo')))
    return 'Formal / humble.';
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
 * Only short, unambiguous English equivalents.
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
    if (text.split(/\s+/).length > 3) return;
    seen.add(key);
    candidates.push(text);
  }

  if (entry) {
    for (const gloss of entry.glosses) {
      addCandidate(gloss.trim());
    }
  }

  for (const m of subject.data.meanings) {
    if (!m.primary && m.accepted_answer) {
      addCandidate(m.meaning);
    }
  }

  return candidates.slice(0, 4);
}

async function buildCompare(
  entry: LexicalEntry | undefined,
  allEntries: LexicalEntry[],
): Promise<CompareWord | undefined> {
  if (!entry) return undefined;

  // Actively search for homophones and seeAlso words
  const candidate = await findCompareCandidateAsync(entry, allEntries);
  if (candidate) return candidate;

  return undefined;
}

/**
 * Extract common usage patterns from sentence evidence and POS data.
 */
function extractPatterns(
  word: string,
  sentences: SentenceExample[],
  entry: LexicalEntry | undefined,
): string[] {
  const isSuru =
    entry?.partsOfSpeech.some((p) => /suru|する/i.test(p)) ?? false;

  const sentencePatterns: string[] = [];

  for (const s of sentences) {
    if (sentencePatterns.length >= 3) break;
    const text = s.japanese;
    const idx = text.indexOf(word);
    if (idx < 1) continue;

    const before = text.slice(Math.max(0, idx - 20), idx);
    const match = before.match(
      /([\u4e00-\u9faf\u3040-\u309f\u30a0-\u30ff]{1,8}[をがにでと])$/u,
    );
    if (!match) continue;

    const afterWord = text.slice(idx + word.length, idx + word.length + 3);
    let suffix = '';
    if (isSuru && /^[しすさせそ]/.test(afterWord)) {
      suffix = 'する';
    }

    const pat = match[1] + word + suffix;
    if (sentencePatterns.some((p) => p.includes(pat))) continue;

    let line = `- ${pat}`;
    if (s.english) {
      line += ` → ${s.english}`;
    }
    sentencePatterns.push(line);
  }

  // Only include the suru template if we also have real sentence patterns
  if (isSuru && sentencePatterns.length > 0) {
    return [`- Xを${word}する`, ...sentencePatterns].slice(0, 3);
  }

  return sentencePatterns.slice(0, 3);
}

function pickBestExample(
  ranked: SentenceExample[],
): SentenceExample | undefined {
  return ranked[0];
}

/** Strip nulls/non-strings from all string-array fields. */
function sanitizeEntry(e: LexicalEntry): LexicalEntry {
  const strs = (arr: unknown): string[] =>
    Array.isArray(arr)
      ? arr.filter((v): v is string => typeof v === 'string')
      : [];
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
