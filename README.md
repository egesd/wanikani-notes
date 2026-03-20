# WaniKani Study Notes

A small local web app that generates structured study notes from dictionary data and saves them to WaniKani as study materials.

## Prerequisites

- Node.js 18+
- A WaniKani API token ([get one here](https://www.wanikani.com/settings/personal_access_tokens))

## Setup

```bash
npm run install:all
```

## Development

```bash
npm run dev
```

This starts both servers concurrently:

- **Frontend** (Vite + Svelte): http://localhost:5173
- **Backend** (Express): http://localhost:3001

The Vite dev server proxies `/api` requests to the backend automatically.

## How It Works

### Generate Preview Flow

1. Enter your WaniKani API token in the token field
2. Type a Japanese vocabulary word (e.g. `贈賄`) and click **Look Up**
3. The backend runs three lookups in parallel:
   - **WaniKani**: searches vocabulary subjects by slug to find matching `subject_id`(s)
   - **Jotoba words**: retrieves meanings, readings, part-of-speech tags
   - **Jotoba sentences**: retrieves example sentences with translations
4. If multiple WaniKani matches are found, a picker is shown to disambiguate
5. The backend assembles a structured note from the gathered data:
   - **Context** — 1-2 sentence explanation from Jotoba glosses + common/uncommon flag
   - **Synonyms** — only conservative single/two-word English equivalents
   - **Extras** — parts of speech, example sentence with translation
6. The note is displayed in an editable preview card

### Save to WaniKani Flow

1. Review and optionally edit the generated note text and synonym list
2. Click **Add to WaniKani**
3. The backend checks if a `study_material` already exists for that subject:
   - If **none exists**: creates a new study material via `POST /v2/study_materials`
   - If **one exists**: updates it via `PUT /v2/study_materials/{id}`
4. The full note text is saved to `meaning_note`; synonyms are saved to `meaning_synonyms`
5. A success message confirms whether the material was created or updated

## Project Structure

```
wanikani-notes/
├── backend/
│   └── src/
│       ├── index.ts                  # Express server
│       ├── routes/
│       │   ├── dictionary.ts         # POST /api/lookup
│       │   ├── generate.ts           # POST /api/generate
│       │   └── wanikani.ts           # POST /api/save
│       └── services/
│           ├── wanikani.ts           # WaniKani API client
│           ├── jotoba.ts             # Jotoba API client
│           └── noteGenerator.ts      # Template-based note builder
├── frontend/
│   └── src/
│       ├── App.svelte                # Root component (state machine)
│       ├── main.ts                   # Svelte mount
│       ├── app.css                   # Global styles + CSS variables
│       └── lib/
│           ├── api.ts                # Backend fetch wrapper
│           ├── tokenStore.ts         # localStorage token persistence
│           └── components/
│               ├── TokenInput.svelte
│               ├── WordForm.svelte
│               ├── SubjectPicker.svelte
│               ├── NotePreview.svelte
│               └── StatusMessage.svelte
└── shared/
    └── types.ts                      # Shared TypeScript interfaces
```

## External APIs

| API       | Auth Required | Used For                              |
|-----------|---------------|---------------------------------------|
| WaniKani  | Yes (token)   | Subject lookup, study material CRUD   |
| Jotoba    | No            | Dictionary definitions, example sentences |

## Security Notes

- The API token is entered in the browser and sent per-request to the backend
- The backend proxies it to WaniKani but never stores or logs it
- Token can optionally be persisted in `localStorage` (user's choice)
- All WaniKani API calls are made over HTTPS
