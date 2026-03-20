import type {
  WKSubject,
  WKMeaning,
  WKReading,
  JotobaWord,
  JotobaSense,
  JotobaSentence,
  GeneratedNote,
} from '@shared/types.js';

/**
 * Build a structured study note from dictionary and WaniKani data.
 * Pure template assembly — no LLM.
 */
export function generateNote(
  subject: WKSubject,
  words: JotobaWord[],
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

function buildContext(subject: WKSubject, words: JotobaWord[]): string {
  const chars = subject.data.characters;
  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
  const primaryReading =
    subject.data.readings?.find((r: WKReading) => r.primary)?.reading ?? '';

  const partsOfSpeech = subject.data.parts_of_speech ?? [];
  const posLabel = partsOfSpeech.length > 0 ? partsOfSpeech.join(', ') : null;

  // Find the best Jotoba match for richer gloss info
  const match = findBestMatch(chars, words);

  let line1 = `${chars}`;
  if (primaryReading) line1 += ` (${primaryReading})`;
  line1 += ` means "${primaryMeaning}"`;
  if (posLabel) line1 += ` [${posLabel}]`;
  line1 += '.';

  // Add a second sentence from Jotoba glosses if available
  let line2 = '';
  if (match) {
    const commonTag = match.common ? 'common word' : 'uncommon word';
    const extraGlosses = match.senses
      .flatMap((s: JotobaSense) => s.glosses)
      .filter(
        (g: string) => g.toLowerCase() !== primaryMeaning.toLowerCase(),
      )
      .slice(0, 3);

    if (extraGlosses.length > 0) {
      line2 = `It is a ${commonTag}, also glossed as: ${extraGlosses.join(', ')}.`;
    } else {
      line2 = `It is a ${commonTag}.`;
    }
  }

  return [line1, line2].filter(Boolean).join(' ');
}

function extractSynonyms(subject: WKSubject, words: JotobaWord[]): string[] {
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
    for (const gloss of sense.glosses) {
      const normalized = gloss.trim();
      // Only keep single-word or simple two-word glosses
      const wordCount = normalized.split(/\s+/).length;
      if (wordCount > 2) continue;
      // Skip if it's the same as the primary meaning
      if (normalized.toLowerCase() === primaryMeaning) continue;
      // Skip overly generic terms
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
  words: JotobaWord[],
  sentences: JotobaSentence[],
): string {
  const parts: string[] = [];

  // Part-of-speech / register info from Jotoba
  const match = findBestMatch(subject.data.characters, words);
  if (match) {
    const allPos = match.senses
      .flatMap((s: JotobaSense) => s.pos ?? [])
      .map((p: Record<string, string>) => {
        const [category, detail] = Object.entries(p)[0];
        return `${detail} ${category}`.trim();
      })
      .filter((p: string, i: number, a: string[]) => a.indexOf(p) === i);
    if (allPos.length > 0) {
      parts.push(`Parts of speech: ${allPos.join(', ')}.`);
    }
  }

  // Example sentence (first one from Jotoba)
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
  words: JotobaWord[],
): JotobaWord | undefined {
  // Prefer exact kanji match, then kana match
  return (
    words.find((w) => w.reading.kanji === characters) ??
    words.find((w) => w.reading.kana === characters) ??
    words[0]
  );
}
