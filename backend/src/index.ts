import express from 'express';
import cors from 'cors';
import dictionaryRoutes from './routes/dictionary.js';
import generateRoutes from './routes/generate.js';
import wanikaniRoutes from './routes/wanikani.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api', dictionaryRoutes);
app.use('/api', generateRoutes);
app.use('/api', wanikaniRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
