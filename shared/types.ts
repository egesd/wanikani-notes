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

// ── Jotoba types ──

export interface JotobaSense {
  glosses: string[];
  pos?: Record<string, string>[];
  language: string;
}

export interface JotobaWord {
  reading: {
    kana: string;
    kanji?: string;
    furigana?: string;
  };
  common: boolean;
  senses: JotobaSense[];
  pitch?: { part: string; high: boolean }[];
}

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
  words: JotobaWord[];
  sentences: JotobaSentence[];
}

export interface GenerateRequest {
  subject: WKSubject;
  words: JotobaWord[];
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
