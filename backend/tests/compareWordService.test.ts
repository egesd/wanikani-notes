import { describe, it, expect } from 'vitest';
import {
  scoreCandidate,
  buildExplanation,
  findCompareCandidate,
} from '../src/services/compareWordService.js';
import type { LexicalEntry } from '@shared/types';

function makeEntry(overrides: Partial<LexicalEntry> = {}): LexicalEntry {
  return {
    word: '捕獲',
    reading: 'ほかく',
    glosses: ['capture', 'seizure'],
    partsOfSpeech: ['Noun', 'Suru verb'],
    source: 'jotoba',
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('scores common same-reading candidates highest', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく' });
    const homophone = makeEntry({ word: '補角', reading: 'ほかく', glosses: ['supplementary angle'], common: true });
    const synonym = makeEntry({ word: '捕捉', reading: 'ほそく', glosses: ['capture', 'apprehension'] });

    const homoScore = scoreCandidate(target, homophone);
    const synScore = scoreCandidate(target, synonym);
    expect(homoScore).toBeGreaterThan(synScore);
  });

  it('scores uncommon homophones lower than strong synonyms', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく' });
    const uncommonHomophone = makeEntry({ word: '補角', reading: 'ほかく', glosses: ['supplementary angle'] });
    const synonym = makeEntry({ word: '捕捉', reading: 'ほそく', glosses: ['capture', 'apprehension'] });

    const homoScore = scoreCandidate(target, uncommonHomophone);
    const synScore = scoreCandidate(target, synonym);
    expect(synScore).toBeGreaterThan(homoScore);
  });

  it('scores overlapping glosses', () => {
    const target = makeEntry({ glosses: ['capture', 'seizure'] });
    const overlap = makeEntry({ word: '捕捉', glosses: ['capture', 'apprehension'] });
    const noOverlap = makeEntry({ word: '走る', glosses: ['to run'] });

    expect(scoreCandidate(target, overlap)).toBeGreaterThan(
      scoreCandidate(target, noOverlap),
    );
  });

  it('gives bonus for shared kanji', () => {
    const target = makeEntry({ word: '捕獲', glosses: [] });
    const sharedKanji = makeEntry({ word: '捕捉', reading: 'ほそく', glosses: [] });
    const noSharedKanji = makeEntry({ word: '走行', reading: 'そうこう', glosses: [] });

    expect(scoreCandidate(target, sharedKanji)).toBeGreaterThan(
      scoreCandidate(target, noSharedKanji),
    );
  });

  it('gives bonus for same POS', () => {
    const target = makeEntry({ partsOfSpeech: ['Noun', 'Suru verb'] });
    const samePos = makeEntry({ word: '捕捉', glosses: [], partsOfSpeech: ['Noun', 'Suru verb'] });
    const diffPos = makeEntry({ word: '走る', glosses: [], partsOfSpeech: ['Ichidan verb'] });

    expect(scoreCandidate(target, samePos)).toBeGreaterThan(
      scoreCandidate(target, diffPos),
    );
  });
});

describe('buildExplanation', () => {
  it('explains same-reading pairs', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] });
    const candidate = makeEntry({ word: '補角', reading: 'ほかく', glosses: ['supplementary angle'] });

    const explanation = buildExplanation(target, candidate);
    expect(explanation).toContain('ほかく');
    expect(explanation).toContain('capture');
    expect(explanation).toContain('supplementary angle');
  });

  it('explains overlapping-gloss pairs', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく', glosses: ['capture', 'seizure'] });
    const candidate = makeEntry({ word: '捕捉', reading: 'ほそく', glosses: ['capture', 'apprehension'] });

    const explanation = buildExplanation(target, candidate);
    expect(explanation).toContain('捕獲');
    expect(explanation).toContain('捕捉');
  });

  it('explains shared-kanji pairs', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] });
    const candidate = makeEntry({ word: '捕虫', reading: 'ほちゅう', glosses: ['catching insects'] });

    const explanation = buildExplanation(target, candidate);
    expect(explanation).toContain('捕');
  });

  it('provides fallback explanation', () => {
    const target = makeEntry({ word: '走る', reading: 'はしる', glosses: ['to run'] });
    const candidate = makeEntry({ word: '駆ける', reading: 'かける', glosses: ['to dash'] });

    const explanation = buildExplanation(target, candidate);
    expect(explanation).toContain('駆ける');
  });
});

describe('findCompareCandidate', () => {
  it('returns the highest-scoring candidate', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] });
    const entries = [
      target,
      makeEntry({ word: '補角', reading: 'ほかく', glosses: ['supplementary angle'] }),
      makeEntry({ word: '捕捉', reading: 'ほそく', glosses: ['capture', 'apprehension'] }),
    ];

    const result = findCompareCandidate(target, entries);
    // Synonym with gloss overlap + shared kanji beats uncommon homophone
    expect(result).toBeDefined();
    expect(result!.word).toBe('捕捉');
  });

  it('returns undefined when no candidate scores high enough', () => {
    const target = makeEntry({ word: '食べる', reading: 'たべる', glosses: ['to eat'] });
    const entries = [
      target,
      makeEntry({ word: '走る', reading: 'はしる', glosses: ['to run'], partsOfSpeech: ['Godan verb'] }),
    ];

    const result = findCompareCandidate(target, entries);
    expect(result).toBeUndefined();
  });

  it('excludes the target word from candidates', () => {
    const target = makeEntry({ word: '捕獲' });
    const entries = [target]; // only the target itself

    const result = findCompareCandidate(target, entries);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty entry list', () => {
    const target = makeEntry();
    const result = findCompareCandidate(target, []);
    expect(result).toBeUndefined();
  });

  it('includes reading in the result', () => {
    const target = makeEntry({ word: '捕獲', reading: 'ほかく', glosses: ['capture'] });
    const entries = [
      target,
      makeEntry({ word: '捕捉', reading: 'ほそく', glosses: ['capture'] }),
    ];

    const result = findCompareCandidate(target, entries);
    expect(result).toBeDefined();
    expect(result!.reading).toBe('ほそく');
  });
});
