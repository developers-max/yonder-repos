import { OpenAI } from 'openai';

/**
 * Query Translation Module
 * Translates user queries to match document language for better semantic matching
 */

interface TranslationResult {
  translatedQuery: string;
  sourceLanguage: string;
  targetLanguage: string;
  wasTranslated: boolean;
}

/**
 * Detect language of the query
 */
function detectLanguage(query: string): string {
  const lowerQ = query.toLowerCase();
  
  // Simple Catalan detection (common words/patterns)
  const catalanIndicators = [
    /\bquin[eas]?\b/, /\bqual\b/, /\bcom\b/, /\bpot[s]?\b/, 
    /\bsón\b/, /\bés\b/, /\bel[s]?\b/, /\bla[s]?\b/,
    /\bd'/, /\balçad[ae]s?\b/, /\baparcament\b/,
    /\bqualificació\b/, /\bnormativa\b/, /\bsòl\b/
  ];
  
  const catalanMatches = catalanIndicators.filter(pattern => pattern.test(lowerQ)).length;
  
  // If 2+ Catalan indicators, likely Catalan
  if (catalanMatches >= 2) {
    return 'ca';
  }
  
  // Spanish detection
  const spanishIndicators = [
    /\bqué\b/, /\bcómo\b/, /\bcuál\b/, /\bdónde\b/,
    /\bson\b/, /\balturas?\b/, /\baparcamiento\b/,
    /\bcalificación\b/, /\bnormativa\b/, /\bsuelo\b/
  ];
  
  const spanishMatches = spanishIndicators.filter(pattern => pattern.test(lowerQ)).length;
  
  if (spanishMatches >= 2) {
    return 'es';
  }
  
  // Default to English for now
  return 'en';
}

/**
 * Get target language based on municipality
 * In production, this would query the database
 */
function getDocumentLanguage(municipalityId: number): string {
  // For now, hardcoded mapping
  // In production, store this in municipalities table
  const languageMap: { [key: number]: string } = {
    401: 'ca', // Alella - Catalan
    // Add more municipalities here
  };
  
  return languageMap[municipalityId] || 'ca'; // Default Catalan for Spain
}

/**
 * Translate query using OpenAI
 */
async function translateQuery(
  openai: OpenAI,
  query: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const languageNames: { [key: string]: string } = {
    'en': 'English',
    'ca': 'Catalan',
    'es': 'Spanish',
    'pt': 'Portuguese',
    'de': 'German',
  };
  
  const sourceName = languageNames[sourceLanguage] || sourceLanguage;
  const targetName = languageNames[targetLanguage] || targetLanguage;
  
  const prompt = `Translate the following ${sourceName} question to ${targetName}.
Keep technical terms, codes, and references unchanged (e.g., "13c1", "POUM").
Translate ONLY the question, do not answer it.

Question: ${query}

${targetName} translation:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Very low for consistent translation
    max_tokens: 200,
  });

  return response.choices[0].message.content?.trim() || query;
}

/**
 * Main translation function
 * Auto-detects language and translates if needed
 */
export async function translateQueryIfNeeded(
  openai: OpenAI,
  query: string,
  municipalityId: number,
  options?: {
    forceTranslate?: boolean;
    verbose?: boolean;
  }
): Promise<TranslationResult> {
  const verbose = options?.verbose || false;
  
  // Detect query language
  const sourceLanguage = detectLanguage(query);
  const targetLanguage = getDocumentLanguage(municipalityId);
  
  if (verbose) {
    console.log(`   Language detection: ${sourceLanguage} → ${targetLanguage}`);
  }
  
  // If languages match, no translation needed
  if (sourceLanguage === targetLanguage && !options?.forceTranslate) {
    if (verbose) {
      console.log(`   ✓ No translation needed (both ${targetLanguage})`);
    }
    return {
      translatedQuery: query,
      sourceLanguage,
      targetLanguage,
      wasTranslated: false,
    };
  }
  
  // Translate query
  if (verbose) {
    console.log(`   🌐 Translating from ${sourceLanguage} to ${targetLanguage}...`);
  }
  
  const translatedQuery = await translateQuery(
    openai,
    query,
    sourceLanguage,
    targetLanguage
  );
  
  if (verbose) {
    console.log(`   Original: "${query}"`);
    console.log(`   Translated: "${translatedQuery}"`);
  }
  
  return {
    translatedQuery,
    sourceLanguage,
    targetLanguage,
    wasTranslated: true,
  };
}

/**
 * Batch translate multiple queries
 */
export async function translateQueries(
  openai: OpenAI,
  queries: string[],
  municipalityId: number
): Promise<{ original: string; translated: string }[]> {
  const results = [];
  
  for (const query of queries) {
    const result = await translateQueryIfNeeded(openai, query, municipalityId);
    results.push({
      original: query,
      translated: result.translatedQuery,
    });
  }
  
  return results;
}

/**
 * Get language configuration for export
 */
export function getLanguageConfig() {
  return {
    supportedLanguages: ['en', 'ca', 'es', 'pt', 'de'],
    defaultDocumentLanguage: 'ca',
    translationEnabled: true,
    translationModel: 'gpt-4o-mini',
  };
}
