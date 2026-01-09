import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const translationCache = new Map<string, string>();

export async function translateDescription(text: string): Promise<string> {
  const cacheKey = text.trim().toLowerCase();
  
  if (translationCache.has(cacheKey)) {
    console.log('[translateDescription] Cache hit');
    return translationCache.get(cacheKey)!;
  }

  try {
    const result = await generateText({
      model: openai('gpt-5-nano'),
      prompt: `Translate the following real estate listing description to English. Maintain the same tone and style. If it's already in English, return it as-is.

Description:
${text}

Translation:`,
      temperature: 0.3,
    });

    const translation = result.text.trim();
    translationCache.set(cacheKey, translation);
    
    return translation;
  } catch (error) {
    console.error('[translateDescription] Error:', error);
    throw new Error('Failed to translate description');
  }
}
