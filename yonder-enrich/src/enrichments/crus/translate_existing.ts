import { Pool } from 'pg';
import dotenv from 'dotenv';
import { translateZoningLabel } from '../../llm/translate';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const CRUS_TRANSLATE_ONLY_MISSING = (process.env.CRUS_TRANSLATE_ONLY_MISSING || 'true').toLowerCase() === 'true';
const CRUS_TRANSLATE_LIMIT = Math.max(1, Number(process.env.CRUS_TRANSLATE_LIMIT || '100'));
const CRUS_TRANSLATE_CONCURRENCY = Math.max(1, Math.min(Number(process.env.CRUS_TRANSLATE_CONCURRENCY || '2'), 8));
const CRUS_TRANSLATE_DELAY_MS = Math.max(0, Number(process.env.CRUS_TRANSLATE_DELAY_MS || '250'));
const CRUS_TRANSLATE_MAX_RETRIES = Math.max(0, Number(process.env.CRUS_TRANSLATE_MAX_RETRIES || '3'));
const CRUS_TRANSLATE_STATEMENT_TIMEOUT_MS = Math.max(0, Number(process.env.CRUS_TRANSLATE_STATEMENT_TIMEOUT_MS || '120000'));
const CRUS_TRANSLATE_SCAN_ALL = (process.env.CRUS_TRANSLATE_SCAN_ALL || 'false').toLowerCase() === 'true';
const CRUS_TRANSLATE_BATCH_SIZE = Math.max(1, Number(process.env.CRUS_TRANSLATE_BATCH_SIZE || '1000'));

function assertEnv() {
  if (!DATABASE_URL) throw new Error('Missing DATABASE_URL');
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function backoffMs(attempt: number): number {
  const base = Math.max(200, CRUS_TRANSLATE_DELAY_MS || 250);
  const cap = 20000;
  const exp = Math.min(cap, base * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

async function fetchTargets(client: any, limit: number): Promise<Array<{ id: string; enrichment_data: any; country: string }>> {
  const whereMissing = CRUS_TRANSLATE_ONLY_MISSING
    ? "AND (enrichment_data->'zoning'->>'label_en') IS NULL"
    : '';
  const sql = `
    SELECT e.id, e.enrichment_data, COALESCE(p.country, 'PT') AS country
    FROM enriched_plots_stage e
    LEFT JOIN plots_stage p ON e.id = p.id
    WHERE e.enrichment_data ? 'zoning'
      AND (e.enrichment_data->'zoning'->>'label') IS NOT NULL
      ${whereMissing}
    ORDER BY e.id
    LIMIT $1`;
  const { rows } = await client.query(sql, [limit]);
  return rows;
}

async function fetchBatchAll(client: any, lastId: string | null, limit: number): Promise<Array<{ id: string; enrichment_data: any; country: string }>> {
  const sql = `
    SELECT e.id, e.enrichment_data, COALESCE(p.country, 'PT') AS country
    FROM enriched_plots_stage e
    LEFT JOIN plots_stage p ON e.id = p.id
    WHERE ($1::uuid IS NULL OR e.id > $1::uuid)
    ORDER BY e.id
    LIMIT $2`;
  const { rows } = await client.query(sql, [lastId, limit]);
  return rows;
}

async function updateOne(client: any, id: string, enrichment_data: any): Promise<void> {
  await client.query(
    `UPDATE enriched_plots_stage SET enrichment_data = $2::jsonb WHERE id = $1`,
    [id, JSON.stringify(enrichment_data)]
  );
}

export async function translateExistingCRUSLabels() {
  assertEnv();
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // NOTE: Now supports multi-country zoning translation (PT, ES, DE, etc.)
    // Auto-detects source language from plot country
    // Increase statement_timeout for this session to avoid cancellations on JSONB scans
    if (CRUS_TRANSLATE_STATEMENT_TIMEOUT_MS > 0) {
      await client.query(`SET statement_timeout = ${CRUS_TRANSLATE_STATEMENT_TIMEOUT_MS}`);
    }
    
    // Map country code to language code
    const countryToLang: Record<string, string> = {
      'PT': 'pt',
      'ES': 'es',
      'DE': 'de',
      'GB': 'en',
      'UK': 'en',
    };
    
    // Worker that translates a list of rows
    let processed = 0;
    async function worker(items: Array<{ id: string; enrichment_data: any; country: string }>) {
      for (const row of items) {
        const id = row.id;
        const ed = row.enrichment_data || {};
        const zoning = ed.zoning || {};
        const label = zoning.label;
        const country = row.country || 'PT';
        const sourceLang = countryToLang[country.toUpperCase()] || 'pt';
        
        if (!label || typeof label !== 'string') continue;
        if (CRUS_TRANSLATE_ONLY_MISSING && typeof zoning.label_en === 'string' && zoning.label_en.trim() !== '') {
          continue;
        }

        let attempts = 0;
        while (true) {
          try {
            const t = await translateZoningLabel(label, {
              municipality: undefined,
              collectionId: zoning.typename,
              sourceLangHint: sourceLang,
              targetLang: 'en',
            });
            if (t?.label_en) {
              zoning.label_en = t.label_en;
              if (typeof t.confidence === 'number') zoning.translation_confidence = t.confidence;
              if (t.notes) zoning.translation_notes = t.notes;
              ed.zoning = zoning;
              await updateOne(client, id, ed);
            }
            break;
          } catch (e) {
            attempts += 1;
            if (attempts <= CRUS_TRANSLATE_MAX_RETRIES) {
              const wait = backoffMs(attempts - 1);
              console.warn(`Retry ${attempts}/${CRUS_TRANSLATE_MAX_RETRIES} for plot ${id} after ${wait}ms due to:`, (e as any)?.message || e);
              await sleep(wait);
              continue;
            } else {
              console.warn(`Failed to translate zoning for plot ${id}:`, e);
              break;
            }
          } finally {
            processed += 1;
            if (processed % 25 === 0) console.log(`Processed ${processed} rows...`);
            if (CRUS_TRANSLATE_DELAY_MS > 0) await sleep(CRUS_TRANSLATE_DELAY_MS);
          }
        }
      }
    }

    if (!CRUS_TRANSLATE_SCAN_ALL) {
      // Original targeted mode using JSONB WHERE
      const targets = await fetchTargets(client, CRUS_TRANSLATE_LIMIT);
      if (!targets.length) {
        console.log('No zoning labels to translate.');
        return;
      }
      console.log(`Translating ${targets.length} zoning labels${CRUS_TRANSLATE_ONLY_MISSING ? ' (only missing)' : ''}...`);

      // Show breakdown by country/language
      const countryStats = new Map<string, number>();
      for (const t of targets) {
        const country = t.country || 'PT';
        countryStats.set(country, (countryStats.get(country) || 0) + 1);
      }
      for (const [country, count] of countryStats.entries()) {
        const lang = countryToLang[country.toUpperCase()] || 'unknown';
        console.log(`  ${country} (${lang}): ${count} labels`);
      }

      const slice = Math.ceil(targets.length / CRUS_TRANSLATE_CONCURRENCY);
      const chunks: Array<Array<{ id: string; enrichment_data: any; country: string }>> = [];
      for (let i = 0; i < targets.length; i += slice) chunks.push(targets.slice(i, i + slice));
      await Promise.all(chunks.map(worker));
    } else {
      // Scan-all mode: iterate full table in id order, batching and filtering in app
      console.log(`Scan-all mode enabled. Batch size=${CRUS_TRANSLATE_BATCH_SIZE}, concurrency=${CRUS_TRANSLATE_CONCURRENCY}.`);
      let lastId: string | null = null;
      while (true) {
        const batch = await fetchBatchAll(client, lastId, CRUS_TRANSLATE_BATCH_SIZE);
        if (!batch.length) break;
        lastId = batch[batch.length - 1].id;
        // Filter rows in-app
        const candidates = batch.filter((row) => {
          const z = (row.enrichment_data || {}).zoning;
          if (!z) return false;
          const label = typeof z.label === 'string' ? z.label.trim() : '';
          if (!label) return false;
          if (CRUS_TRANSLATE_ONLY_MISSING) {
            const labelEn = typeof z.label_en === 'string' ? z.label_en.trim() : '';
            if (labelEn) return false;
          }
          return true;
        });
        if (!candidates.length) continue;
        const slice = Math.ceil(candidates.length / CRUS_TRANSLATE_CONCURRENCY);
        const chunks: Array<Array<{ id: string; enrichment_data: any; country: string }>> = [];
        for (let i = 0; i < candidates.length; i += slice) chunks.push(candidates.slice(i, i + slice));
        await Promise.all(chunks.map(worker));
      }
      console.log('CRUS label translation complete (scan-all).');
    }
  } finally {
    // Reset timeout to default for safety (best-effort)
    try { await client.query('SET statement_timeout = DEFAULT'); } catch {}
    client.release();
    await pool.end();
  }
}
