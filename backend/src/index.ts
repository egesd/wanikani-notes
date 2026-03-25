import dotenv from 'dotenv';
import path from 'path';
const envResult = dotenv.config({ path: path.resolve(import.meta.dirname, '../../.env') });
if (envResult.error) console.error('[dotenv] Error:', envResult.error.message);
// Strip any non-ASCII chars that sneak in via copy-paste
if (process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY.replace(/[^\x20-\x7E]/g, '').trim();
}
console.log('[dotenv] OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY, 'length:', process.env.OPENAI_API_KEY?.length);
import express from 'express';
import cors from 'cors';
import dictionaryRoutes from './routes/dictionary.js';
import generateRoutes from './routes/generate.js';
import wanikaniRoutes from './routes/wanikani.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.use('/api', dictionaryRoutes);
app.use('/api', generateRoutes);
app.use('/api', wanikaniRoutes);

// In production, serve the frontend build
const frontendDist = path.join(process.cwd(), 'frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});

// Close DB and server cleanly so tsx watch can restart without hanging
import { closeDb } from './services/db.js';

function shutdown() {
  closeDb();
  server.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
