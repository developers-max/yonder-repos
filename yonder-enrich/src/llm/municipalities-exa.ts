import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import Exa from 'exa-js';

dotenv.config();

const EXA_API_KEY = process.env.EXA_API_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

const BATCH_LIMIT = Number(process.env.LLM_MUNICIPALITIES_LIMIT || '5000');
const CONCURRENCY = Math.max(1, Math.min(+(process.env.LLM_MUNICIPALITIES_CONCURRENCY || '2'), 8));
const PER_REQUEST_DELAY_MS = Math.max(0, Number(process.env.LLM_MUNICIPALITIES_DELAY_MS || '5'));
const MAX_RETRIES = Math.max(0, Number(process.env.LLM_MUNICIPALITIES_MAX_RETRIES || '3'));

function assertEnv() {
  if (!EXA_API_KEY) throw new Error('Missing EXA_API_KEY');
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeUrl(u?: string | null): string {
  if (!u) return '';
  try {
    const url = new URL(u.startsWith('http') ? u : `https://${u}`);
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
  country?: string;
}

async function fetchTargetMunicipalities(client: any, limit: number, forceRefresh: boolean = false): Promise<TargetMunicipality[]> {
  const query = forceRefresh
    ? `SELECT id, name, district, country FROM municipalities ORDER BY name LIMIT $1`
    : `SELECT id, name, district, country FROM municipalities WHERE website IS NULL ORDER BY name LIMIT $1`;
  
  const { rows } = await client.query(query, [limit]);
  return rows.map((r: any) => ({ 
    id: r.id, 
    name: r.name, 
    district: r.district,
    country: r.country
  }));
}

interface ExaMunicipalityResult {
  website_url?: string;
  source_urls?: string[];
}

/**
 * Search for official municipality website using Exa
 */
async function searchMunicipalityWebsite(
  exa: Exa, 
  name: string, 
  district?: string,
  country?: string
): Promise<ExaMunicipalityResult | null> {
  // Build search queries based on country/region
  const countryHints: Record<string, string[]> = {
    'PT': ['Câmara Municipal', 'Município', 'site oficial', 'cm-'],
    'ES': ['Ayuntamiento', 'Ajuntament', 'web oficial'],
    'DE': ['Gemeinde', 'Stadtverwaltung', 'Stadt'],
    'FR': ['Mairie', 'Commune', 'ville'],
    'IT': ['Comune di', 'sito ufficiale'],
  };

  const hints = country && countryHints[country] ? countryHints[country] : [];
  const districtInfo = district ? ` ${district}` : '';
  
  // Primary search query
  const searchQuery = hints.length > 0
    ? `${hints[0]} ${name}${districtInfo} official website`
    : `${name}${districtInfo} municipality official government website`;

  try {
    const result = await exa.searchAndContents(searchQuery, {
      numResults: 5,
      type: 'auto',
      text: { maxCharacters: 500 },
      // Focus on government/official domains
      includeDomains: country === 'PT' 
        ? undefined // Let Exa find .pt domains
        : undefined,
    });

    if (!result.results || result.results.length === 0) {
      console.log(`  No results found for "${name}"`);
      return null;
    }

    // Filter for likely official municipal websites
    const officialPatterns = [
      // Portuguese patterns
      /cm-[\w-]+\.pt/i,
      /municipio[\w-]*\.pt/i,
      /[\w-]+\.gov\.pt/i,
      // Spanish patterns  
      /ayto-[\w-]+\.es/i,
      /ayuntamiento[\w-]*\.es/i,
      /[\w-]+\.gob\.es/i,
      /[\w-]+\.cat/i,
      // German patterns
      /[\w-]+\.de\/stadt/i,
      /stadt-[\w-]+\.de/i,
      /gemeinde-[\w-]+\.de/i,
      // French patterns
      /mairie-[\w-]+\.fr/i,
      /ville-[\w-]+\.fr/i,
      // Italian patterns
      /comune\.[\w-]+\.it/i,
      // Generic government patterns
      /\.gov\./i,
      /\.gob\./i,
    ];

    // Patterns to exclude (not official sites)
    const excludePatterns = [
      /wikipedia\./i,
      /facebook\.com/i,
      /twitter\.com/i,
      /x\.com/i,
      /linkedin\.com/i,
      /tripadvisor/i,
      /booking\.com/i,
      /google\.com/i,
      /yelp\./i,
      /yellowpages/i,
      /foursquare/i,
    ];

    // Score and rank results
    const scoredResults = result.results
      .filter(r => !excludePatterns.some(pattern => pattern.test(r.url)))
      .map(r => {
        let score = 0;
        const url = r.url.toLowerCase();
        const title = (r.title || '').toLowerCase();
        const text = (r.text || '').toLowerCase();
        const nameLower = name.toLowerCase();

        // Official domain patterns
        if (officialPatterns.some(pattern => pattern.test(url))) score += 50;
        
        // Contains municipality name in URL
        if (url.includes(nameLower.replace(/\s+/g, '-')) || 
            url.includes(nameLower.replace(/\s+/g, ''))) score += 30;
        
        // Title contains official keywords
        if (title.includes('câmara municipal') || 
            title.includes('ayuntamiento') ||
            title.includes('municipality') ||
            title.includes('gemeinde') ||
            title.includes('mairie') ||
            title.includes('comune')) score += 20;
        
        // Title contains municipality name
        if (title.includes(nameLower)) score += 15;
        
        // Text mentions official/government
        if (text.includes('official') || text.includes('government') || 
            text.includes('municipal') || text.includes('câmara')) score += 10;

        return { ...r, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scoredResults.length === 0) {
      console.log(`  No suitable results for "${name}" after filtering`);
      return null;
    }

    const bestResult = scoredResults[0];
    const website = normalizeUrl(bestResult.url);

    if (!website) {
      return null;
    }

    console.log(`  Found: ${website} (score: ${bestResult.score})`);

    return {
      website_url: website,
      source_urls: scoredResults.slice(0, 3).map(r => r.url),
    };

  } catch (error) {
    console.error(`  Error searching for "${name}":`, error);
    return null;
  }
}

async function updateMunicipalityWebsite(client: any, id: number, websiteUrl: string) {
  await client.query(
    `UPDATE municipalities 
     SET website = $1, updated_at = NOW()
     WHERE id = $2`,
    [websiteUrl, id]
  );
}

async function ensureMunicipalitiesSchema(client: any) {
  await client.query(`
    ALTER TABLE municipalities 
    ADD COLUMN IF NOT EXISTS country VARCHAR(2)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_municipalities_country 
    ON municipalities(country)
  `);
}

export async function enrichMunicipalitiesWithExa(options?: { 
  limit?: number; 
  concurrency?: number;
  municipalityIds?: number[];
  forceRefresh?: boolean; // If true, process all municipalities regardless of existing website
}) {
  assertEnv();
  const pgPool: Pool = new Pool({ 
    connectionString: DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
  });
  const exa = new Exa(EXA_API_KEY);

  const limit = options?.limit ?? BATCH_LIMIT;
  const concurrency = options?.concurrency ?? CONCURRENCY;
  const forceRefresh = options?.forceRefresh ?? false;

  const client = await pgPool.connect();
  try {
    await ensureMunicipalitiesSchema(client);

    let targets: TargetMunicipality[];
    
    if (options?.municipalityIds && options.municipalityIds.length > 0) {
      const { rows } = await client.query(
        `SELECT id, name, district, country
         FROM municipalities
         WHERE id = ANY($1)
         ORDER BY name`,
        [options.municipalityIds]
      );
      targets = rows.map((r: any) => ({ 
        id: r.id, 
        name: r.name, 
        district: r.district,
        country: r.country
      }));
    } else {
      targets = await fetchTargetMunicipalities(client, limit, forceRefresh);
    }

    if (!targets.length) {
      console.log('No municipalities require website enrichment.');
      return;
    }

    console.log(`Enriching ${targets.length} municipalities with Exa Search...`);

    let idx = 0;
    let successCount = 0;
    let failureCount = 0;

    const isRetryableError = (e: any): boolean => {
      const status = e?.status || e?.response?.status;
      if (status === 429 || (status >= 500 && status < 600)) return true;
      if (e?.name === 'TypeError' || /fetch failed/i.test(String(e))) return true;
      return false;
    };

    const backoffMs = (attempt: number): number => {
      const base = Math.max(500, PER_REQUEST_DELAY_MS);
      const cap = 60000;
      const exp = Math.min(cap, base * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 500);
      return exp + jitter;
    };

    const worker = async (municipalities: TargetMunicipality[]) => {
      for (const municipality of municipalities) {
        idx += 1;
        let attempts = 0;
        let done = false;

        console.log(`[${idx}/${targets.length}] Processing: ${municipality.name}${municipality.district ? ` (${municipality.district})` : ''}...`);

        while (!done) {
          try {
            const result = await searchMunicipalityWebsite(
              exa, 
              municipality.name, 
              municipality.district,
              municipality.country
            );

            if (result?.website_url) {
              await updateMunicipalityWebsite(client, municipality.id, result.website_url);
              console.log(`✓ Updated: ${municipality.name} | Website: ${result.website_url}`);
              successCount++;
            } else {
              console.warn(`✗ No website found for: ${municipality.name}`);
              failureCount++;
            }
            done = true;
          } catch (e: any) {
            attempts += 1;
            if (attempts <= MAX_RETRIES && isRetryableError(e)) {
              const wait = backoffMs(attempts - 1);
              console.warn(`  Retry ${attempts}/${MAX_RETRIES} for "${municipality.name}" after ${wait}ms`);
              await sleep(wait);
              continue;
            } else {
              console.error(`✗ Failed for "${municipality.name}":`, e?.message || e);
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

    console.log('\n=== Municipality Exa Enrichment Complete ===');
    console.log(`Total processed: ${targets.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
  } finally {
    client.release();
    await pgPool.end();
  }
}
