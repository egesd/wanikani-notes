import { describe, it, expect, vi, beforeEach } from 'vitest';
import { composeNote } from '../src/services/noteComposer.js';
import type { WKSubject, LexicalEntry, SentenceExample } from '@shared/types';

// Mock fetchLexical so compareWordService.findCompareCandidateAsync
// doesn't hit real APIs during tests
vi.mock('../src/services/lexicalService.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/lexicalService.js')>();
  return {
    ...original,
    fetchLexical: vi.fn().mockResolvedValue([]),
  };
});

import { fetchLexical } from '../src/services/lexicalService.js';
const mockFetchLexical = vi.mocked(fetchLexical);

// ── Fixtures ──

function makeSubject(overrides: Partial<WKSubject['data']> = {}): WKSubject {
  return {
    id: 1,
    object: 'vocabulary',
    data: {
      characters: '捕獲',
      slug: '捕獲',
      level: 30,
      meanings: [
        { meaning: 'Capture', primary: true, accepted_answer: true },
        { meaning: 'Seizure', primary: false, accepted_answer: true },
      ],
      readings: [{ reading: 'ほかく', primary: true, accepted_answer: true }],
      parts_of_speech: ['noun', 'suru verb'],
      ...overrides,
    },
  };
}

function makeLexical(overrides: Partial<LexicalEntry> = {}): LexicalEntry {
  return {
    word: '捕獲',
    reading: 'ほかく',
    glosses: ['capture', 'seizure', 'catching'],
    partsOfSpeech: ['Noun', 'Suru verb', 'Transitive verb'],
    jlpt: 'JLPT-N1',
    common: true,
    tags: [],
    info: [],
    seeAlso: ['捕まえる'],
    fields: [],
    antonyms: [],
    source: 'jotoba',
    ...overrides,
  };
}

function makeSentence(overrides: Partial<SentenceExample> = {}): SentenceExample {
  return {
    japanese: '彼らはキツネを捕獲した。',
    english: 'They captured a fox.',
    source: 'tatoeba',
    ...overrides,
  };
}

// ── Tests ──

describe('composeNote', () => {
  beforeEach(() => {
    mockFetchLexical.mockReset().mockResolvedValue([]);
  });

  describe('Core meaning section', () => {
    it('includes primary meaning', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Core meaning:');
      expect(note.noteText).toContain('Capture');
    });

    it('adds extra gloss for nuance', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toMatch(/Core meaning:\n.*seizure/i);
    });

    it('works without lexical data', async () => {
      const note = await composeNote(makeSubject(), [], []);
      expect(note.noteText).toContain('Core meaning:\nCapture');
    });
  });

  describe('Used for section', () => {
    it('always present', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Used for:');
    });

    it('marks common words', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Commonly used');
    });

    it('marks uncommon words', async () => {
      const entry = makeLexical({ common: false });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Less common');
    });

    it('includes JLPT level', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('JLPT-N1');
    });

    it('includes domain context from fields', async () => {
      const entry = makeLexical({ fields: ['law', 'politics'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('law');
    });

    it('defaults to general use without data', async () => {
      const note = await composeNote(makeSubject(), [], []);
      expect(note.noteText).toContain('General use.');
    });
  });

  describe('Register section', () => {
    it('omits register when no signal exists', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).not.toContain('Register:');
    });

    it('detects formal register from tags', async () => {
      const entry = makeLexical({ tags: ['formal'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Register:');
      expect(note.noteText).toContain('Formal');
    });

    it('detects colloquial register', async () => {
      const entry = makeLexical({ info: ['colloquial'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Casual / colloquial');
    });

    it('detects honorific register', async () => {
      const entry = makeLexical({ tags: ['honorific language (sonkeigo)'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('honorific');
    });

    it('detects domain-specific register from fields', async () => {
      const entry = makeLexical({ fields: ['medicine'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Register:');
      expect(note.noteText).toContain('medicine');
    });
  });

  describe('Synonyms', () => {
    it('extracts synonyms from glosses', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.synonyms).toContain('seizure');
      expect(note.synonyms).toContain('catching');
    });

    it('does not include primary meaning as synonym', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).not.toContain('capture');
    });

    it('includes WaniKani non-primary accepted meanings', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).toContain('seizure');
    });

    it('limits synonyms to 4', async () => {
      const entry = makeLexical({
        glosses: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.synonyms.length).toBeLessThanOrEqual(4);
    });

    it('skips generic terms', async () => {
      const entry = makeLexical({
        glosses: ['thing', 'stuff', 'matter', 'real meaning'],
      });
      const note = await composeNote(makeSubject(), [entry], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).not.toContain('thing');
      expect(lower).not.toContain('stuff');
    });

    it('deduplicates synonyms case-insensitively', async () => {
      const entry = makeLexical({
        glosses: ['Seizure', 'seizure', 'SEIZURE'],
      });
      const note = await composeNote(makeSubject(), [entry], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      const unique = new Set(lower);
      expect(lower.length).toBe(unique.size);
    });
  });

  describe('Do not confuse with section', () => {
    it('fetches seeAlso words and uses them for compare', async () => {
      // Mock: when fetchLexical is called for 捕まえる, return a real entry
      mockFetchLexical.mockImplementation(async (word: string) => {
        if (word === '捕まえる') {
          return [makeLexical({ word: '捕まえる', reading: 'つかまえる', glosses: ['to catch', 'to capture'], seeAlso: [] })];
        }
        return [];
      });

      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Do not confuse with:');
      expect(note.noteText).toContain('捕まえる');
    });

    it('omits compare when no seeAlso and no candidates', async () => {
      const entry = makeLexical({ seeAlso: [] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).not.toContain('Do not confuse with:');
    });

    it('uses scored candidate when multiple lexical entries exist', async () => {
      const entries: LexicalEntry[] = [
        makeLexical({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] }),
        makeLexical({ word: '捕捉', reading: 'ほそく', glosses: ['capture', 'apprehension'], seeAlso: [] }),
      ];
      const note = await composeNote(makeSubject(), entries, []);
      expect(note.noteText).toContain('Do not confuse with:');
      expect(note.noteText).toContain('捕捉');
    });

    it('finds homophones via reading lookup', async () => {
      const entry = makeLexical({ seeAlso: [] });
      mockFetchLexical.mockImplementation(async (word: string) => {
        if (word === 'ほかく') {
          return [
            makeLexical({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] }),
            makeLexical({ word: '補角', reading: 'ほかく', glosses: ['supplementary angle'], seeAlso: [] }),
          ];
        }
        return [];
      });

      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Do not confuse with:');
      expect(note.noteText).toContain('補角');
    });
  });

  describe('Common patterns section', () => {
    it('generates suru verb pattern', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Common patterns:');
      expect(note.noteText).toContain('- Xを捕獲する');
    });

    it('omits patterns for non-suru verbs with no sentences', async () => {
      const entry = makeLexical({ partsOfSpeech: ['Noun'], seeAlso: [] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.noteText).not.toContain('Common patterns:');
    });

    it('extracts patterns from sentence evidence', async () => {
      const sentences: SentenceExample[] = [
        { japanese: '野生動物を捕獲する方法', english: 'How to capture wild animals', source: 'tatoeba' },
        { japanese: '犯人を捕獲した', english: 'Captured the criminal', source: 'tatoeba' },
      ];
      const note = await composeNote(makeSubject(), [makeLexical()], sentences);
      expect(note.noteText).toContain('Common patterns:');
      expect(note.noteText).toContain('→ How to capture wild animals');
    });
  });

  describe('Example section', () => {
    it('includes best example sentence', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], [makeSentence()]);
      expect(note.noteText).toContain('Example:');
      expect(note.noteText).toContain('彼らはキツネを捕獲した。');
      expect(note.noteText).toContain('→ They captured a fox.');
    });

    it('omits example when no sentences available', async () => {
      const note = await composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).not.toContain('Example:');
    });

    it('prefers shorter sentences over long ones', async () => {
      const sentences: SentenceExample[] = [
        {
          japanese: 'この捕獲は非常に長い文章であり、様々な理由から適切ではないと考えられる場合がある文章です。',
          english: 'Very long sentence',
          source: 'tatoeba',
        },
        {
          japanese: '動物を捕獲した。',
          english: 'Captured an animal.',
          source: 'tatoeba',
        },
      ];
      const note = await composeNote(makeSubject(), [makeLexical()], sentences);
      expect(note.noteText).toContain('動物を捕獲した。');
    });
  });

  describe('Omitted sections tracking', () => {
    it('reports omitted sections', async () => {
      const entry = makeLexical({ seeAlso: [], partsOfSpeech: ['Noun'] });
      const note = await composeNote(makeSubject(), [entry], []);
      expect(note.omitted).toBeDefined();
      expect(note.omitted).toContain('Example');
    });

    it('does not report present sections as omitted', async () => {
      const entry = makeLexical({ tags: ['formal'] });
      const note = await composeNote(makeSubject(), [entry], [makeSentence()]);
      expect(note.omitted ?? []).not.toContain('Register');
      expect(note.omitted ?? []).not.toContain('Example');
    });
  });

  describe('Edge cases', () => {
    it('works with no lexical data', async () => {
      const note = await composeNote(makeSubject(), [], []);
      expect(note.noteText).toContain('Core meaning:');
      expect(note.noteText).toContain('Capture');
    });

    it('works with kana_vocabulary subjects (no readings)', async () => {
      const subject = makeSubject({
        characters: 'ちゃんと',
        readings: undefined,
        meanings: [{ meaning: 'Properly', primary: true, accepted_answer: true }],
        parts_of_speech: ['adverb'],
      });
      subject.object = 'kana_vocabulary';
      const note = await composeNote(subject, [], []);
      expect(note.noteText).toContain('Properly');
    });

    it('omits empty optional sections for sparse data', async () => {
      const entry = makeLexical({
        seeAlso: [],
        tags: [],
        info: [],
        fields: [],
        antonyms: [],
        partsOfSpeech: ['Noun'],
      });
      const subject = makeSubject({ parts_of_speech: [] });
      const note = await composeNote(subject, [entry], []);
      expect(note.noteText).not.toContain('Do not confuse with:');
      expect(note.noteText).not.toContain('Example:');
    });

    it('returns empty synonyms when no lexical match', async () => {
      const subject = makeSubject({
        meanings: [{ meaning: 'Capture', primary: true, accepted_answer: true }],
      });
      const note = await composeNote(subject, [], []);
      expect(note.synonyms).toEqual([]);
    });

    it('prefers exact word match in lexical entries', async () => {
      const entries: LexicalEntry[] = [
        makeLexical({ word: '別物', glosses: ['wrong match'], seeAlso: [] }),
        makeLexical({ word: '捕獲', glosses: ['capture', 'seizure'] }),
      ];
      const note = await composeNote(makeSubject(), entries, []);
      expect(note.noteText).toContain('seizure');
    });

    it('note format has correct section order', async () => {
      const entry = makeLexical({ tags: ['formal'] });
      const note = await composeNote(makeSubject(), [entry], [makeSentence()]);
      const text = note.noteText;

      const coreIdx = text.indexOf('Core meaning:');
      const usedIdx = text.indexOf('Used for:');
      const regIdx = text.indexOf('Register:');
      const exIdx = text.indexOf('Example:');

      expect(coreIdx).toBeLessThan(usedIdx);
      expect(usedIdx).toBeLessThan(regIdx);
      expect(regIdx).toBeLessThan(exIdx);
    });
  });
});
