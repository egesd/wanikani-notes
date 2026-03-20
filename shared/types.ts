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

// ── App request/response types ──

export interface LookupRequest {
  word: string;
  token: string;
}

export interface LookupResponse {
  subjects: WKSubject[];
  words: JishoWord[];
  sentences: JotobaSentence[];
}

export interface GenerateRequest {
  subject: WKSubject;
  words: JishoWord[];
  sentences: JotobaSentence[];
}

export interface GeneratedNote {
  noteText: string;
  synonyms: string[];
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
