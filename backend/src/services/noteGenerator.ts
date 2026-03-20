import type {
  WKSubject,
  WKMeaning,
  WKReading,
  JishoWord,
  JishoSense,
  JotobaSentence,
  GeneratedNote,
} from '@shared/types.js';

/**
 * Build a structured study note from dictionary and WaniKani data.
 * Pure template assembly — no LLM.
 */
export function generateNote(
  subject: WKSubject,
  words: JishoWord[],
  sentences: JotobaSentence[],
): GeneratedNote {
  const contextText = buildContext(subject, words);
  const synonyms = extractSynonyms(subject, words);
  const extras = buildExtras(subject, words, sentences);

  const sections: string[] = [];

  sections.push(`Context:\n${contextText}`);

  if (synonyms.length > 0) {
    sections.push(
      `Synonyms:\n${synonyms.map((s) => `- ${s}`).join('\n')}`,
    );
  }

  if (extras) {
    sections.push(`Something more to add?\n${extras}`);
  }

  return {
    noteText: sections.join('\n\n'),
    synonyms,
  };
}

// ── Helpers ──

function buildContext(subject: WKSubject, words: JishoWord[]): string {
  const chars = subject.data.characters;
  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
  const primaryReading =
    subject.data.readings?.find((r: WKReading) => r.primary)?.reading ?? '';

  const partsOfSpeech = subject.data.parts_of_speech ?? [];
  const posLabel = partsOfSpeech.length > 0 ? partsOfSpeech.join(', ') : null;

  const match = findBestMatch(chars, words);

  let line1 = `${chars}`;
  if (primaryReading) line1 += ` (${primaryReading})`;
  line1 += ` means "${primaryMeaning}"`;
  if (posLabel) line1 += ` [${posLabel}]`;
  line1 += '.';

  let line2 = '';
  if (match) {
    const commonTag = match.is_common ? 'common word' : 'uncommon word';
    const extraGlosses = match.senses
      .flatMap((s: JishoSense) => s.english_definitions)
      .filter(
        (g: string) => g.toLowerCase() !== primaryMeaning.toLowerCase(),
      )
      .slice(0, 3);

    if (extraGlosses.length > 0) {
      line2 = `It is a ${commonTag}, also glossed as: ${extraGlosses.join(', ')}.`;
    } else {
      line2 = `It is a ${commonTag}.`;
    }

    // Add JLPT level if available
    if (match.jlpt.length > 0) {
      line2 += ` (${match.jlpt[0].toUpperCase()})`;
    }
  }

  return [line1, line2].filter(Boolean).join(' ');
}

function extractSynonyms(subject: WKSubject, words: JishoWord[]): string[] {
  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning?.toLowerCase() ?? '';

  const chars = subject.data.characters;
  const match = findBestMatch(chars, words);
  if (!match) return [];

  const seen = new Set<string>();
  const candidates: string[] = [];

  function addCandidate(text: string) {
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(text);
  }

  for (const sense of match.senses) {
    for (const def of sense.english_definitions) {
      const normalized = def.trim();
      const wordCount = normalized.split(/\s+/).length;
      if (wordCount > 2) continue;
      if (normalized.toLowerCase() === primaryMeaning) continue;
      if (['thing', 'stuff', 'matter', 'something'].includes(normalized.toLowerCase())) continue;
      addCandidate(normalized);
    }
  }

  // Also include WaniKani accepted meanings that aren't primary
  for (const m of subject.data.meanings) {
    if (!m.primary && m.accepted_answer) {
      if (m.meaning.toLowerCase() !== primaryMeaning) {
        addCandidate(m.meaning);
      }
    }
  }

  return candidates.slice(0, 4);
}

function buildExtras(
  subject: WKSubject,
  words: JishoWord[],
  sentences: JotobaSentence[],
): string {
  const parts: string[] = [];

  const match = findBestMatch(subject.data.characters, words);
  if (match) {
    // Parts of speech from Jisho (already plain strings)
    const allPos = match.senses
      .flatMap((s: JishoSense) => s.parts_of_speech)
      .filter((p: string, i: number, a: string[]) => a.indexOf(p) === i);
    if (allPos.length > 0) {
      parts.push(`Parts of speech: ${allPos.join(', ')}.`);
    }

    // Usage notes / info from Jisho
    const allInfo = match.senses
      .flatMap((s: JishoSense) => s.info)
      .filter(Boolean);
    if (allInfo.length > 0) {
      parts.push(`Notes: ${allInfo.join('; ')}.`);
    }

    // See also references
    const seeAlso = match.senses
      .flatMap((s: JishoSense) => s.see_also)
      .filter((s: string, i: number, a: string[]) => a.indexOf(s) === i)
      .slice(0, 3);
    if (seeAlso.length > 0) {
      parts.push(`See also: ${seeAlso.join(', ')}.`);
    }

    // Tags (e.g. "Food, cooking", "Usually written using kana alone")
    const allTags = match.senses
      .flatMap((s: JishoSense) => s.tags)
      .filter((t: string, i: number, a: string[]) => a.indexOf(t) === i);
    if (allTags.length > 0) {
      parts.push(`Tags: ${allTags.join(', ')}.`);
    }
  }

  // Example sentence from Jotoba
  const sentence = sentences[0];
  if (sentence) {
    parts.push(
      `Example: ${sentence.content}\n→ ${sentence.translation}`,
    );
  }

  return parts.join('\n');
}

function findBestMatch(
  characters: string,
  words: JishoWord[],
): JishoWord | undefined {
  // Prefer exact slug match, then match by japanese[].word, then first result
  return (
    words.find((w) => w.slug === characters) ??
    words.find((w) => w.japanese.some((j) => j.word === characters)) ??
    words[0]
  );
}
