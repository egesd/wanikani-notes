import OpenAI from 'openai';
import { SYSTEM_PROMPT } from './promptBuilder.js';

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY?.replace(/[^\x20-\x7E]/g, '').trim();
  if (!apiKey) return null;
  client = new OpenAI({ apiKey });
  return client;
}

/**
 * Generate a note for a single word using gpt-5.4-nano.
 * Returns undefined if the API key is missing or the call fails.
 */
export async function generateLLMNote(
  userPrompt: string,
): Promise<string | undefined> {
  const openai = getClient();
  if (!openai) return undefined;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.4-nano',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 500,
    });

    return response.choices[0]?.message?.content?.trim() || undefined;
  } catch (err) {
    console.error('[LLM] API error:', err);
    return undefined;
  }
}
