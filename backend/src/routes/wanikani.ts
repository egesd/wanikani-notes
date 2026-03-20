import { Router } from 'express';
import {
  getStudyMaterials,
  createStudyMaterial,
  updateStudyMaterial,
} from '../services/wanikani.js';
import type { SaveRequest, SaveResponse } from '@shared/types.js';

const router = Router();

router.post('/save', async (req, res) => {
  try {
    const { token, subjectId, meaningNote, meaningSynonyms } =
      req.body as SaveRequest;

    if (!token || !subjectId) {
      res.status(400).json({ error: 'token and subjectId are required' });
      return;
    }

    const existing = await getStudyMaterials(token, subjectId);

    let studyMaterial;
    let action: 'created' | 'updated';

    if (existing) {
      studyMaterial = await updateStudyMaterial(
        token,
        existing.id,
        meaningNote,
        meaningSynonyms,
      );
      action = 'updated';
    } else {
      studyMaterial = await createStudyMaterial(
        token,
        subjectId,
        meaningNote,
        meaningSynonyms,
      );
      action = 'created';
    }

    const response: SaveResponse = {
      success: true,
      action,
      studyMaterial,
    };
    res.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Save failed';
    const status = message.includes('401') ? 401 : 500;
    res.status(status).json({ error: message });
  }
});

export default router;
