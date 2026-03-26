# WaniKani Study Notes

A web app that generates disambiguation-focused study notes for WaniKani vocabulary using LLM (GPT) and dictionary data, then saves them as study materials on WaniKani.

Notes are designed to highlight **what makes each word distinct** — typical usage, confusion pairs, register, and collocations — rather than restating definitions you already know from WaniKani.

## Prerequisites

- Node.js 20+
- A WaniKani API token ([get one here](https://www.wanikani.com/settings/personal_access_tokens))
- An OpenAI API key (optional — falls back to rule-based notes without one)

## Setup

```bash
npm run install:all
```

Create a `.env` file in the project root:

```
OPENAI_API_KEY=sk-proj-...
WANIKANI_TOKEN=...
```

## Development

```bash
npm run dev
```

This starts both servers concurrently:

- **Frontend** (Vite + Svelte 5): http://localhost:5173
- **Backend** (Express): http://localhost:3001

The Vite dev server proxies `/api` requests to the backend automatically.

## How It Works

### Note Generation Pipeline

When you generate a note for a word, the backend runs a 3-tier pipeline:

1. **DB cache check** — If a note was previously generated and cached in SQLite, it's returned instantly.
2. **LLM generation** — Dictionary data (Jotoba, Jisho), example sentences (Tatoeba), and a confusion candidate are assembled into a structured prompt, sent to `gpt-5.4-nano`, and the result is cached in SQLite.
3. **Rule-based fallback** — If no API key is set or the LLM call fails, a rule-based note composer builds a note from the dictionary data directly.

### Data Sources Per Word

The backend fetches and combines data from multiple APIs in parallel:

- **WaniKani** — subject data (meaning, reading, level)
- **Jotoba** — primary dictionary: glosses, POS, fields, JLPT, commonness, example sentences
- **Jisho** — fallback dictionary, supplements JLPT data
- **Tatoeba** — additional example sentences with English translations
- **Compare candidate** — an automatically selected confusion pair (homophone, near-synonym, or shared-kanji word) scored by relevance

### Save to WaniKani Flow

1. Review and optionally edit the generated note text and synonym list
2. Click **Add to WaniKani**
3. The backend creates or updates a `study_material` via the WaniKani API
4. The note text is saved to `meaning_note`; synonyms to `meaning_synonyms`

## Batch Generation

To pre-generate notes for all ~6,700 WaniKani vocabulary at once (using the OpenAI Batch API for 50% cost savings):

```bash
cd backend && caffeinate -i npx tsx scripts/batch-generate.ts 2>&1 | tee ../data/batch.log
```

This fetches all WK subjects, builds prompts with dictionary/sentence data, writes a JSONL file, and submits it to the OpenAI Batch API. Results are inserted into `data/notes.db`.

If the batch hits token limits, use the chunked resume script:

```bash
cd backend && caffeinate -i npx tsx scripts/batch-resume.ts 2>&1 | tee ../data/batch-resume.log
```

## SQLite Cache

Generated notes are cached in `data/notes.db` to avoid redundant LLM calls. The DB is a single file with one table:

| Column | Type | Description |
|--------|------|-------------|
| `word` | TEXT (PK) | Japanese vocabulary word |
| `note_text` | TEXT | The generated note |
| `synonyms` | TEXT | JSON array of synonym strings |
| `created_at` | TEXT | ISO timestamp |

Query locally: `sqlite3 data/notes.db "SELECT word, substr(note_text, 1, 80) FROM notes;"`

## Project Structure

```
wanikani-notes/
├── backend/
│   ├── scripts/
│   │   ├── batch-generate.ts         # Full batch: fetch → prompt → OpenAI Batch API → DB
│   │   └── batch-resume.ts           # Resume: reads existing JSONL, submits in chunks
│   └── src/
│       ├── index.ts                  # Express server + dotenv + shutdown handlers
│       ├── routes/
│       │   ├── dictionary.ts         # POST /api/lookup
│       │   ├── generate.ts           # POST /api/generate (cache → LLM → fallback)
│       │   └── wanikani.ts           # POST /api/save
│       └── services/
│           ├── db.ts                 # SQLite cache (better-sqlite3)
│           ├── llmService.ts         # OpenAI gpt-5.4-nano wrapper
│           ├── promptBuilder.ts      # System prompt + user message assembly
│           ├── noteComposer.ts       # Rule-based note builder (fallback)
│           ├── compareWordService.ts  # Confusion candidate scoring + selection
│           ├── lexicalService.ts     # Jotoba + Jisho aggregator
│           ├── sentenceService.ts    # Tatoeba + Jotoba sentence ranker
│           ├── cacheService.ts       # In-memory TTL cache for API responses
│           ├── jotoba.ts             # Jotoba API client
│           ├── jisho.ts              # Jisho API client
│           ├── tatoeba.ts            # Tatoeba API client
│           └── wanikani.ts           # WaniKani API client
├── frontend/
│   └── src/
│       ├── App.svelte                # Root component
│       ├── main.ts                   # Svelte mount
│       ├── app.css                   # Global styles + dark/light theme
│       └── lib/
│           ├── api.ts                # Backend fetch wrapper
│           ├── tokenStore.ts         # localStorage token persistence
│           ├── themeStore.ts         # Dark/light theme toggle
│           └── components/
│               ├── TokenInput.svelte
│               ├── WordForm.svelte
│               ├── SubjectPicker.svelte
│               ├── NotePreview.svelte
│               └── StatusMessage.svelte
├── shared/
│   └── types.ts                      # Shared TypeScript interfaces
└── data/
    └── notes.db                      # SQLite cache (gitignored)
```

## External APIs

| API       | Auth Required | Used For                                     |
|-----------|---------------|----------------------------------------------|
| WaniKani  | Yes (token)   | Subject lookup, study material CRUD          |
| Jotoba    | No            | Dictionary data, example sentences           |
| Jisho     | No            | Fallback dictionary, JLPT supplements        |
| Tatoeba   | No            | Additional example sentences                 |
| OpenAI    | Yes (API key) | LLM note generation (gpt-5.4-nano)          |

## Deployment (Fly.io)

```bash
# Create a persistent volume for SQLite
fly volumes create notes_data --region ams --size 1

# Set the API key secret
fly secrets set OPENAI_API_KEY=sk-proj-...

# Deploy
fly deploy

# Upload your local DB to the server
fly ssh sftp shell
put data/notes.db /app/data/notes.db
```

## Testing

```bash
npm test
```

Runs backend and frontend test suites (vitest). Tests cover:
- Note generation and composition logic
- LLM service (mocked OpenAI calls)
- Prompt builder (system prompt + user message structure)
- SQLite cache operations
- Compare candidate scoring and selection
- API service clients (Jotoba, Jisho, Tatoeba, WaniKani) with mocked fetch
- Route handlers (cache → LLM → fallback pipeline, validation, error handling)
- Frontend API wrapper and token store

## Security Notes

- The WaniKani token is entered in the browser and sent per-request — never stored server-side
- The OpenAI API key is loaded from `.env` and never exposed to the frontend
- `.env` and `data/` are gitignored
- All external API calls use HTTPS with 10-second timeouts
- Token can optionally be persisted in `localStorage` (user's choice)
