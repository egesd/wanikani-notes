# WaniKani Study Notes

**Live app:** [KaniNotes](https://kaninotes.fly.dev/)

A web app that generates disambiguation-focused study notes for [WaniKani](https://www.wanikani.com/) vocabulary, then saves them directly as study materials on your WaniKani account.

Notes highlight **what makes each word distinct** — typical usage, confusion pairs, register, and collocations — rather than restating definitions you already know from WaniKani.

## How It Works

### Note Generation Pipeline

When you generate a note for a word, the backend runs a 3-tier pipeline:

1. **DB cache** — If a note was previously generated and cached in SQLite, it's returned instantly.
2. **LLM generation** — Dictionary data (Jotoba, Jisho), example sentences (Tatoeba), and a confusion candidate are assembled into a structured prompt, sent to `gpt-5.4-nano`, and the result is cached.
3. **Rule-based fallback** — If the LLM call fails, a rule-based note composer builds a note from dictionary data directly.

### Data Sources

The backend fetches and combines data from multiple APIs in parallel for each word:

| Source | Purpose |
|--------|---------|
| [WaniKani](https://www.wanikani.com/) | Subject data (meaning, reading, level) |
| [Jotoba](https://jotoba.de/) | Primary dictionary — glosses, POS, fields, JLPT, commonness, examples |
| [Jisho](https://jisho.org/) | Fallback dictionary, JLPT supplements |
| [Tatoeba](https://tatoeba.org/) | Example sentences with English translations |
| [OpenAI](https://openai.com/) | LLM note generation (gpt-5.4-nano) |

A **confusion candidate** (homophone, near-synonym, or shared-kanji word) is automatically selected and scored by relevance to include in the note.

### Save to WaniKani

1. Review and optionally edit the generated note text and synonym list
2. Click **Add to WaniKani**
3. The note text is saved to `meaning_note` and synonyms to `meaning_synonyms` via the WaniKani API

### Batch Generation

All ~6,700 WaniKani vocabulary notes were pre-generated using the [OpenAI Batch API](https://platform.openai.com/docs/guides/batch). The batch scripts fetch all WK subjects, build prompts with dictionary/sentence data, write a JSONL file, submit it, and insert the results into SQLite.

## Tech Stack

- **Frontend** — Svelte 5 (runes), Tailwind CSS, Vite
- **Backend** — Express, TypeScript, better-sqlite3
- **LLM** — OpenAI gpt-5.4-nano
- **Testing** — Vitest (205 tests across 16 files)
- **Deployment** — Fly.io with persistent volume for SQLite

## Project Structure

```
wanikani-notes/
├── backend/
│   ├── scripts/                       # Batch generation scripts (OpenAI Batch API)
│   └── src/
│       ├── index.ts                   # Express server
│       ├── routes/
│       │   ├── dictionary.ts          # POST /api/lookup
│       │   ├── generate.ts            # POST /api/generate (cache → LLM → fallback)
│       │   └── wanikani.ts            # POST /api/save
│       └── services/
│           ├── db.ts                  # SQLite cache (better-sqlite3)
│           ├── llmService.ts          # OpenAI wrapper
│           ├── promptBuilder.ts       # System prompt + user message assembly
│           ├── noteComposer.ts        # Rule-based note builder (fallback)
│           ├── compareWordService.ts   # Confusion candidate scoring + selection
│           ├── lexicalService.ts      # Jotoba + Jisho aggregator
│           ├── sentenceService.ts     # Tatoeba + Jotoba sentence ranker
│           ├── jotoba.ts / jisho.ts / tatoeba.ts / wanikani.ts
│           └── cacheService.ts        # In-memory TTL cache for API responses
├── frontend/
│   └── src/
│       ├── App.svelte                 # Root component
│       └── lib/
│           ├── api.ts                 # Backend fetch wrapper
│           ├── themeStore.ts          # Dark/light theme toggle
│           ├── tokenStore.ts          # localStorage token persistence
│           └── components/            # TokenInput, WordForm, SubjectPicker, NotePreview, StatusMessage
├── shared/
│   └── types.ts                       # Shared TypeScript interfaces
└── data/
    └── notes.db                       # SQLite cache (gitignored)
```
