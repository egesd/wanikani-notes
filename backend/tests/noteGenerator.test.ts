import { describe, it, expect } from 'vitest';
import { generateNote } from '../src/services/noteGenerator.js';
import type { WKSubject, JishoWord, JotobaSentence } from '@shared/types';

// ── Fixtures ──

function makeSubject(overrides: Partial<WKSubject['data']> = {}): WKSubject {
  return {
    id: 1,
    object: 'vocabulary',
    data: {
      characters: '食べる',
      slug: '食べる',
      level: 3,
      meanings: [
        { meaning: 'To Eat', primary: true, accepted_answer: true },
        { meaning: 'To Consume', primary: false, accepted_answer: true },
      ],
      readings: [{ reading: 'たべる', primary: true, accepted_answer: true }],
      parts_of_speech: ['ichidan verb', 'transitive verb'],
      ...overrides,
    },
  };
}

function makeWord(overrides: Partial<JishoWord> = {}): JishoWord {
  return {
    slug: '食べる',
    is_common: true,
    tags: [],
    jlpt: ['jlpt-n5'],
    japanese: [{ word: '食べる', reading: 'たべる' }],
    senses: [
      {
        english_definitions: ['to eat', 'to consume', 'to dine'],
        parts_of_speech: ['Ichidan verb', 'Transitive verb'],
        tags: [],
        info: [],
        see_also: [],
        restrictions: [],
      },
    ],
    ...overrides,
  };
}

function makeSentence(overrides: Partial<JotobaSentence> = {}): JotobaSentence {
  return {
    content: '毎日朝ご飯を食べます。',
    furigana: 'まいにちあさごはんをたべます。',
    translation: 'I eat breakfast every day.',
    language: 'English',
    ...overrides,
  };
}

// ── Tests ──

describe('generateNote', () => {
  it('produces a note with context section', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.noteText).toContain('Context:');
    expect(note.noteText).toContain('食べる');
    expect(note.noteText).toContain('To Eat');
  });

  it('includes reading in parentheses', () => {
    const note = generateNote(makeSubject(), [], []);
    expect(note.noteText).toContain('(たべる)');
  });

  it('includes parts of speech in brackets', () => {
    const note = generateNote(makeSubject(), [], []);
    expect(note.noteText).toContain('[ichidan verb, transitive verb]');
  });

  it('marks common words', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.noteText).toContain('common word');
  });

  it('marks uncommon words', () => {
    const word = makeWord({ is_common: false });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.noteText).toContain('uncommon word');
  });

  it('includes extra glosses from Jisho', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.noteText).toContain('to consume');
    expect(note.noteText).toContain('to dine');
  });

  it('includes JLPT level', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.noteText).toContain('JLPT-N5');
  });

  it('extracts synonyms from Jisho definitions', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.synonyms).toContain('to consume');
    expect(note.synonyms).toContain('to dine');
  });

  it('does not include primary meaning as a synonym', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    const lower = note.synonyms.map((s: string) => s.toLowerCase());
    expect(lower).not.toContain('to eat');
  });

  it('deduplicates synonyms case-insensitively', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    const lower = note.synonyms.map((s: string) => s.toLowerCase());
    const unique = new Set(lower);
    expect(lower.length).toBe(unique.size);
  });

  it('limits synonyms to 4', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['a', 'b', 'c', 'd', 'e', 'f'],
          parts_of_speech: [],
          tags: [],
          info: [],
          see_also: [],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.synonyms.length).toBeLessThanOrEqual(4);
  });

  it('skips generic terms in synonyms', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['thing', 'stuff', 'matter', 'something', 'real meaning'],
          parts_of_speech: [],
          tags: [],
          info: [],
          see_also: [],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    const lower = note.synonyms.map((s: string) => s.toLowerCase());
    expect(lower).not.toContain('thing');
    expect(lower).not.toContain('stuff');
    expect(lower).not.toContain('matter');
    expect(lower).not.toContain('something');
  });

  it('skips definitions with more than 2 words', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['to eat up completely'],
          parts_of_speech: [],
          tags: [],
          info: [],
          see_also: [],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.synonyms).not.toContain('to eat up completely');
  });

  it('includes WaniKani non-primary accepted meanings as synonyms', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    const lower = note.synonyms.map((s: string) => s.toLowerCase());
    expect(lower).toContain('to consume');
  });

  it('includes example sentence in extras', () => {
    const note = generateNote(makeSubject(), [makeWord()], [makeSentence()]);
    expect(note.noteText).toContain('Example:');
    expect(note.noteText).toContain('毎日朝ご飯を食べます。');
    expect(note.noteText).toContain('I eat breakfast every day.');
  });

  it('includes parts of speech from Jisho in extras', () => {
    const note = generateNote(makeSubject(), [makeWord()], []);
    expect(note.noteText).toContain('Parts of speech: Ichidan verb, Transitive verb.');
  });

  it('includes info/notes from Jisho', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['to eat'],
          parts_of_speech: ['Ichidan verb'],
          tags: [],
          info: ['colloquial'],
          see_also: [],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.noteText).toContain('Notes: colloquial.');
  });

  it('includes see_also references from Jisho', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['to eat'],
          parts_of_speech: ['Ichidan verb'],
          tags: [],
          info: [],
          see_also: ['飲む'],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.noteText).toContain('See also: 飲む.');
  });

  it('includes tags from Jisho', () => {
    const word = makeWord({
      senses: [
        {
          english_definitions: ['to eat'],
          parts_of_speech: ['Ichidan verb'],
          tags: ['Usually written using kana alone'],
          info: [],
          see_also: [],
          restrictions: [],
        },
      ],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.noteText).toContain('Tags: Usually written using kana alone.');
  });

  it('returns empty synonyms when no Jisho match', () => {
    const note = generateNote(makeSubject(), [], []);
    expect(note.synonyms).toEqual([]);
  });

  it('works with kana_vocabulary subjects (no readings)', () => {
    const subject = makeSubject({
      characters: 'ちゃんと',
      readings: undefined,
      meanings: [{ meaning: 'Properly', primary: true, accepted_answer: true }],
      parts_of_speech: ['adverb'],
    });
    subject.object = 'kana_vocabulary';
    const note = generateNote(subject, [], []);
    expect(note.noteText).toContain('ちゃんと');
    expect(note.noteText).toContain('Properly');
    expect(note.noteText).not.toContain('(undefined)');
  });

  it('prefers exact slug match over other entries', () => {
    const words: JishoWord[] = [
      makeWord({
        slug: '違う',
        japanese: [{ word: '違う', reading: 'ちがう' }],
        senses: [{ english_definitions: ['wrong match'], parts_of_speech: [], tags: [], info: [], see_also: [], restrictions: [] }],
      }),
      makeWord({
        slug: '食べる',
        japanese: [{ word: '食べる', reading: 'たべる' }],
        senses: [{ english_definitions: ['to eat', 'to dine'], parts_of_speech: [], tags: [], info: [], see_also: [], restrictions: [] }],
      }),
    ];
    const note = generateNote(makeSubject(), words, []);
    expect(note.noteText).toContain('to dine');
    expect(note.noteText).not.toContain('wrong match');
  });

  it('falls back to first word if no slug match', () => {
    const words: JishoWord[] = [
      makeWord({
        slug: '全然違う',
        japanese: [{ word: '全然違う', reading: 'ぜんぜんちがう' }],
        senses: [{ english_definitions: ['fallback gloss'], parts_of_speech: [], tags: [], info: [], see_also: [], restrictions: [] }],
      }),
    ];
    const note = generateNote(makeSubject(), words, []);
    expect(note.noteText).toContain('fallback gloss');
  });

  it('has all three sections when data is rich', () => {
    const note = generateNote(makeSubject(), [makeWord()], [makeSentence()]);
    expect(note.noteText).toContain('Context:');
    expect(note.noteText).toContain('Synonyms:');
    expect(note.noteText).toContain('Something more to add?');
  });

  it('omits synonyms section when there are none', () => {
    const subject = makeSubject({
      meanings: [{ meaning: 'To Eat', primary: true, accepted_answer: true }],
    });
    const word = makeWord({
      senses: [{ english_definitions: ['to eat'], parts_of_speech: [], tags: [], info: [], see_also: [], restrictions: [] }],
    });
    const note = generateNote(subject, [word], []);
    expect(note.noteText).not.toContain('Synonyms:');
  });

  it('omits extras section when no POS, info, tags, or sentences', () => {
    const word = makeWord({
      senses: [{ english_definitions: ['to eat', 'to dine'], parts_of_speech: [], tags: [], info: [], see_also: [], restrictions: [] }],
    });
    const note = generateNote(makeSubject(), [word], []);
    expect(note.noteText).not.toContain('Something more to add?');
  });
});
