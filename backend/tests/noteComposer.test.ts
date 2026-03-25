import { describe, it, expect } from 'vitest';
import { composeNote } from '../src/services/noteComposer.js';
import type { WKSubject, LexicalEntry, SentenceExample } from '@shared/types';

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
  describe('Context section', () => {
    it('includes the word and primary meaning', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Context:');
      expect(note.noteText).toContain('捕獲');
      expect(note.noteText).toContain('Capture');
    });

    it('includes reading in parentheses', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('(ほかく)');
    });

    it('includes extra glosses from lexical data', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('seizure');
    });

    it('marks common words', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('commonly used');
    });

    it('marks uncommon words', () => {
      const entry = makeLexical({ common: false });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('less common');
    });

    it('includes JLPT level', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('JLPT-N1');
    });

    it('includes field-based context when fields exist', () => {
      const entry = makeLexical({ fields: ['law', 'politics'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('law');
    });
  });

  describe('Register section', () => {
    it('omits register when no signal exists', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).not.toContain('Register:');
    });

    it('detects formal register from tags', () => {
      const entry = makeLexical({ tags: ['formal'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Register:');
      expect(note.noteText).toContain('Formal');
    });

    it('detects colloquial register', () => {
      const entry = makeLexical({ info: ['colloquial'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Casual / colloquial');
    });

    it('detects honorific register', () => {
      const entry = makeLexical({ tags: ['honorific language (sonkeigo)'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('honorific');
    });

    it('detects domain-specific register from fields', () => {
      const entry = makeLexical({ fields: ['medicine'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Register:');
      expect(note.noteText).toContain('medicine');
    });
  });

  describe('Synonyms section', () => {
    it('extracts synonyms from glosses', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.synonyms).toContain('seizure');
      expect(note.synonyms).toContain('catching');
    });

    it('does not include primary meaning as synonym', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).not.toContain('capture');
    });

    it('includes WaniKani non-primary accepted meanings', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).toContain('seizure');
    });

    it('limits synonyms to 4', () => {
      const entry = makeLexical({
        glosses: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.synonyms.length).toBeLessThanOrEqual(4);
    });

    it('skips generic terms', () => {
      const entry = makeLexical({
        glosses: ['thing', 'stuff', 'matter', 'real meaning'],
      });
      const note = composeNote(makeSubject(), [entry], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      expect(lower).not.toContain('thing');
      expect(lower).not.toContain('stuff');
    });

    it('deduplicates synonyms case-insensitively', () => {
      const entry = makeLexical({
        glosses: ['Seizure', 'seizure', 'SEIZURE'],
      });
      const note = composeNote(makeSubject(), [entry], []);
      const lower = note.synonyms.map((s) => s.toLowerCase());
      const unique = new Set(lower);
      expect(lower.length).toBe(unique.size);
    });

    it('omits synonyms section when there are none', () => {
      const subject = makeSubject({
        meanings: [{ meaning: 'Capture', primary: true, accepted_answer: true }],
      });
      const entry = makeLexical({ glosses: ['capture'] });
      const note = composeNote(subject, [entry], []);
      expect(note.noteText).not.toContain('Synonyms:');
    });
  });

  describe('Compare section', () => {
    it('includes compare when seeAlso exists', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Compare:');
      expect(note.noteText).toContain('捕獲 vs 捕まえる');
    });

    it('omits compare when no seeAlso', () => {
      const entry = makeLexical({ seeAlso: [] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).not.toContain('Compare:');
    });
  });

  describe('Common patterns section', () => {
    it('generates suru verb pattern', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Common patterns:');
      expect(note.noteText).toContain('- Xを捕獲する');
    });

    it('omits patterns for non-suru verbs with no sentences', () => {
      const entry = makeLexical({ partsOfSpeech: ['Noun'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).not.toContain('Common patterns:');
    });

    it('extracts patterns from sentence evidence', () => {
      const sentences: SentenceExample[] = [
        { japanese: '野生動物を捕獲する方法', english: 'How to capture wild animals', source: 'tatoeba' },
        { japanese: '犯人を捕獲した', english: 'Captured the criminal', source: 'tatoeba' },
      ];
      const note = composeNote(makeSubject(), [makeLexical()], sentences);
      expect(note.noteText).toContain('Common patterns:');
      expect(note.noteText).toContain('→ How to capture wild animals');
    });
  });

  describe('Something more to add? section', () => {
    it('includes parts of speech', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('Something more to add?');
      expect(note.noteText).toContain('Parts of speech:');
    });

    it('includes see also references', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).toContain('See also: 捕まえる');
    });

    it('includes notes/info when present', () => {
      const entry = makeLexical({ info: ['often used in news'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Notes: often used in news');
    });

    it('includes tags when present', () => {
      const entry = makeLexical({ tags: ['Usually written using kana alone'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Tags: Usually written using kana alone');
    });

    it('includes antonyms when present', () => {
      const entry = makeLexical({ antonyms: ['解放'] });
      const note = composeNote(makeSubject(), [entry], []);
      expect(note.noteText).toContain('Antonyms: 解放');
    });
  });

  describe('Example section', () => {
    it('includes best example sentence', () => {
      const note = composeNote(makeSubject(), [makeLexical()], [makeSentence()]);
      expect(note.noteText).toContain('Example:');
      expect(note.noteText).toContain('彼らはキツネを捕獲した。');
      expect(note.noteText).toContain('→ They captured a fox.');
    });

    it('omits example when no sentences available', () => {
      const note = composeNote(makeSubject(), [makeLexical()], []);
      expect(note.noteText).not.toContain('Example:');
    });

    it('prefers shorter sentences over long ones', () => {
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
      const note = composeNote(makeSubject(), [makeLexical()], sentences);
      expect(note.noteText).toContain('動物を捕獲した。');
    });
  });

  describe('Edge cases', () => {
    it('works with no lexical data', () => {
      const note = composeNote(makeSubject(), [], []);
      expect(note.noteText).toContain('Context:');
      expect(note.noteText).toContain('捕獲');
      expect(note.noteText).toContain('Capture');
    });

    it('works with kana_vocabulary subjects (no readings)', () => {
      const subject = makeSubject({
        characters: 'ちゃんと',
        readings: undefined,
        meanings: [{ meaning: 'Properly', primary: true, accepted_answer: true }],
        parts_of_speech: ['adverb'],
      });
      subject.object = 'kana_vocabulary';
      const note = composeNote(subject, [], []);
      expect(note.noteText).toContain('ちゃんと');
      expect(note.noteText).toContain('Properly');
    });

    it('omits empty sections for sparse data', () => {
      const entry = makeLexical({
        seeAlso: [],
        tags: [],
        info: [],
        fields: [],
        antonyms: [],
        partsOfSpeech: [],
      });
      const subject = makeSubject({ parts_of_speech: [] });
      const note = composeNote(subject, [entry], []);
      expect(note.noteText).not.toContain('Compare:');
      expect(note.noteText).not.toContain('Something more to add?');
      expect(note.noteText).not.toContain('Example:');
    });

    it('returns empty synonyms when no lexical match', () => {
      const subject = makeSubject({
        meanings: [{ meaning: 'Capture', primary: true, accepted_answer: true }],
      });
      const note = composeNote(subject, [], []);
      expect(note.synonyms).toEqual([]);
    });

    it('prefers exact word match in lexical entries', () => {
      const entries: LexicalEntry[] = [
        makeLexical({ word: '別物', glosses: ['wrong match'] }),
        makeLexical({ word: '捕獲', glosses: ['capture', 'seizure'] }),
      ];
      const note = composeNote(makeSubject(), entries, []);
      expect(note.noteText).toContain('seizure');
      expect(note.noteText).not.toContain('wrong match');
    });
  });
});
