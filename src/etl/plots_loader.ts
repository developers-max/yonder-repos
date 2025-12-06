import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OUTPUTS_DIR = process.env.OUTPUTS_DIR || path.resolve(process.cwd(), 'outputs');

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

function listJsonFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...listJsonFilesRecursive(full));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
        files.push(full);
      }
    }
  } catch (e) {
    console.error('Failed to read directory', dir, e);
  }
  return files;
}

function parseJsonSafe(filePath: string): any | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Skipping invalid JSON file:', filePath, e);
    return undefined;
  }
}

type CandidateRow = {
  id: string; // upstream identifier used when plots.id is not UUID with default
  casafari_id?: string | null; // property_id as provided by Casafari
  size?: number | null; // from total_area
  price?: number | null; // from sale_price (EUR)
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null; // country of origin (ISO 2 code: PT, ES, DE)
  // Keep original for potential future mapping
  _raw?: any;
};

function extractRowsFromJson(json: any, country?: string): CandidateRow[] {
  const out: CandidateRow[] = [];
  if (!json) return out;

  // Common patterns: either { results: [...] } or an array of items
  const arr: any[] = Array.isArray(json?.results) ? json.results : (Array.isArray(json) ? json : []);
  if (!Array.isArray(arr) || arr.length === 0) return out;

  for (const item of arr) {
    try {
      // Prefer Casafari property_id for casafari_id column
      const propertyId = item?.property_id ?? item?.id ?? item?.property?.id;
      const listingId = item?.primary_listing_id ?? item?.listing_id ?? item?.listing?.listing_id;
      const coords = item?.coordinates || item?.location?.coordinates || item?.listing?.coordinates;
      const lat = typeof coords?.latitude === 'number' ? coords.latitude : null;
      const lon = typeof coords?.longitude === 'number' ? coords.longitude : null;
      const size = typeof item?.total_area === 'number' ? item.total_area : null;
      const price = typeof item?.sale_price === 'number' ? item.sale_price : null;

      // Derive a loader row id; keep it deterministic across runs
      let id: string | undefined;
      if (propertyId != null) id = String(propertyId);
      else if (listingId != null) id = String(listingId);

      if (!id) {
        // Skip entries without any stable identifier
        continue;
      }

      const casafari_id = propertyId != null ? String(propertyId) : null;

      out.push({ id, casafari_id, size, price, latitude: lat, longitude: lon, country: country || null, _raw: item });
    } catch (e) {
      // Skip malformed items
      continue;
    }
  }
  return out;
}

type ColumnMeta = { data_type: string; column_default: string | null };
async function getTableColumnsMeta(client: any, tableName: string): Promise<Map<string, ColumnMeta>> {
  const { rows } = await client.query(
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const meta = new Map<string, ColumnMeta>();
  for (const r of rows) {
    meta.set(r.column_name, { data_type: r.data_type, column_default: r.column_default ?? null });
  }
  return meta;
}

function chooseInsertColumns(meta: Map<string, ColumnMeta>) {
  const available = new Set<string>(Array.from(meta.keys()));
  const idMeta = meta.get('id');
  const idIsUuid = (idMeta?.data_type || '').toLowerCase() === 'uuid';
  const idHasDefault = !!idMeta?.column_default;

  // Start with preferred order
  const preferredOrder = ['id', 'casafari_id', 'size', 'price', 'latitude', 'longitude', 'country', 'enriched'];
  let cols = preferredOrder.filter((c) => available.has(c));

  // If id is UUID and has a default, omit id to let DB generate it
  if (idIsUuid && idHasDefault) {
    cols = cols.filter((c) => c !== 'id');
  } else {
    // Ensure id appears first when we need to supply it
    if (!cols.includes('id') && available.has('id')) cols.unshift('id');
  }

  return { cols, idIsUuid, idHasDefault };
}

function rowValuesForColumns(row: CandidateRow, cols: string[], idIsUuid: boolean, idHasDefault: boolean): any[] {
  return cols.map((c) => {
    switch (c) {
      case 'id': {
        if (idIsUuid) {
          // If no default, we must provide a UUID
          if (!idHasDefault) return randomUUID();
        }
        return row.id; // non-UUID id (e.g., text) or UUID when default exists but we wouldn't include id
      }
      case 'casafari_id':
        return row.casafari_id != null ? row.casafari_id : null;
      case 'latitude':
        return row.latitude != null ? row.latitude : null;
      case 'longitude':
        return row.longitude != null ? row.longitude : null;
      case 'size':
        return row.size != null ? row.size : null;
      case 'price':
        return row.price != null ? row.price : null;
      case 'country':
        return row.country != null ? row.country : null;
      case 'enriched':
        return false; // loader is a fresh staging table
      default:
        return null;
    }
  });
}

export async function loadPlotsFromOutputs(baseDir?: string, options?: { truncate?: boolean; country?: string }) {
  assertEnv();
  const dir = baseDir || OUTPUTS_DIR;
  const shouldTruncate = options?.truncate ?? true; // default to true for backward compatibility
  const country = options?.country;
  console.log('Loading plots from outputs directory:', dir);
  if (country) console.log('Country:', country);

  const files = listJsonFilesRecursive(dir);
  if (!files.length) {
    console.log('No JSON files found under outputs. Nothing to do.');
    return;
  }

  console.log(`Found ${files.length} JSON file(s). Parsing and extracting candidate rows...`);
  const candidates: CandidateRow[] = [];
  for (const f of files) {
    const json = parseJsonSafe(f);
    if (!json) continue;
    const rows = extractRowsFromJson(json, country);
    if (rows.length) candidates.push(...rows);
  }

  if (!candidates.length) {
    console.log('No candidate plot rows found in outputs.');
    return;
  }

  // De-duplicate by id
  const dedup = new Map<string, CandidateRow>();
  for (const r of candidates) {
    if (!dedup.has(r.id)) dedup.set(r.id, r);
  }
  const rows = Array.from(dedup.values());
  console.log(`Prepared ${rows.length} unique plot row(s) for loading.`);

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure staging table mirrors plots columns but avoids copying constraints into staging
    await client.query(`CREATE TABLE IF NOT EXISTS plots_stage (LIKE plots INCLUDING DEFAULTS);`);
    // Add casafari_id to staging if missing
    await client.query(`ALTER TABLE plots_stage ADD COLUMN IF NOT EXISTS casafari_id TEXT;`);
    await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_casafari_id_idx ON plots_stage(casafari_id);`);
    // Ensure bubble_id is removed from staging per new plan
    await client.query(`ALTER TABLE plots_stage DROP COLUMN IF EXISTS bubble_id;`);
    // Add size and price columns if missing
    await client.query(`ALTER TABLE plots_stage ADD COLUMN IF NOT EXISTS size NUMERIC;`);
    await client.query(`ALTER TABLE plots_stage ADD COLUMN IF NOT EXISTS price NUMERIC;`);
    // Add country column if missing
    await client.query(`ALTER TABLE plots_stage ADD COLUMN IF NOT EXISTS country TEXT;`);
    await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_country_idx ON plots_stage(country);`);

    // Start from scratch if truncate is enabled
    if (shouldTruncate) {
      console.log('Truncating plots_stage table...');
      await client.query(`TRUNCATE TABLE plots_stage;`);
    }

    // Discover available columns and id behavior from staging (plots_stage)
    const meta = await getTableColumnsMeta(client, 'plots_stage');
    const { cols: insertCols, idIsUuid, idHasDefault } = chooseInsertColumns(meta);
    const colListSql = insertCols.map((c) => '"' + c + '"').join(', ');

    // Batch insert
    const batchSize = 1000;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: any[] = [];
      const placeholders: string[] = [];
      batch.forEach((r, idx) => {
        const vals = rowValuesForColumns(r, insertCols, idIsUuid, idHasDefault);
        values.push(...vals);
        const offset = idx * insertCols.length;
        const ph = insertCols.map((_, j) => `$${offset + j + 1}`);
        placeholders.push(`(${ph.join(', ')})`);
      });

      const sql = `INSERT INTO plots_stage (${colListSql}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING;`;
      await client.query(sql, values);
      inserted += batch.length;
      if (inserted % 2000 === 0 || inserted === rows.length) {
        console.log(`Inserted ${inserted}/${rows.length} rows into plots_stage...`);
      }
    }

    await client.query('COMMIT');
    console.log(`Completed loading ${rows.length} rows into plots_stage.`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to load plots into plots_stage:', e);
  } finally {
    client.release();
    await pool.end();
  }
}
