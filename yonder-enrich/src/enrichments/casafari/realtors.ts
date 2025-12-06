import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const CASAFARI_OUTPUT_DIR = process.env.CASAFARI_OUTPUT_DIR || path.resolve(process.cwd(), 'outputs', 'casafari-search');
const REALTORS_DEFAULT_COUNTRY = process.env.REALTORS_DEFAULT_COUNTRY || 'PT';

const pgPool: Pool | null = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

type Realtor = {
  company_name: string;
  country: string;
  website_url?: string | null;
  email?: string | null;
  telephone?: string | null;
};

function pickFirst<T>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v as T;
  }
  return undefined;
}

function extractFromAgency(agency: any, country: string): Realtor[] {
  const out: Realtor[] = [];
  if (!agency || typeof agency !== 'object') return out;

  const companies = Array.isArray(agency.companies) ? agency.companies : [];
  if (!companies.length) {
    // Sometimes agency might directly have name/contact info
    const name = pickFirst<string>(agency.name, agency.company_name, agency.title);
    if (name) {
      const website = pickFirst<string>(agency.website, agency.url, agency.homepage);
      const email = pickFirst<string>(agency.email, Array.isArray(agency.emails) ? agency.emails[0] : undefined);
      const phoneRaw = pickFirst<string>(agency.phone, agency.telephone);
      const phone = phoneRaw || (Array.isArray(agency.phones) ? (agency.phones[0]?.number || agency.phones[0]) : undefined);
      out.push({ company_name: String(name).trim(), country, website_url: website || null, email: email || null, telephone: phone || null });
    }
    return out;
  }

  for (const c of companies) {
    if (!c || typeof c !== 'object') continue;
    const name = pickFirst<string>(c.name, c.company_name, c.title);
    if (!name) continue;
    const website = pickFirst<string>(c.website, c.url, c.homepage);
    const email = pickFirst<string>(c.email, Array.isArray(c.emails) ? c.emails[0] : undefined);
    const phoneRaw = pickFirst<string>(c.phone, c.telephone);
    const phone = phoneRaw || (Array.isArray(c.phones) ? (c.phones[0]?.number || c.phones[0]) : undefined);
    out.push({ company_name: String(name).trim(), country, website_url: website || null, email: email || null, telephone: phone || null });
  }
  return out;
}

function extractFromCompanies(companies: any[], country: string): Realtor[] {
  const out: Realtor[] = [];
  if (!Array.isArray(companies)) return out;
  for (const c of companies) {
    if (!c || typeof c !== 'object') continue;
    const name = pickFirst<string>(c.name, c.company_name, c.title);
    if (!name) continue;
    const website = pickFirst<string>(c.website, c.url, c.homepage);
    const email = pickFirst<string>(c.email, Array.isArray(c.emails) ? c.emails[0] : undefined);
    const phoneRaw = pickFirst<string>(c.phone, c.telephone);
    const phone = phoneRaw || (Array.isArray(c.phones) ? (c.phones[0]?.number || c.phones[0]) : undefined);
    out.push({ company_name: String(name).trim(), country, website_url: website || null, email: email || null, telephone: phone || null });
  }
  return out;
}

function normalizeKey(r: Realtor): string {
  const name = r.company_name.trim().toLowerCase();
  const country = (r.country || REALTORS_DEFAULT_COUNTRY).trim().toLowerCase();
  return `${country}|${name}`;
}

/**
 * Recursively list all JSON files and detect country from folder structure
 */
function listJsonFilesWithCountry(dir: string, detectedCountry?: string): Array<{ file: string; country: string }> {
  const out: Array<{ file: string; country: string }> = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Detect country from folder name
        const folderCountry = detectCountryFromPath(e.name);
        const country = folderCountry || detectedCountry || REALTORS_DEFAULT_COUNTRY;
        out.push(...listJsonFilesWithCountry(full, country));
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) {
        out.push({ file: full, country: detectedCountry || REALTORS_DEFAULT_COUNTRY });
      }
    }
  } catch (e) {
    console.error('Failed to list directory', dir, e);
  }
  return out;
}

/**
 * Detect country code from folder/file path
 */
function detectCountryFromPath(pathSegment: string): string | undefined {
  const lower = pathSegment.toLowerCase();
  if (lower.includes('portugal') || lower === 'pt') return 'PT';
  if (lower.includes('spain') || lower.includes('espana') || lower.includes('españa') || lower === 'es') return 'ES';
  if (lower.includes('germany') || lower.includes('deutschland') || lower === 'de') return 'DE';
  return undefined;
}

function parseJsonFile(filePath: string): any | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Skipping invalid JSON file:', filePath, e);
    return undefined;
  }
}

async function ensureRealtorsTable(client: any) {
  // Base table with desired schema
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

  // Migrate existing tables: add missing columns
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS country TEXT`);
  await client.query(`UPDATE realtors SET country = $1 WHERE country IS NULL OR country = ''`, [REALTORS_DEFAULT_COUNTRY]);
  await client.query(`ALTER TABLE realtors ALTER COLUMN country SET NOT NULL`);

  // Ensure id column exists with default sequence
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS id BIGSERIAL`);
  // Backfill NULL ids using default
  await client.query(`UPDATE realtors SET id = DEFAULT WHERE id IS NULL`);
  // Add primary key on id if missing
  await client.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'realtors'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE realtors ADD PRIMARY KEY (id);
    END IF;
  END$$;`);

  // Drop previous unique on (company_name, website_url) if exists
  await client.query(`ALTER TABLE realtors DROP CONSTRAINT IF EXISTS realtors_company_website_uidx`);
  await client.query(`DROP INDEX IF EXISTS realtors_company_website_uidx`);

  // Create new unique constraint on (country, company_name) if missing
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

async function upsertRealtor(client: any, r: Realtor) {
  const website = (r.website_url || '').trim();
  const country = (r.country || REALTORS_DEFAULT_COUNTRY).trim();
  await client.query(
    `INSERT INTO realtors (company_name, country, website_url, email, telephone)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ON CONSTRAINT realtors_country_name_uidx DO UPDATE SET
       email = COALESCE(EXCLUDED.email, realtors.email),
       telephone = COALESCE(EXCLUDED.telephone, realtors.telephone)`,
    [r.company_name, country, website, r.email || null, r.telephone || null]
  );
}

export async function extractAndStoreRealtorsFromCasafariOutputs(baseDir?: string) {
  assertEnv();
  if (!pgPool) throw new Error('DATABASE_URL not configured.');

  const dir = baseDir || CASAFARI_OUTPUT_DIR;
  console.log('Scanning Casafari outputs (recursively) for realtor companies in:', dir);

  const filesWithCountry = listJsonFilesWithCountry(dir);
  if (!filesWithCountry.length) {
    console.log('No JSON files found. Nothing to do.');
    return;
  }

  console.log(`Found ${filesWithCountry.length} JSON files across all countries`);
  const countryStats = new Map<string, number>();
  for (const { country } of filesWithCountry) {
    countryStats.set(country, (countryStats.get(country) || 0) + 1);
  }
  for (const [country, count] of countryStats.entries()) {
    console.log(`  ${country}: ${count} files`);
  }

  const unique = new Map<string, Realtor>();

  for (const { file, country } of filesWithCountry) {
    const json = parseJsonFile(file);
    if (!json) continue;
    const results = Array.isArray(json?.results) ? json.results : Array.isArray(json) ? json : [];
    for (const item of results) {
      const listings = Array.isArray(item?.listings)
        ? item.listings
        : (item?.listing ? [item.listing] : []);

      const entries = listings.length ? listings : [item];

      for (const entry of entries) {
        // Prefer companies array when present
        const companies = Array.isArray(entry?.companies) ? entry.companies : [];
        const fromCompanies = extractFromCompanies(companies, country);
        for (const r of fromCompanies) {
          const key = normalizeKey(r);
          if (!unique.has(key)) unique.set(key, r);
          else {
            const prev = unique.get(key)!;
            if (!prev.email && r.email) prev.email = r.email;
            if (!prev.telephone && r.telephone) prev.telephone = r.telephone;
          }
        }

        // Also consider agency object at the same level
        const agency = entry?.agency || undefined;
        const fromAgency = extractFromAgency(agency, country);
        for (const r of fromAgency) {
          const key = normalizeKey(r);
          if (!unique.has(key)) unique.set(key, r);
          else {
            const prev = unique.get(key)!;
            if (!prev.email && r.email) prev.email = r.email;
            if (!prev.telephone && r.telephone) prev.telephone = r.telephone;
          }
        }

        // Finally, use listing.source_name as a fallback for company name
        const sourceName = typeof entry?.source_name === 'string' ? entry.source_name.trim() : undefined;
        if (sourceName) {
          const r = { company_name: sourceName, country, website_url: null, email: null, telephone: null } as Realtor;
          const key = normalizeKey(r);
          if (!unique.has(key)) unique.set(key, r);
        }
      }
    }
  }

  console.log(`Found ${unique.size} unique realtor companies across all countries. Upserting to database...`);
  
  // Show breakdown by country
  const realtorsByCountry = new Map<string, number>();
  for (const r of unique.values()) {
    realtorsByCountry.set(r.country, (realtorsByCountry.get(r.country) || 0) + 1);
  }
  for (const [country, count] of realtorsByCountry.entries()) {
    console.log(`  ${country}: ${count} realtors`);
  }

  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await ensureRealtorsTable(client);
    let i = 0;
    for (const r of unique.values()) {
      await upsertRealtor(client, r);
      i += 1;
      if (i % 200 === 0) console.log(`Upserted ${i}/${unique.size} realtors...`);
    }
    await client.query('COMMIT');
    console.log(`Completed upserting ${unique.size} realtor companies.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to upsert realtors:', e);
  } finally {
    client.release();
  }
}
