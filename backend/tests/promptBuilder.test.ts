import { describe, it, expect } from 'vitest';
import { buildPrompt, SYSTEM_PROMPT, type PromptInput } from '../src/services/promptBuilder.js';
import type { WKSubject, LexicalEntry, SentenceExample } from '@shared/types';

function makeSubject(overrides: Partial<WKSubject['data']> = {}): WKSubject {
  return {
    id: 1,
    object: 'vocabulary',
    data: {
      characters: '捕獲',
      slug: '捕獲',
      level: 30,
      meanings: [{ meaning: 'Capture', primary: true, accepted_answer: true }],
      readings: [{ reading: 'ほかく', primary: true, accepted_answer: true }],
      parts_of_speech: ['noun', 'suru verb'],
      ...overrides,
    },
  };
}

function makeEntry(overrides: Partial<LexicalEntry> = {}): LexicalEntry {
  return {
    word: '捕獲',
    reading: 'ほかく',
    glosses: ['capture', 'seizure', 'catching'],
    partsOfSpeech: ['Noun', 'Suru verb'],
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

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });
});

describe('buildPrompt', () => {
  it('includes word and reading', () => {
    const prompt = buildPrompt({ subject: makeSubject(), sentences: [] });
    expect(prompt).toContain('捕獲');
    expect(prompt).toContain('ほかく');
  });

  it('includes WaniKani meaning and level', () => {
    const prompt = buildPrompt({ subject: makeSubject(), sentences: [] });
    expect(prompt).toContain('WaniKani meaning: Capture');
    expect(prompt).toContain('WaniKani level: 30');
  });

  it('includes dictionary data when entry provided', () => {
    const prompt = buildPrompt({
      subject: makeSubject(),
      entry: makeEntry(),
      sentences: [],
    });
    expect(prompt).toContain('capture, seizure, catching');
    expect(prompt).toContain('Noun, Suru verb');
    expect(prompt).toContain('JLPT-N1');
    expect(prompt).toContain('Common: yes');
  });

  it('handles missing entry gracefully', () => {
    const prompt = buildPrompt({ subject: makeSubject(), sentences: [] });
    expect(prompt).toContain('Dictionary data: unavailable');
  });

  it('includes confusion candidate', () => {
    const prompt = buildPrompt({
      subject: makeSubject(),
      entry: makeEntry(),
      sentences: [],
      compare: { word: '保革', reading: 'ほかく', explanation: 'conservatism and progressivism' },
    });
    expect(prompt).toContain('保革');
    expect(prompt).toContain('conservatism and progressivism');
  });

  it('includes seeAlso references', () => {
    const prompt = buildPrompt({
      subject: makeSubject(),
      entry: makeEntry({ seeAlso: ['捕まえる'] }),
      sentences: [],
    });
    expect(prompt).toContain('Also similar: 捕まえる');
  });

  it('includes example sentences', () => {
    const sentences: SentenceExample[] = [
      { japanese: '彼らはキツネを捕獲した。', english: 'They captured a fox.', source: 'tatoeba' },
    ];
    const prompt = buildPrompt({
      subject: makeSubject(),
      entry: makeEntry(),
      sentences,
    });
    expect(prompt).toContain('彼らはキツネを捕獲した。');
    expect(prompt).toContain('They captured a fox.');
  });

  it('limits sentences to 5', () => {
    const sentences: SentenceExample[] = Array.from({ length: 10 }, (_, i) => ({
      japanese: `文${i}`,
      english: `Sentence ${i}`,
      source: 'tatoeba' as const,
    }));
    const prompt = buildPrompt({
      subject: makeSubject(),
      entry: makeEntry(),
      sentences,
    });
    // Should only include 5
    expect(prompt).toContain('文4');
    expect(prompt).not.toContain('文5');
  });

  it('handles no sentences', () => {
    const prompt = buildPrompt({ subject: makeSubject(), sentences: [] });
    expect(prompt).toContain('Example sentences: none available');
  });
});
