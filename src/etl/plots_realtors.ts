import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OUTPUTS_DIR = process.env.OUTPUTS_DIR || path.resolve(process.cwd(), 'outputs');
const REALTORS_DEFAULT_COUNTRY = process.env.REALTORS_DEFAULT_COUNTRY || 'PT';
// Prefer the Casafari search snapshot directory by default, as it contains the latest listings
const CASAFARI_SEARCH_DIR = process.env.CASAFARI_SEARCH_DIR || path.resolve(OUTPUTS_DIR, 'casafari-search');

function assertEnv() {
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
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
    console.error('Failed to read directory', dir, e);
  }
  return out;
}

function parseJsonSafe(p: string): any | undefined {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    console.warn('Skipping invalid JSON file:', p, e);
    return undefined;
  }
}

function cleanName(s?: any): string | undefined {
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t ? t : undefined;
}

function extractCompanyNamesFromListing(listing: any): { agency?: string; source_name?: string; companies: string[] } {
  const agency = cleanName(listing?.agency) || cleanName(listing?.agency?.name);
  const source_name = cleanName(listing?.source_name);
  const companies: string[] = [];
  const arr = Array.isArray(listing?.companies) ? listing.companies : [];
  for (const c of arr) {
    const nm = cleanName(c?.name) || cleanName(c?.company_name) || cleanName(c?.title);
    if (nm) companies.push(nm);
  }
  return { agency, source_name, companies };
}

function getPropertyIdFromResult(item: any): string | undefined {
  const propertyId = item?.property_id ?? item?.id ?? item?.property?.id;
  return propertyId != null ? String(propertyId) : undefined;
}

async function ensureJoinTable(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS plots_stage_realtors (
      plot_id UUID NOT NULL,
      realtor_id BIGINT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      source_file TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (plot_id, realtor_id, role)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_realtors_plot_idx ON plots_stage_realtors(plot_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_realtors_realtor_idx ON plots_stage_realtors(realtor_id);`);
}

export async function linkPlotsToRealtorsFromOutputs(baseDir?: string) {
  assertEnv();
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Load mapping from casafari_id -> { plot_id, country } from staging
    const propertyToPlot = new Map<string, { plot_id: string; country: string }>();
    {
      const { rows } = await client.query(
        `SELECT id::text AS id, casafari_id, COALESCE(country, $1) AS country 
         FROM plots_stage 
         WHERE casafari_id IS NOT NULL`,
        [REALTORS_DEFAULT_COUNTRY]
      );
      for (const r of rows) {
        propertyToPlot.set(String(r.casafari_id), {
          plot_id: String(r.id),
          country: String(r.country)
        });
      }
    }

    if (propertyToPlot.size === 0) {
      console.warn('No casafari_id found in plots_stage; cannot map outputs to plots.');
      await client.query('ROLLBACK');
      return;
    }

    await ensureJoinTable(client);

    // Build realtor map by (country, name) -> realtor_id for ALL countries
    const realtorByCountryAndName = new Map<string, number>();
    {
      const { rows } = await client.query(`SELECT id, company_name, country FROM realtors`);
      for (const r of rows) {
        const name = (r.company_name || '').trim().toLowerCase();
        const country = (r.country || REALTORS_DEFAULT_COUNTRY).trim().toUpperCase();
        if (name) {
          const key = `${country}|${name}`;
          realtorByCountryAndName.set(key, Number(r.id));
        }
      }
      console.log(`Loaded ${realtorByCountryAndName.size} realtor mappings from database`);
    }

    const dir = baseDir || CASAFARI_SEARCH_DIR;
    console.log('Scanning Casafari outputs (recursively) for plot->realtor links in:', dir);
    const filesWithCountry = listJsonFilesWithCountry(dir);
    if (!filesWithCountry.length) {
      console.log('No JSON files found.');
      await client.query('COMMIT');
      return;
    }

    console.log(`Found ${filesWithCountry.length} JSON files across all countries`);
    const fileStats = new Map<string, number>();
    for (const { country } of filesWithCountry) {
      fileStats.set(country, (fileStats.get(country) || 0) + 1);
    }
    for (const [country, count] of fileStats.entries()) {
      console.log(`  ${country}: ${count} files`);
    }

    const links: Array<{ plot_id: string; realtor_id: number; role: 'agency' | 'company' | 'source'; name: string; file: string }>
      = [];
    // Global deduplication across all files/items to ensure each plot is related to each realtor only once (ignoring role)
    const globalSeen = new Set<string>();
    let matchedCount = 0;
    let unmatchedCount = 0;
    let totalListingsProcessed = 0;
    let activeListingsProcessed = 0;
    const uniquePlots = new Set<string>();
    const roleStats = { agency: 0, company: 0, source: 0 };

    for (const { file, country: fileCountry } of filesWithCountry) {
      const json = parseJsonSafe(file);
      if (!json) continue;
      const results: any[] = Array.isArray(json?.results) ? json.results : (Array.isArray(json) ? json : []);
      for (const item of results) {
        // Map item to plot via casafari_id (property_id)
        const propId = getPropertyIdFromResult(item);
        const plotInfo = propId ? propertyToPlot.get(propId) : undefined;
        if (!plotInfo) continue;

        const plotId = plotInfo.plot_id;
        uniquePlots.add(plotId);
        // Use plot's country from database (more reliable than file path)
        const plotCountry = plotInfo.country;

        // Iterate listings for realtors - only process active listings
        const listings: any[] = Array.isArray(item?.listings) ? item.listings : (item?.listing ? [item.listing] : []);
        totalListingsProcessed += listings.length;
        // Filter for active listings only (sale_status === 'active' OR rent_status === 'active')
        const activeListings = listings.filter(l => l?.sale_status === 'active' || l?.rent_status === 'active');
        activeListingsProcessed += activeListings.length;
        // Per-plot (within this item) dedup to avoid repeated entries within the same item
        const seen = new Set<string>();
        for (const listing of (activeListings.length ? activeListings : [])) {
          const { agency, source_name, companies } = extractCompanyNamesFromListing(listing);
          const add = (nm?: string, role?: 'agency' | 'company' | 'source') => {
            if (!nm || !role) return;
            const nameLower = nm.trim().toLowerCase();
            // Match realtor by country and name
            const realtorKey = `${plotCountry}|${nameLower}`;
            const rid = realtorByCountryAndName.get(realtorKey);
            if (!rid) {
              unmatchedCount++;
              return; // only link to existing realtors
            }
            const dedupKey = `${plotId}|${rid}`;
            // Skip if we've already seen this plot-realtor pair either within this item or globally across files
            if (seen.has(dedupKey) || globalSeen.has(dedupKey)) return;
            seen.add(dedupKey);
            globalSeen.add(dedupKey);
            links.push({ plot_id: plotId!, realtor_id: rid, role, name: nm, file });
            roleStats[role]++;
            matchedCount++;
          };
          add(agency, 'agency');
          add(source_name, 'source');
          for (const c of companies) add(c, 'company');
        }
      }
    }

    console.log(`\n=== Processing Statistics ===`);
    console.log(`Unique plots processed: ${uniquePlots.size}`);
    console.log(`Total listings found: ${totalListingsProcessed}`);
    console.log(`Active listings: ${activeListingsProcessed}`);
    console.log(`Average active listings per plot: ${(activeListingsProcessed / uniquePlots.size).toFixed(2)}`);
    console.log(`\nMatched realtor references: ${matchedCount}`);
    console.log(`Unmatched realtor references: ${unmatchedCount}`);
    console.log(`\nLinks by role:`);
    console.log(`  Agency: ${roleStats.agency}`);
    console.log(`  Company: ${roleStats.company}`);
    console.log(`  Source: ${roleStats.source}`);
    console.log(`\nAverage realtors per plot: ${(links.length / uniquePlots.size).toFixed(2)}`);
    console.log(`Unique plot-realtor pairs: ${globalSeen.size}`);
    console.log(`Total links (with roles): ${links.length}`);
    console.log(`================================\n`);

    if (!links.length) {
      console.log('No plot->realtor links found to insert.');
      await client.query('COMMIT');
      return;
    }

    // Batch insert
    const batchSize = 2000;
    let inserted = 0;
    for (let i = 0; i < links.length; i += batchSize) {
      const batch = links.slice(i, i + batchSize);
      const params: any[] = [];
      const ph: string[] = [];
      batch.forEach((l, idx) => {
        const off = idx * 5;
        params.push(l.plot_id, l.realtor_id, l.role, l.name, l.file);
        ph.push(`($${off + 1}, $${off + 2}, $${off + 3}, $${off + 4}, $${off + 5})`);
      });
      await client.query(
        `INSERT INTO plots_stage_realtors (plot_id, realtor_id, role, name, source_file)
         VALUES ${ph.join(', ')}
         ON CONFLICT (plot_id, realtor_id, role) DO NOTHING`,
        params
      );
      inserted += batch.length;
      if (inserted % 4000 === 0 || inserted >= links.length) {
        console.log(`Inserted ${inserted}/${links.length} plot->realtor links...`);
      }
    }

    await client.query('COMMIT');
    console.log(`Completed linking ${links.length} plot->realtor relationships.`);
    
    // Show breakdown by country
    const linksByCountry = new Map<string, number>();
    for (const link of links) {
      const plotInfo = Array.from(propertyToPlot.values()).find(p => p.plot_id === link.plot_id);
      if (plotInfo) {
        linksByCountry.set(plotInfo.country, (linksByCountry.get(plotInfo.country) || 0) + 1);
      }
    }
    for (const [country, count] of linksByCountry.entries()) {
      console.log(`  ${country}: ${count} plot-realtor links`);
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to build plot->realtor links:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
