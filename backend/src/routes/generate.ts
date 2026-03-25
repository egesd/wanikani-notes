import { Router } from 'express';
import { composeNote } from '../services/noteComposer.js';
import type { GenerateRequest, GeneratedNote } from '@shared/types.js';

const router = Router();

router.post('/generate', async (req, res) => {
  try {
    const { subject, lexical, sentences } = req.body as GenerateRequest;

    if (!subject) {
      res.status(400).json({ error: 'subject is required' });
      return;
    }

    const note: GeneratedNote = await composeNote(subject, lexical ?? [], sentences ?? []);
    res.json(note);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed';
    res.status(500).json({ error: message });
  }
});

export default router;
