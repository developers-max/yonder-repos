import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const GEMINI_ENABLE_SEARCH = process.env.GEMINI_ENABLE_SEARCH === '1' || process.env.GEMINI_ENABLE_SEARCH === 'true';
const DATABASE_URL = process.env.DATABASE_URL || '';

const BATCH_LIMIT = Number(process.env.LLM_MUNICIPALITIES_LIMIT || '100');
const CONCURRENCY = Math.max(1, Math.min(+(process.env.LLM_MUNICIPALITIES_CONCURRENCY || '2'), 8));
const PER_REQUEST_DELAY_MS = Math.max(0, Number(process.env.LLM_MUNICIPALITIES_DELAY_MS || '1000'));
const MAX_RETRIES = Math.max(0, Number(process.env.LLM_MUNICIPALITIES_MAX_RETRIES || '3'));

function assertEnv() {
  if (!GOOGLE_API_KEY) throw new Error('Missing GOOGLE_API_KEY');
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeUrl(u?: string | null): string {
  if (!u) return '';
  try {
    const url = new URL(u.startsWith('http') ? u : `https://${u}`);
    // strip fragments and query
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

interface TargetMunicipality {
  id: number;
  name: string;
  district?: string;
}

async function fetchTargetMunicipalities(client: any, limit: number): Promise<TargetMunicipality[]> {
  const { rows } = await client.query(
    `SELECT id, name, district
     FROM municipalities
     WHERE website IS NULL OR country IS NULL
     ORDER BY name
     LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({ 
    id: r.id, 
    name: r.name, 
    district: r.district 
  }));
}

interface PDMDocument {
  id: string;
  title: string;
  description: string;
  url: string;
  summary: string;
  documentType: 'pdm' | 'regulamento' | 'plano_pormenor';
}

interface LLMMunicipalityResult {
  municipality_name: string;
  website_url?: string;
  country_code?: string; // ISO-2 code
  sources?: string[];
}

async function llmEnrichMunicipality(
  genAI: GoogleGenerativeAI, 
  name: string, 
  district?: string
): Promise<LLMMunicipalityResult | null> {
  const useTools = GEMINI_ENABLE_SEARCH;
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    tools: useTools ? ([{ google_search: {} }] as any) : undefined,
    generationConfig: useTools
      ? { temperature: 0.2, topP: 0.8 }
      : { responseMimeType: 'application/json', temperature: 0.2, topP: 0.8 },
  } as any);

  const districtInfo = district ? ` in ${district} district/region` : '';
  const prompt = `You are an expert web researcher. Using web search, find the official website and country for the municipality: "${name}"${districtInfo}.

SEARCH FOR:
1. Official municipal/city government website
2. Country code (ISO-2 format)

SEARCH TERMS by language:
- Portuguese: "Câmara Municipal ${name}", "Município ${name}", "site oficial"
- Spanish/Catalan: "Ajuntament ${name}", "Ayuntamiento ${name}", "web oficial"
- German: "Gemeinde ${name}", "Stadtverwaltung ${name}", "offizielle website"
- English: "${name} City Council", "${name} Municipality", "official website"

Return a strict JSON with these keys:
{
  "municipality_name": "Official name of the municipality",
  "website_url": "Official municipal government website - NOT social media, Wikipedia, or listing sites",
  "country_code": "ISO-2 country code (PT, ES, DE, FR, IT, etc.)",
  "sources": ["up to 3 URLs used to find this information"]
}

REQUIREMENTS FOR WEBSITE URL:
- Must be the OFFICIAL municipal/city government website
- Look for domains like: cm-[name].pt, [name].es, [name].cat, [name].de, ayto-[name].es
- NOT Wikipedia, Facebook, Twitter, Google Maps, tourist sites, or business directories
- Examples of GOOD URLs:
  * https://cm-lisboa.pt (Portuguese municipality)
  * https://www.madrid.es (Spanish city)
  * https://www.barcelona.cat (Catalan city)
  * https://www.berlin.de (German city)

If you cannot find the official website, set website_url to null.
Infer country code from domain extension, location, or search context.`;

  try {
    const result = await model.generateContent({ 
      contents: [{ role: 'user', parts: [{ text: prompt }] }] 
    } as any);
    const text = result.response.text();
    
    const data = parseJsonResponse(text);
    if (!data) return null;

    const website = normalizeUrl(data.website_url);
    const countryCode = validateCountryCode(data.country_code);
    const sources: string[] = Array.isArray(data.sources) ? data.sources.slice(0, 3) : [];

    return {
      municipality_name: data.municipality_name || name,
      website_url: website || undefined,
      country_code: countryCode,
      sources,
    };
  } catch (e) {
    console.error(`Error enriching municipality "${name}":`, e);
    return null;
  }
}

function parseJsonResponse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON from code fences
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}
    return null;
  }
}

function validateCountryCode(code?: string): string | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const normalized = code.trim().toUpperCase();
  // Basic validation: 2-letter ISO code
  if (/^[A-Z]{2}$/.test(normalized)) {
    return normalized;
  }
  return undefined;
}

function isActualDocumentUrl(url: string, mainWebsite?: string): boolean {
  if (!url) return false;
  
  const lowerUrl = url.toLowerCase();
  
  // PRIORITY 1: Direct document files (always accept)
  if (lowerUrl.endsWith('.pdf') || 
      lowerUrl.endsWith('.doc') || 
      lowerUrl.endsWith('.docx') ||
      lowerUrl.includes('.pdf?') ||
      lowerUrl.includes('.pdf#')) {
    return true;
  }
  
  // PRIORITY 2: Document viewers/downloaders with IDs (always accept)
  if (lowerUrl.includes('document.php?id=') ||
      lowerUrl.includes('documento.php?id=') ||
      lowerUrl.includes('/download?id=') ||
      lowerUrl.includes('/viewer?id=') ||
      lowerUrl.includes('/doc?id=')) {
    return true;
  }
  
  // Reject if it's just the main website
  if (mainWebsite) {
    const normalizedMain = normalizeUrl(mainWebsite);
    const normalizedDoc = normalizeUrl(url);
    if (normalizedMain === normalizedDoc) {
      return false;
    }
  }
  
  // STRICT: Reject section/landing pages that end with common section names
  const sectionEndPatterns = [
    '/urbanismo', '/urbanisme', '/urbanism',
    '/poum', '/pdm', '/pgou',
    '/ordenanzas', '/regulamento',
    '/planeamiento', '/planejament', '/planning',
    '/normativa', '/regulations',
  ];
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Reject if it ends with a section name (no file or ID after it)
    if (sectionEndPatterns.some(pattern => pathname.endsWith(pattern))) {
      return false; // This is a section page, not a document
    }
  } catch {
    return false;
  }
  
  // PRIORITY 3: Specific document paths with file indicators
  const specificDocPaths = [
    '/documentos/file/',
    '/documents/file/',
    '/uploads/',
    '/arxius/', // Catalan: archives
    '/descargas/', // Spanish: downloads
    '/downloads/',
    '/ficheros/', // Spanish: files
  ];
  
  if (specificDocPaths.some(path => lowerUrl.includes(path))) {
    return true;
  }
  
  // If none of the above, reject it
  return false;
}

function validatePDMDocuments(docs?: any, mainWebsite?: string): PDMDocument[] {
  if (!Array.isArray(docs)) return [];
  
  return docs
    .filter((doc: any) => {
      if (!doc || typeof doc !== 'object' || !doc.title || !doc.url) {
        return false;
      }
      
      // Validate that URL is an actual document, not just the main website
      return isActualDocumentUrl(doc.url, mainWebsite);
    })
    .map((doc: any) => ({
      id: doc.id || `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: doc.title,
      description: doc.description || '',
      url: normalizeUrl(doc.url) || doc.url,
      summary: doc.summary || '',
      documentType: ['pdm', 'regulamento', 'plano_pormenor'].includes(doc.documentType) 
        ? doc.documentType 
        : 'pdm',
    }))
    .slice(0, 10); // Limit to 10 documents per municipality
}

async function updateMunicipality(client: any, id: number, result: LLMMunicipalityResult, municipalityName?: string) {
  const website = result.website_url || null;
  const countryCode = result.country_code || null;

  if (!website && !countryCode) {
    console.log(`No enrichment data found for municipality ID ${id}`);
    return; // Nothing to update
  }

  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (website) {
    updates.push(`website = $${paramIndex++}`);
    values.push(website);
  }

  if (countryCode) {
    updates.push(`country = $${paramIndex++}`);
    values.push(countryCode);
  }

  // Hardcoded document for Alella
  if (municipalityName && municipalityName.toLowerCase() === 'alella') {
    const alellaDocument = {
      documents: [
        {
          id: 'POUM-2014',
          title: 'Pla d\'Ordenació Urbanística Municipal (POUM) 2014 - Normativa i Agenda',
          description: 'Official POUM document for Alella municipality approved in 2014',
          url: 'https://alella.cat/ARXIUS/2010_2015/2014/POUM2014/III_normativa_i_agenda_1de2.pdf',
          summary: 'Urban planning regulations and agenda for Alella',
          documentType: 'pdm'
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    
    updates.push(`pdm_documents = $${paramIndex++}::jsonb`);
    values.push(JSON.stringify(alellaDocument));
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  await client.query(
    `UPDATE municipalities 
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex}`,
    values
  );
}

async function ensureMunicipalitiesSchema(client: any) {
  // Add country column if it doesn't exist
  await client.query(`
    ALTER TABLE municipalities 
    ADD COLUMN IF NOT EXISTS country VARCHAR(2)
  `);
  
  // Create index on country if it doesn't exist
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_municipalities_country 
    ON municipalities(country)
  `);
}

export async function enrichMunicipalitiesWithGemini(options?: { 
  limit?: number; 
  concurrency?: number;
  municipalityIds?: number[]; // Optional: enrich specific municipalities
}) {
  assertEnv();
  const pgPool: Pool = new Pool({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

  const limit = options?.limit ?? BATCH_LIMIT;
  const concurrency = options?.concurrency ?? CONCURRENCY;

  const client = await pgPool.connect();
  try {
    // Ensure schema has country column
    await ensureMunicipalitiesSchema(client);

    // Fetch municipalities that need enrichment
    let targets: TargetMunicipality[];
    
    if (options?.municipalityIds && options.municipalityIds.length > 0) {
      // Enrich specific municipalities by ID
      const { rows } = await client.query(
        `SELECT id, name, district
         FROM municipalities
         WHERE id = ANY($1)
         ORDER BY name`,
        [options.municipalityIds]
      );
      targets = rows.map((r: any) => ({ 
        id: r.id, 
        name: r.name, 
        district: r.district 
      }));
    } else {
      targets = await fetchTargetMunicipalities(client, limit);
    }

    if (!targets.length) {
      console.log('No municipalities require enrichment.');
      return;
    }

    console.log(`Enriching ${targets.length} municipalities with Gemini (model=${GEMINI_MODEL}, search=${GEMINI_ENABLE_SEARCH ? 'on' : 'off'})...`);

    let idx = 0;
    let successCount = 0;
    let failureCount = 0;

    function isRetryableError(e: any): boolean {
      const status = e?.status || e?.response?.status;
      if (status === 429 || (status >= 500 && status < 600)) return true;
      // Network-level errors
      if (e?.name === 'TypeError' || /fetch failed/i.test(String(e))) return true;
      return false;
    }

    function backoffMs(attempt: number): number {
      const base = Math.max(500, PER_REQUEST_DELAY_MS);
      const cap = 60000; // Max 60s wait
      const exp = Math.min(cap, base * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 500);
      return exp + jitter;
    }

    // Worker function with retry logic
    async function worker(municipalities: TargetMunicipality[]) {
      for (const municipality of municipalities) {
        idx += 1;
        let attempts = 0;
        let done = false;

        console.log(`[${idx}/${targets.length}] Processing: ${municipality.name}${municipality.district ? ` (${municipality.district})` : ''}...`);

        while (!done) {
          try {
            const result = await llmEnrichMunicipality(
              genAI, 
              municipality.name, 
              municipality.district
            );

            if (result) {
              await updateMunicipality(client, municipality.id, result, municipality.name);
              const docNote = municipality.name.toLowerCase() === 'alella' ? ' | Doc: Hardcoded POUM' : '';
              console.log(`✓ Enriched: ${municipality.name} | Website: ${result.website_url || 'N/A'} | Country: ${result.country_code || 'N/A'}${docNote}`);
              successCount++;
            } else {
              console.warn(`✗ No data found for: ${municipality.name}`);
              failureCount++;
            }
            done = true;
          } catch (e: any) {
            attempts += 1;
            if (attempts <= MAX_RETRIES && isRetryableError(e)) {
              const wait = backoffMs(attempts - 1);
              console.warn(`  Retry ${attempts}/${MAX_RETRIES} for "${municipality.name}" after ${wait}ms due to:`, e?.message || e);
              await sleep(wait);
              continue;
            } else {
              console.error(`✗ Failed to enrich "${municipality.name}" (no more retries):`, e?.message || e);
              failureCount++;
              break;
            }
          } finally {
            if (PER_REQUEST_DELAY_MS > 0) await sleep(PER_REQUEST_DELAY_MS);
          }
        }
      }
    }

    // Split work across concurrent workers
    const sliceSize = Math.ceil(targets.length / concurrency);
    const slices: TargetMunicipality[][] = [];
    for (let i = 0; i < targets.length; i += sliceSize) {
      slices.push(targets.slice(i, i + sliceSize));
    }
    await Promise.all(slices.map((s) => worker(s)));

    console.log('\n=== Municipality LLM Enrichment Complete ===');
    console.log(`Total processed: ${targets.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
  } finally {
    client.release();
    await pgPool.end();
  }
}
