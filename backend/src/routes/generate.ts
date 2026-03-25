import { Router } from 'express';
import { composeNote } from '../services/noteComposer.js';
import { getCachedNote, setCachedNote } from '../services/db.js';
import { generateLLMNote } from '../services/llmService.js';
import { buildPrompt } from '../services/promptBuilder.js';
import { findBestEntry } from '../services/lexicalService.js';
import { rankSentences } from '../services/sentenceService.js';
import { findCompareCandidateAsync } from '../services/compareWordService.js';
import type { GenerateRequest, GeneratedNote, LexicalEntry } from '@shared/types.js';

const router = Router();

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

router.post('/generate', async (req, res) => {
  try {
    const { subject, lexical, sentences } = req.body as GenerateRequest;

    if (!subject) {
      res.status(400).json({ error: 'subject is required' });
      return;
    }

    const word = subject.data.characters;

    // 1. Check DB cache
    const cached = getCachedNote(word);
    if (cached) {
      res.json({
        noteText: cached.note_text,
        synonyms: cached.synonyms,
      } satisfies GeneratedNote);
      return;
    }

    // 2. Build rule-based note (fallback + structured data for prompt)
    const safeLexical = (lexical ?? []).map(sanitizeEntry);
    const fallbackNote = await composeNote(subject, lexical ?? [], sentences ?? []);

    // 3. Try LLM generation
    const entry = findBestEntry(word, safeLexical);
    const ranked = rankSentences(sentences ?? [], word);
    const compare = entry
      ? await findCompareCandidateAsync(entry, safeLexical)
      : undefined;

    const prompt = buildPrompt({ subject, entry, sentences: ranked.slice(0, 5), compare });
    const llmText = await generateLLMNote(prompt);

    if (llmText) {
      // Cache and return LLM note
      setCachedNote(word, llmText, fallbackNote.synonyms);
      res.json({
        noteText: llmText,
        synonyms: fallbackNote.synonyms,
      } satisfies GeneratedNote);
      return;
    }

    // 4. Fallback to rule-based note
    res.json(fallbackNote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
