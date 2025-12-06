import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

const state = vi.hoisted(() => {
  const s: {
    mockText: string;
    generateContentMock: ReturnType<typeof vi.fn>;
    getGenerativeModelMock: ReturnType<typeof vi.fn>;
  } = {
    mockText: '',
    generateContentMock: vi.fn(async () => ({ response: { text: () => s.mockText } })),
    getGenerativeModelMock: vi.fn(),
  };
  return s;
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor(_apiKey: string) {}
      getGenerativeModel(opts: unknown) {
        state.getGenerativeModelMock(opts);
        return { generateContent: state.generateContentMock };
      }
    },
  };
});

import { chooseWithGemini } from '../../src/app/api/project-image/route';

const originalKey = process.env.GEMINI_API_KEY;

beforeEach(() => {
  process.env.GEMINI_API_KEY = 'test-key';
  state.mockText = '';
  vi.clearAllMocks();
});

afterAll(() => {
  process.env.GEMINI_API_KEY = originalKey;
});

describe('chooseWithGemini()', () => {
  it('returns the URL parsed from JSON when the model outputs JSON', async () => {
    state.mockText = '{"url":"https://img.example/a.jpg"}';
    const url = await chooseWithGemini('Build prefab Home', 'https://site.example');
    expect(url).toBe('https://img.example/a.jpg');
  });

  it('returns the first URL found in plain text when no JSON is present', async () => {
    state.mockText = 'Some text with a link https://img.example/b.png and other tokens';
    const url = await chooseWithGemini('Build prefab Home', 'https://site.example');
    expect(url).toBe('https://img.example/b.png');
  });

  it('returns null when the model call throws', async () => {
    state.generateContentMock.mockRejectedValueOnce(new Error('model error'));
    const url = await chooseWithGemini('Build prefab Home', 'https://site.example');
    expect(url).toBeNull();
  });

  it('returns null when GEMINI_API_KEY is missing', async () => {
    process.env.GEMINI_API_KEY = '';
    const url = await chooseWithGemini('Build prefab Home', 'https://site.example');
    expect(url).toBeNull();
  });

  it('includes projectType and site in the prompt sent to the model', async () => {
    state.mockText = '{"url":"https://img.example/c.webp"}';
    const url = await chooseWithGemini('Build prefab Home', 'https://mysite.example');
    expect(url).toBe('https://img.example/c.webp');

    const args = state.generateContentMock.mock.calls[0]?.[0];
    const promptText: string | undefined = args?.contents?.[0]?.parts?.[0]?.text;
    expect(typeof promptText).toBe('string');
    expect(promptText).toContain('Project type: Build prefab Home');
    expect(promptText).toContain('Website: https://mysite.example');
  });
});
