import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.CRUS_TRANSLATE_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-pro';

function assertEnv() {
  if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY for translation');
}

export type ZoningTranslation = {
  label_en: string;
  confidence?: number;
  notes?: string;
};

export async function translateZoningLabel(label: string, context?: { municipality?: string; collectionId?: string; sourceLangHint?: string; targetLang?: string; }): Promise<ZoningTranslation | null> {
  assertEnv();
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  } as any);

  const tgt = context?.targetLang || 'en';
  const src = context?.sourceLangHint || 'pt';
  const muni = context?.municipality ? `Municipality: ${context.municipality}.` : '';
  const coll = context?.collectionId ? `Collection: ${context.collectionId}.` : '';
  
  // Language names for better prompts
  const langNames: Record<string, string> = {
    'pt': 'Portuguese',
    'es': 'Spanish',
    'de': 'German',
    'en': 'English',
  };
  const srcLangName = langNames[src.toLowerCase()] || src.toUpperCase();
  const tgtLangName = langNames[tgt.toLowerCase()] || tgt.toUpperCase();

  const prompt = `Translate the following ${srcLangName} zoning/land-use label to concise ${tgtLangName} suitable for end-users. Keep it short and domain-accurate. If it's already in ${tgtLangName}, keep as-is.
${muni} ${coll}

Return JSON with: label_en (string for the ${tgtLangName} translation), confidence (0-1), notes (short optional).

Label: "${label}"`;

  try {
    const res = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] } as any);
    const text = res.response.text();
    try {
      const data = JSON.parse(text);
      const out: ZoningTranslation = {
        label_en: String(data.label_en || '').trim() || label,
        confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
      };
      return out;
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const data = JSON.parse(m[0]);
        const out: ZoningTranslation = {
          label_en: String(data.label_en || '').trim() || label,
          confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
          notes: typeof data.notes === 'string' ? data.notes : undefined,
        };
        return out;
      }
    }
    return null;
  } catch (e) {
    console.warn('Translation failed:', e);
    return null;
  }
}
