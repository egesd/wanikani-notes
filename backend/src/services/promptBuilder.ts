import type {
  WKSubject,
  WKMeaning,
  WKReading,
  LexicalEntry,
  SentenceExample,
  CompareWord,
} from '@shared/types.js';

export const SYSTEM_PROMPT = `You are a Japanese vocabulary note writer for language learners studying with WaniKani. You receive structured data about a Japanese word and produce a concise study note.

Your note should help the learner:
1. Understand what makes this word distinct from similar words
2. Know when and where to use it (situations, formality, typical objects/subjects)
3. Avoid confusing it with homophones or near-synonyms

Rules:
- Write entirely in English. The only Japanese allowed is the word itself and inline example sentences.
- Write 2-4 short sentences max. No bullet points, no headers, no labels like "Example:".
- Do NOT restate the English meaning or reading — the learner already knows those from WaniKani. Jump straight into what's distinctive: nuance, typical usage context, what kinds of things it applies to, or how it differs from similar words.
- If there's a confusion pair, explain when to pick which word. But if the confusion candidate is obscure or the learner is unlikely to encounter it, ignore it and focus on more useful distinctions (e.g. comparing with common synonyms from the dictionary data or seeAlso).
- Mention formality/register only if it's notable (don't say "neutral register").
- Weave in one natural example sentence if it helps clarify — inline, not labeled. Write the Japanese sentence followed by → and the English translation (e.g. 彼は走った → He ran).
- Write for someone who knows ~1000 kanji and basic grammar. Don't over-explain.
- Be direct and natural. No filler phrases like "This word is used to..." or "X means Y" — jump right into the nuance.`;

export interface PromptInput {
  subject: WKSubject;
  entry?: LexicalEntry;
  sentences: SentenceExample[];
  compare?: CompareWord;
}

export function buildPrompt(input: PromptInput): string {
  const { subject, entry, sentences, compare } = input;

  const primaryMeaning =
    subject.data.meanings.find((m: WKMeaning) => m.primary)?.meaning ?? '';
  const primaryReading =
    subject.data.readings?.find((r: WKReading) => r.primary)?.reading ?? '';

  const lines: string[] = [];

  lines.push(`Word: ${subject.data.characters} (${primaryReading})`);
  lines.push(`WaniKani meaning: ${primaryMeaning}`);
  lines.push(`WaniKani level: ${subject.data.level}`);
  lines.push('');

  if (entry) {
    lines.push(`Dictionary glosses: ${entry.glosses.join(', ')}`);
    lines.push(`Parts of speech: ${entry.partsOfSpeech.join(', ')}`);
    if (entry.jlpt) lines.push(`JLPT: ${entry.jlpt}`);
    lines.push(`Common: ${entry.common ? 'yes' : 'no'}`);
    lines.push(`Fields: [${(entry.fields ?? []).join(', ')}]`);
    lines.push(`Info: [${(entry.info ?? []).join(', ')}]`);
  } else {
    lines.push('Dictionary data: unavailable');
  }

  lines.push('');

  if (compare) {
    lines.push(
      `Confusion candidate: ${compare.word}${compare.reading ? ` (${compare.reading})` : ''} — "${compare.explanation}"`,
    );
  }

  if (entry?.seeAlso && entry.seeAlso.length > 0) {
    lines.push(`Also similar: ${entry.seeAlso.join(', ')}`);
  }

  lines.push('');

  if (sentences.length > 0) {
    lines.push('Example sentences:');
    for (const s of sentences.slice(0, 5)) {
      let line = `- ${s.japanese}`;
      if (s.english) line += ` → ${s.english}`;
      lines.push(line);
    }
  } else {
    lines.push('Example sentences: none available');
  }

  return lines.join('\n');
}
