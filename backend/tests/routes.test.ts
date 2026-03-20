import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { WKSubject, JotobaWord, JotobaSentence } from '@shared/types';

// ── Mock external services ──

vi.mock('../src/services/wanikani.js', () => ({
  searchSubjects: vi.fn(),
  getStudyMaterials: vi.fn(),
  createStudyMaterial: vi.fn(),
  updateStudyMaterial: vi.fn(),
}));

vi.mock('../src/services/jotoba.js', () => ({
  searchWords: vi.fn(),
  searchSentences: vi.fn(),
}));

// Import after mocking
import { searchSubjects, getStudyMaterials, createStudyMaterial, updateStudyMaterial } from '../src/services/wanikani.js';
import { searchWords, searchSentences } from '../src/services/jotoba.js';
import dictionaryRoutes from '../src/routes/dictionary.js';
import generateRoutes from '../src/routes/generate.js';
import wanikaniRoutes from '../src/routes/wanikani.js';

// ── Test helpers ──

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', dictionaryRoutes);
  app.use('/api', generateRoutes);
  app.use('/api', wanikaniRoutes);
  return app;
}

function post(app: express.Express, path: string, body: unknown) {
  return new Promise<{ status: number; body: any }>((resolve) => {
    const req = new (require('http').IncomingMessage as any)();
    // Use supertest-like approach with raw http
    const http = require('http');
    const server = app.listen(0, () => {
      const addr = server.address() as any;
      const reqOpts = {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      };
      const r = http.request(reqOpts, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          server.close();
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      });
      r.write(JSON.stringify(body));
      r.end();
    });
  });
}

const mockSubject: WKSubject = {
  id: 42,
  object: 'vocabulary',
  data: {
    characters: '走る',
    slug: '走る',
    level: 5,
    meanings: [{ meaning: 'To Run', primary: true, accepted_answer: true }],
    readings: [{ reading: 'はしる', primary: true, accepted_answer: true }],
    parts_of_speech: ['godan verb'],
  },
};

const mockWord: JotobaWord = {
  reading: { kanji: '走る', kana: 'はしる' },
  common: true,
  senses: [{ glosses: ['to run', 'to dash'], pos: [{ Verb: 'Godan' }], language: 'English' }],
};

const mockSentence: JotobaSentence = {
  content: '犬が走る。',
  furigana: 'いぬがはしる。',
  translation: 'The dog runs.',
  language: 'English',
};

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/lookup', () => {
  it('returns 400 when word is missing', async () => {
    const app = createApp();
    const res = await post(app, '/api/lookup', { token: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('word and token are required');
  });

  it('returns 400 when token is missing', async () => {
    const app = createApp();
    const res = await post(app, '/api/lookup', { word: '走る' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('word and token are required');
  });

  it('returns subjects, words, and sentences on success', async () => {
    vi.mocked(searchSubjects).mockResolvedValue([mockSubject]);
    vi.mocked(searchWords).mockResolvedValue([mockWord]);
    vi.mocked(searchSentences).mockResolvedValue([mockSentence]);

    const app = createApp();
    const res = await post(app, '/api/lookup', { word: '走る', token: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body.subjects).toHaveLength(1);
    expect(res.body.words).toHaveLength(1);
    expect(res.body.sentences).toHaveLength(1);
    expect(res.body.subjects[0].data.characters).toBe('走る');
  });

  it('calls all three services in parallel', async () => {
    vi.mocked(searchSubjects).mockResolvedValue([]);
    vi.mocked(searchWords).mockResolvedValue([]);
    vi.mocked(searchSentences).mockResolvedValue([]);

    const app = createApp();
    await post(app, '/api/lookup', { word: '走る', token: 'tok' });

    expect(searchSubjects).toHaveBeenCalledWith('tok', '走る');
    expect(searchWords).toHaveBeenCalledWith('走る');
    expect(searchSentences).toHaveBeenCalledWith('走る');
  });

  it('returns 401 when WaniKani auth fails', async () => {
    vi.mocked(searchSubjects).mockRejectedValue(new Error('WaniKani subjects error: 401'));
    vi.mocked(searchWords).mockResolvedValue([]);
    vi.mocked(searchSentences).mockResolvedValue([]);

    const app = createApp();
    const res = await post(app, '/api/lookup', { word: '走る', token: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('401');
  });

  it('returns 500 for unexpected errors', async () => {
    vi.mocked(searchSubjects).mockRejectedValue(new Error('network down'));
    vi.mocked(searchWords).mockResolvedValue([]);
    vi.mocked(searchSentences).mockResolvedValue([]);

    const app = createApp();
    const res = await post(app, '/api/lookup', { word: '走る', token: 'tok' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('network down');
  });
});

describe('POST /api/generate', () => {
  it('returns 400 when subject is missing', async () => {
    const app = createApp();
    const res = await post(app, '/api/generate', {});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('subject is required');
  });

  it('generates a note with only a subject', async () => {
    const app = createApp();
    const res = await post(app, '/api/generate', { subject: mockSubject });
    expect(res.status).toBe(200);
    expect(res.body.noteText).toContain('走る');
    expect(res.body.noteText).toContain('To Run');
    expect(Array.isArray(res.body.synonyms)).toBe(true);
  });

  it('generates a note with words and sentences', async () => {
    const app = createApp();
    const res = await post(app, '/api/generate', {
      subject: mockSubject,
      words: [mockWord],
      sentences: [mockSentence],
    });
    expect(res.status).toBe(200);
    expect(res.body.noteText).toContain('犬が走る。');
    expect(res.body.noteText).toContain('The dog runs.');
    expect(res.body.synonyms).toContain('to dash');
  });

  it('handles missing words/sentences gracefully', async () => {
    const app = createApp();
    const res = await post(app, '/api/generate', {
      subject: mockSubject,
      words: null,
      sentences: null,
    });
    expect(res.status).toBe(200);
    expect(res.body.noteText).toContain('To Run');
  });
});

describe('POST /api/save', () => {
  it('returns 400 when token is missing', async () => {
    const app = createApp();
    const res = await post(app, '/api/save', { subjectId: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('token and subjectId are required');
  });

  it('returns 400 when subjectId is missing', async () => {
    const app = createApp();
    const res = await post(app, '/api/save', { token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('token and subjectId are required');
  });

  it('creates a new study material when none exists', async () => {
    const created = { id: 100, object: 'study_material' as const, data: { subject_id: 42, subject_type: 'vocabulary', meaning_note: 'note', reading_note: null, meaning_synonyms: ['syn'] } };
    vi.mocked(getStudyMaterials).mockResolvedValue(null);
    vi.mocked(createStudyMaterial).mockResolvedValue(created);

    const app = createApp();
    const res = await post(app, '/api/save', {
      token: 'tok',
      subjectId: 42,
      meaningNote: 'note',
      meaningSynonyms: ['syn'],
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('created');
    expect(res.body.success).toBe(true);
    expect(createStudyMaterial).toHaveBeenCalledWith('tok', 42, 'note', ['syn']);
  });

  it('updates existing study material', async () => {
    const existing = { id: 100, object: 'study_material' as const, data: { subject_id: 42, subject_type: 'vocabulary', meaning_note: 'old', reading_note: null, meaning_synonyms: [] } };
    const updated = { ...existing, data: { ...existing.data, meaning_note: 'new note', meaning_synonyms: ['a'] } };
    vi.mocked(getStudyMaterials).mockResolvedValue(existing);
    vi.mocked(updateStudyMaterial).mockResolvedValue(updated);

    const app = createApp();
    const res = await post(app, '/api/save', {
      token: 'tok',
      subjectId: 42,
      meaningNote: 'new note',
      meaningSynonyms: ['a'],
    });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe('updated');
    expect(updateStudyMaterial).toHaveBeenCalledWith('tok', 100, 'new note', ['a']);
    expect(createStudyMaterial).not.toHaveBeenCalled();
  });

  it('returns 401 for auth errors', async () => {
    vi.mocked(getStudyMaterials).mockRejectedValue(new Error('study_materials error: 401'));

    const app = createApp();
    const res = await post(app, '/api/save', {
      token: 'bad',
      subjectId: 42,
      meaningNote: 'note',
      meaningSynonyms: [],
    });

    expect(res.status).toBe(401);
  });
});
