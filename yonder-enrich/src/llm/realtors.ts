import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
const GEMINI_ENABLE_SEARCH = process.env.GEMINI_ENABLE_SEARCH === '1' || process.env.GEMINI_ENABLE_SEARCH === 'true';
const DATABASE_URL = process.env.DATABASE_URL || '';
const REALTORS_DEFAULT_COUNTRY = process.env.REALTORS_DEFAULT_COUNTRY || 'PT';

const BATCH_LIMIT = Number(process.env.LLM_REALTORS_LIMIT || '200');
const CONCURRENCY = Math.max(1, Math.min(+(process.env.LLM_REALTORS_CONCURRENCY || '2'), 8));
const PER_REQUEST_DELAY_MS = Math.max(0, Number(process.env.LLM_REALTORS_DELAY_MS || '500'));
const MAX_RETRIES = Math.max(0, Number(process.env.LLM_REALTORS_MAX_RETRIES || '3'));

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

function isValidEmail(e?: string | null): boolean {
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

type TargetKey = { country: string; company_name: string };
async function fetchTargetCompanyNames(client: any, limit: number): Promise<TargetKey[]> {
  const { rows } = await client.query(
    `WITH agg AS (
      SELECT country, company_name,
             MAX(NULLIF(website_url, '')) AS website_url,
             MAX(NULLIF(email, '')) AS email,
             MAX(NULLIF(telephone, '')) AS telephone
      FROM realtors
      GROUP BY country, company_name
    )
    SELECT country, company_name
    FROM agg
    WHERE (website_url IS NULL OR email IS NULL OR telephone IS NULL)
    ORDER BY country, company_name
    LIMIT $1`,
    [limit]
  );
  return rows.map((r: any) => ({ country: r.country || REALTORS_DEFAULT_COUNTRY, company_name: r.company_name }));
}

type LLMFindResult = {
  company_name: string;
  country: string;
  website_url?: string;
  email?: string;
  telephone?: string;
  sources?: string[];
};

async function llmFindContacts(genAI: GoogleGenerativeAI, name: string, country: string): Promise<LLMFindResult | null> {
  const useTools = GEMINI_ENABLE_SEARCH;
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    // Cast to any to avoid SDK type friction; enables Google Search tool when available for your key/plan
    tools: useTools ? ([{ google_search: {} }] as any) : undefined,
    generationConfig: useTools
      ? { temperature: 0.2, topP: 0.8 }
      : { responseMimeType: 'application/json', temperature: 0.2, topP: 0.8 },
  } as any);

  // Country-specific context for better search results
  const countryContext = {
    'PT': 'Portugal (search in Portuguese: "imobiliária", use .pt domains)',
    'ES': 'Spain (search in Spanish: "inmobiliaria", use .es domains)',
    'DE': 'Germany (search in German: "Immobilienmakler", use .de domains)',
  }[country] || country;

  const prompt = `You are an expert web researcher. Using web search if available, find the official website and contact details for the real estate agency/company named: "${name}" in ${countryContext}.

IMPORTANT: Search for the company in the CORRECT country and language. For non-English countries, use local language terms.

Return a strict JSON with keys: company_name, website_url, email, telephone, sources.
- company_name: the canonical public brand name for this realtor.
- website_url: the OFFICIAL homepage URL for the realtor (not social networks or listing portals like Idealista, Immowelt, etc.), including scheme. Prefer country-specific domain (.pt, .es, .de).
- email: a generic contact email if available (e.g., info@..., kontakt@..., contacto@...), otherwise a relevant contact email.
- telephone: a main phone number in international format if available (e.g., +351 for PT, +34 for ES, +49 for DE).
- sources: an array of up to 3 URLs you used to determine the answer (prefer official website/contact page).

If uncertain or multiple unrelated entities, return the best official match for the specified country.`;

  const result = await model.generateContent({ contents: [{ role: 'user', parts: [{ text: prompt }] }] } as any);
  const text = result.response.text();
  try {
    const data = JSON.parse(text);
    const website = normalizeUrl(data.website_url);
    const email = isValidEmail(data.email) ? data.email.trim() : undefined;
    const tel = typeof data.telephone === 'string' && data.telephone.trim() ? data.telephone.trim() : undefined;
    const sources: string[] = Array.isArray(data.sources) ? data.sources.slice(0, 3) : [];
    return { company_name: data.company_name || name, country, website_url: website || undefined, email, telephone: tel, sources };
  } catch (e) {
    // Fallback: sometimes JSON is inside code fences
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const data = JSON.parse(m[0]);
        const website = normalizeUrl(data.website_url);
        const email = isValidEmail(data.email) ? data.email.trim() : undefined;
        const tel = typeof data.telephone === 'string' && data.telephone.trim() ? data.telephone.trim() : undefined;
        const sources: string[] = Array.isArray(data.sources) ? data.sources.slice(0, 3) : [];
        return { company_name: data.company_name || name, country, website_url: website || undefined, email, telephone: tel, sources };
      }
    } catch {}
    return null;
  }
}

async function upsertContact(client: any, r: LLMFindResult) {
  const website = normalizeUrl(r.website_url);
  const email = isValidEmail(r.email) ? r.email : null;
  const tel = r.telephone || null;

  if (!website && !email && !tel) return; // nothing to update

  await client.query(
    `INSERT INTO realtors (company_name, country, website_url, email, telephone)
     VALUES ($1, $2, COALESCE($3, ''), $4, $5)
     ON CONFLICT ON CONSTRAINT realtors_country_name_uidx DO UPDATE SET
       website_url = CASE WHEN realtors.website_url = '' AND EXCLUDED.website_url <> '' THEN EXCLUDED.website_url ELSE realtors.website_url END,
       email = COALESCE(EXCLUDED.email, realtors.email),
       telephone = COALESCE(EXCLUDED.telephone, realtors.telephone)`,
    [r.company_name, r.country || REALTORS_DEFAULT_COUNTRY, website || null, email, tel]
  );
}

async function ensureRealtorsTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS realtors (
      id BIGSERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      country TEXT NOT NULL,
      website_url TEXT NOT NULL DEFAULT '',
      email TEXT,
      telephone TEXT
    );
  `);
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS country TEXT`);
  await client.query(`UPDATE realtors SET country = $1 WHERE country IS NULL OR country = ''`, [REALTORS_DEFAULT_COUNTRY]);
  await client.query(`ALTER TABLE realtors ALTER COLUMN country SET NOT NULL`);
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS id BIGSERIAL`);
  await client.query(`UPDATE realtors SET id = DEFAULT WHERE id IS NULL`);
  await client.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'realtors'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE realtors ADD PRIMARY KEY (id);
    END IF;
  END$$;`);
  await client.query(`ALTER TABLE realtors DROP CONSTRAINT IF EXISTS realtors_company_website_uidx`);
  await client.query(`DROP INDEX IF EXISTS realtors_company_website_uidx`);
  await client.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'realtors'::regclass AND conname = 'realtors_country_name_uidx'
    ) THEN
      ALTER TABLE realtors ADD CONSTRAINT realtors_country_name_uidx UNIQUE (country, company_name);
    END IF;
  END$$;`);
}

export async function enrichRealtorsWithGemini(options?: { limit?: number; concurrency?: number; }) {
  assertEnv();
  const pgPool: Pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

  const limit = options?.limit ?? BATCH_LIMIT;
  const concurrency = options?.concurrency ?? CONCURRENCY;

  const client = await pgPool.connect();
  try {
    await ensureRealtorsTable(client);
    const targets = await fetchTargetCompanyNames(client, limit);
    if (!targets.length) {
      console.log('No realtor names require enrichment.');
      return;
    }
    
    // Show breakdown by country
    const countryStats = new Map<string, number>();
    for (const t of targets) {
      countryStats.set(t.country, (countryStats.get(t.country) || 0) + 1);
    }
    console.log(`Enriching ${targets.length} realtor companies with Gemini (model=${GEMINI_MODEL}, search=${GEMINI_ENABLE_SEARCH ? 'on' : 'off'})...`);
    for (const [country, count] of countryStats.entries()) {
      console.log(`  ${country}: ${count} realtors`);
    }

    let idx = 0;
    function isRetryableError(e: any): boolean {
      const status = e?.status || e?.response?.status;
      if (status === 429 || (status >= 500 && status < 600)) return true;
      // Network-level errors (undici TypeError: fetch failed)
      if (e?.name === 'TypeError' || /fetch failed/i.test(String(e))) return true;
      return false;
    }
    function backoffMs(attempt: number): number {
      const base = Math.max(200, PER_REQUEST_DELAY_MS);
      const cap = 30000;
      const exp = Math.min(cap, base * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 250);
      return exp + jitter;
    }
    // Simple concurrency control with retries and pacing
    async function worker(keys: TargetKey[]) {
      for (const { company_name, country } of keys) {
        idx += 1;
        let attempts = 0;
        let done = false;
        while (!done) {
          try {
            const res = await llmFindContacts(genAI, company_name, country || REALTORS_DEFAULT_COUNTRY);
            if (res) {
              await upsertContact(client, { ...res, company_name: company_name, country: country || REALTORS_DEFAULT_COUNTRY });
            }
            done = true;
          } catch (e: any) {
            attempts += 1;
            if (attempts <= MAX_RETRIES && isRetryableError(e)) {
              const wait = backoffMs(attempts - 1);
              console.warn(`Retry ${attempts}/${MAX_RETRIES} for "${company_name}" [${country}] after ${wait}ms due to:`, e?.message || e);
              await sleep(wait);
              continue;
            } else {
              console.warn(`Failed to enrich "${company_name}" [${country}] (no more retries):`, e);
              break;
            }
          } finally {
            if (idx % 10 === 0) console.log(`Processed ${idx}/${targets.length}...`);
            if (PER_REQUEST_DELAY_MS > 0) await sleep(PER_REQUEST_DELAY_MS);
          }
        }
      }
    }

    const sliceSize = Math.ceil(targets.length / concurrency);
    const slices: TargetKey[][] = [];
    for (let i = 0; i < targets.length; i += sliceSize) {
      slices.push(targets.slice(i, i + sliceSize));
    }
    await Promise.all(slices.map((s) => worker(s)));

    console.log('\nLLM enrichment complete.');
    console.log(`Processed ${targets.length} realtors across ${countryStats.size} countries.`);
  } finally {
    client.release();
    await pgPool.end();
  }
}
