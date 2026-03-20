import { Router } from 'express';
import { generateNote } from '../services/noteGenerator.js';
import type { GenerateRequest, GeneratedNote } from '@shared/types.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { subject, words, sentences } = req.body as GenerateRequest;

    if (!subject) {
      res.status(400).json({ error: 'subject is required' });
      return;
    }

    const note: GeneratedNote = generateNote(subject, words ?? [], sentences ?? []);
    res.json(note);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
