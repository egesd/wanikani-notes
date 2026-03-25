import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateLLMNote } from '../src/services/llmService.js';

// Mock the openai module
vi.mock('openai', () => {
  const mockCreate = vi.fn();
  return {
    default: class {
      chat = { completions: { create: mockCreate } };
    },
    __mockCreate: mockCreate,
  };
});

// Access the mock
import { __mockCreate } from 'openai';
const mockCreate = __mockCreate as ReturnType<typeof vi.fn>;

describe('generateLLMNote', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    // Set the env var so the client initializes
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('returns LLM response text', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Generated note about 捕獲' } }],
    });

    const result = await generateLLMNote('test prompt');
    expect(result).toBe('Generated note about 捕獲');
  });

  it('passes correct parameters', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Note' } }],
    });

    await generateLLMNote('my prompt');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-nano',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: 'my prompt' }),
        ]),
      }),
    );
  });

  it('returns undefined on API error', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));
    const result = await generateLLMNote('test');
    expect(result).toBeUndefined();
  });

  it('returns undefined when response has no content', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });
    const result = await generateLLMNote('test');
    expect(result).toBeUndefined();
  });

  it('trims whitespace from response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '  Note with spaces  \n' } }],
    });
    const result = await generateLLMNote('test');
    expect(result).toBe('Note with spaces');
  });
});
