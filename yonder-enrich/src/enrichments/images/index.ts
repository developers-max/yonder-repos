import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const OUTPUTS_DIR = process.env.OUTPUTS_DIR || path.resolve(process.cwd(), 'outputs');

function assertEnv() {
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
}

function listJsonFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...listJsonFilesRecursive(full));
      else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) out.push(full);
    }
  } catch (e) {
    // ignore missing dir
  }
  return out;
}

function parseJsonSafe(filePath: string): any | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function extractPicturesFromItem(item: any): string[] {
  const urls: string[] = [];
  const pushAll = (arr: any) => {
    if (Array.isArray(arr)) {
      for (const v of arr) if (typeof v === 'string' && /^https?:\/\//i.test(v)) urls.push(v);
    }
  };
  // Common fields observed: pictures; also attempt other common names
  pushAll(item?.pictures);
  pushAll(item?.images);
  pushAll(item?.image_urls);
  pushAll(item?.photos);
  pushAll(item?.thumbnails);
  return Array.from(new Set(urls));
}

function extractIdFromItem(item: any): { casafariId?: string; fallbackId?: string } {
  const propertyId = item?.property_id ?? item?.id ?? item?.property?.id;
  const listingId = item?.primary_listing_id ?? item?.listing_id ?? item?.listing?.listing_id;
  const casafariId = propertyId != null ? String(propertyId) : undefined;
  const fallbackId = listingId != null ? String(listingId) : undefined;
  return { casafariId, fallbackId };
}

export async function enrichImagesFromOutputs(baseDir?: string) {
  assertEnv();
  const dir = baseDir || OUTPUTS_DIR;
  console.log('Scanning outputs for Casafari images in:', dir);

  const files = listJsonFilesRecursive(dir);
  if (!files.length) {
    console.log('No JSON files found under outputs. Nothing to do.');
    return;
  }

  // Aggregate images per identifier
  const imagesByCasafariId = new Map<string, Set<string>>();
  const imagesByFallbackId = new Map<string, Set<string>>();

  let filesParsed = 0;
  for (const f of files) {
    const json = parseJsonSafe(f);
    if (!json) continue;
    const arr: any[] = Array.isArray(json?.results) ? json.results : (Array.isArray(json) ? json : []);
    if (!Array.isArray(arr) || !arr.length) continue;

    for (const item of arr) {
      const pics = extractPicturesFromItem(item);
      if (!pics.length) continue;
      const { casafariId, fallbackId } = extractIdFromItem(item);
      if (casafariId) {
        if (!imagesByCasafariId.has(casafariId)) imagesByCasafariId.set(casafariId, new Set());
        const set = imagesByCasafariId.get(casafariId)!;
        for (const u of pics) set.add(u);
      } else if (fallbackId) {
        if (!imagesByFallbackId.has(fallbackId)) imagesByFallbackId.set(fallbackId, new Set());
        const set = imagesByFallbackId.get(fallbackId)!;
        for (const u of pics) set.add(u);
      }
    }
    filesParsed++;
    if (filesParsed % 50 === 0) console.log(`Parsed ${filesParsed}/${files.length} files...`);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // Ensure target table and column exist
    await client.query('CREATE TABLE IF NOT EXISTS enriched_plots_stage (LIKE enriched_plots INCLUDING ALL)');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS images jsonb');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_url TEXT');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_json JSONB');

    const updateFromEntries = async (
      entries: Array<[string, string[]]>,
      joinOn: 'casafari_id' | 'id_text',
      coalesceExisting: boolean
    ) => {
      for (let i = 0; i < entries.length; i += 200) {
        const batch = entries.slice(i, i + 200);
        if (!batch.length) continue;
        const values: any[] = [];
        const tuples: string[] = [];
        batch.forEach((e, idx) => {
          const [ident, arr] = e;
          values.push(ident, JSON.stringify(arr));
          tuples.push(`($${idx * 2 + 1}::text, $${idx * 2 + 2}::jsonb)`);
        });
        const cte = `WITH data(ident, images) AS (VALUES ${tuples.join(', ')})`;
        const joinCond = joinOn === 'casafari_id'
          ? `JOIN public.plots_stage ps ON ps.casafari_id::text = data.ident`
          : `JOIN public.plots_stage ps ON ps.id::text = data.ident`;
        const setExpr = coalesceExisting ? `SET images = COALESCE(eps.images, data.images)` : `SET images = data.images`;
        const sql = `${cte}
UPDATE public.enriched_plots_stage eps
${setExpr}
FROM data
${joinCond}
WHERE eps.id = ps.id`;
        await client.query(sql, values);
      }
    };

    // Update via casafari_id -> plots_stage.id -> enriched_plots_stage.id
    const casafariEntries: Array<[string, string[]]> = Array.from(imagesByCasafariId.entries()).map(([k, v]) => [k, Array.from(v)]);
    await updateFromEntries(casafariEntries, 'casafari_id', false);

    // Fallback: join using plots_stage.id::text
    const fallbackEntries: Array<[string, string[]]> = Array.from(imagesByFallbackId.entries()).map(([k, v]) => [k, Array.from(v)]);
    await updateFromEntries(fallbackEntries, 'id_text', true);

    console.log('Images enrichment complete.');
  } finally {
    client.release();
    await pool.end();
  }
}
