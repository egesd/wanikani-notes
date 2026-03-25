// ── WaniKani types ──

export interface WKMeaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface WKReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
}

export interface WKSubject {
  id: number;
  object: 'vocabulary' | 'kana_vocabulary';
  data: {
    characters: string;
    slug: string;
    level: number;
    meanings: WKMeaning[];
    readings?: WKReading[];
    parts_of_speech?: string[];
    context_sentences?: { en: string; ja: string }[];
  };
}

export interface WKStudyMaterial {
  id: number;
  object: 'study_material';
  data: {
    subject_id: number;
    subject_type: string;
    meaning_note: string | null;
    reading_note: string | null;
    meaning_synonyms: string[];
  };
}

// ── Jisho types ──

export interface JishoJapanese {
  word?: string;
  reading: string;
}

export interface JishoSense {
  english_definitions: string[];
  parts_of_speech: string[];
  tags: string[];
  info: string[];
  see_also: string[];
  restrictions: string[];
}

export interface JishoWord {
  slug: string;
  is_common: boolean;
  tags: string[];
  jlpt: string[];
  japanese: JishoJapanese[];
  senses: JishoSense[];
}

// ── Jotoba types (sentences only) ──

export interface JotobaSentence {
  content: string;
  furigana: string;
  translation: string;
  language: string;
}

// ── Jotoba word types ──

export interface JotobaWordReading {
  kana: string;
  kanji?: string;
}

export interface JotobaSense {
  glosses: string[];
  pos: string[];
  misc: string[];
  field: string[];
  dialect: string[];
  xref: string[];
  antonym: string[];
  information: string;
}

export interface JotobaWord {
  reading: JotobaWordReading;
  senses: JotobaSense[];
  common: boolean;
}

// ── Tatoeba types ──

export interface TatoebaTranscription {
  html: string;
  script: string;
}

export interface TatoebaTranslation {
  id: number;
  text: string;
  lang: string;
}

export interface TatoebaSentence {
  id: number;
  text: string;
  lang: string;
  translations: TatoebaTranslation[][];
  transcriptions: TatoebaTranscription[];
}

// ── Unified provider types ──

export interface LexicalEntry {
  word: string;
  reading?: string;
  glosses: string[];
  partsOfSpeech: string[];
  jlpt?: string;
  common?: boolean;
  tags?: string[];
  info?: string[];
  seeAlso?: string[];
  fields?: string[];
  antonyms?: string[];
  source: 'jotoba' | 'jisho';
}

export interface SentenceExample {
  japanese: string;
  english?: string;
  furiganaHtml?: string;
  source: 'tatoeba' | 'jotoba';
}

// ── Disambiguation types ──

export interface CompareWord {
  word: string;
  reading?: string;
  explanation: string;
}

export interface EnrichedNote {
  word: string;
  reading?: string;
  coreMeaning: string;
  usedFor: string;
  register?: string;
  safeSynonyms: string[];
  compare?: CompareWord;
  commonPatterns: string[];
  example?: SentenceExample;
  extraNotes: string[];
}

export interface NoteGenerationInput {
  word: string;
  subjectId?: number;
}

// ── App request/response types ──

export interface LookupRequest {
  word: string;
  token: string;
}

export interface LookupResponse {
  subjects: WKSubject[];
  lexical: LexicalEntry[];
  sentences: SentenceExample[];
}

export interface GenerateRequest {
  subject: WKSubject;
  lexical: LexicalEntry[];
  sentences: SentenceExample[];
}

export interface GeneratedNote {
  noteText: string;
  synonyms: string[];
  omitted?: string[];
}

export interface SaveRequest {
  token: string;
  subjectId: number;
  meaningNote: string;
  meaningSynonyms: string[];
}

export interface SaveResponse {
  success: boolean;
  action: 'created' | 'updated';
  studyMaterial: WKStudyMaterial;
}
