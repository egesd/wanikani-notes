import { Router } from 'express';
import { searchSubjects } from '../services/wanikani.js';
import { searchWords, searchSentences } from '../services/jotoba.js';
import type { LookupRequest, LookupResponse } from '@shared/types.js';

const router = Router();

router.post('/lookup', async (req, res) => {
  try {
    const { word, token } = req.body as LookupRequest;

    if (!word || !token) {
      res.status(400).json({ error: 'word and token are required' });
      return;
    }

    // Run all three lookups in parallel
    const [subjects, words, sentences] = await Promise.all([
      searchSubjects(token, word),
      searchWords(word),
      searchSentences(word),
    ]);

    const response: LookupResponse = { subjects, words, sentences };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed';
    const status = message.includes('401') ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
