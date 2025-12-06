import dotenv from 'dotenv';
import { getCRUSZoningForPoint } from '../../api/helpers/crus-helpers';
import { translateZoningLabel } from '../../llm/translate';
import { getPgPool, upsertEnrichedPlot, getExistingEnrichmentDataMap } from '../helpers/db-helpers';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

// Using the generic CRUS lookup helper from crus_lookup.ts

// Dry run controls
const CRUS_DRY_RUN = (process.env.CRUS_DRY_RUN || '').toLowerCase() === 'true';
const CRUS_DRY_RUN_LIMIT_ENV = parseInt(process.env.CRUS_DRY_RUN_LIMIT || '', 10);
const CRUS_DRY_RUN_LIMIT = Number.isFinite(CRUS_DRY_RUN_LIMIT_ENV) ? CRUS_DRY_RUN_LIMIT_ENV : (CRUS_DRY_RUN ? 5 : undefined);

// Inter-plot delay (politeness / rate limiting)
const CRUS_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.CRUS_INTER_PLOT_DELAY_MS || '', 10);
const CRUS_INTER_PLOT_DELAY_MS = Number.isFinite(CRUS_INTER_PLOT_DELAY_MS_ENV) ? CRUS_INTER_PLOT_DELAY_MS_ENV : 500;

// Limited concurrency (number of workers)
const CRUS_CONCURRENCY_ENV = parseInt(process.env.CRUS_CONCURRENCY || '', 10);
const CRUS_CONCURRENCY = Number.isFinite(CRUS_CONCURRENCY_ENV)
  ? Math.min(Math.max(CRUS_CONCURRENCY_ENV, 1), 5)
  : 3;

// LLM translation controls
const CRUS_TRANSLATE = (process.env.CRUS_TRANSLATE || '').toLowerCase() === 'true';
const CRUS_TRANSLATE_TARGET_LANG = (process.env.CRUS_TRANSLATE_TARGET_LANG || 'en').trim();
const CRUS_TRANSLATE_SOURCE_LANG = (process.env.CRUS_TRANSLATE_SOURCE_LANG || 'pt').trim();

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

// (Old direct OGC API helpers removed; we rely on crus_lookup.ts now.)


async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  const pgPool = getPgPool();
  const client = await pgPool.connect();
  try {
    // CRUS is Portugal-specific (DGT = Direção-Geral do Território)
    // Only process plots in Portugal
    const res = await client.query(
      `SELECT id, latitude, longitude 
       FROM plots_stage 
       WHERE country = 'PT'
       ORDER BY id 
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}


export async function enrichCRUSZoning() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;

  console.log('Starting CRUS zoning enrichment...');
  console.log('⚠️  PORTUGAL ONLY: CRUS uses DGT API (Direção-Geral do Território)');
  console.log('DB mode: Postgres via DATABASE_URL');
  console.log('Lookup mode: using crus_lookup.ts (municipality + dynamic collection resolution)');
  if (CRUS_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof CRUS_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${CRUS_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  console.log('Concurrency:', CRUS_CONCURRENCY);

  let shouldStop = false;
  while (true) {
    console.log(`\n=== Processing batch starting at offset ${offset} ===`);

    // Load plots to process
    let plots: Array<{ id: string; latitude: number; longitude: number; bubble_id?: string }> = [];
    try {
      plots = await fetchPlotsBatch(offset, batchSize);
    } catch (e) {
      console.error('Failed to fetch plots:', e);
      break;
    }

    if (!plots || plots.length === 0) {
      console.log('No more plots to process');
      break;
    }

    // Load existing enrichment_data for these plots to merge and to skip those that already have zoning
    const idList = plots.map(p => p.id);
    const enrichmentMap = await getExistingEnrichmentDataMap(idList);

    const toProcess = plots.filter(p => {
      const existing = enrichmentMap.get(p.id);
      const alreadyHas = existing && typeof existing === 'object' && existing.zoning != null;
      return !alreadyHas;
    });

    if (toProcess.length === 0) {
      console.log(`All ${plots.length} plots in this batch already have zoning.`);
      offset += batchSize;
      continue;
    }

    console.log(`Found ${toProcess.length} plots needing CRUS zoning (out of ${plots.length}).`);

    let nextIndex = 0;
    const worker = async (wid: number) => {
      while (true) {
        if (shouldStop) break;
        const i = nextIndex++;
        if (i >= toProcess.length) break;
        const plot = toProcess[i];
        console.log(`Processing plot ${i + 1}/${toProcess.length}: ${plot.id}...`);

        try {
          const lon = Number(plot.longitude);
          const lat = Number(plot.latitude);
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
            console.warn(`Invalid coordinates for plot ${plot.id}:`, { lat, lon });
            continue;
          }

          const payload = await getCRUSZoningForPoint(lon, lat);
          const zoning: any = {
            label: payload?.label,
            picked_field: payload?.picked_field,
            source: 'DGT CRUS (OGC API via lookup)',
            typename: payload?.collection_id,
            srs: 'EPSG:4326',
            feature_count: payload?.feature_count ?? 0,
            sample_properties: payload?.properties || {},
          };

          // Optional: LLM-powered English translation of zoning label
          if (CRUS_TRANSLATE && zoning.label) {
            try {
              const t = await translateZoningLabel(String(zoning.label), {
                municipality: payload?.municipality,
                collectionId: payload?.collection_id,
                sourceLangHint: CRUS_TRANSLATE_SOURCE_LANG,
                targetLang: CRUS_TRANSLATE_TARGET_LANG,
              });
              if (t?.label_en) {
                zoning.label_en = t.label_en;
              }
            } catch (e) {
              console.warn('Zoning translation failed:', e);
            }
          }

          // Merge with existing enrichment_data
          const existing = enrichmentMap.get(plot.id) || {};
          const merged = { ...existing, zoning };

          if (CRUS_DRY_RUN) {
            console.log(`[DRY RUN] Would upsert zoning for plot ${plot.id}`, { zoning });
          } else {
            try {
              await upsertEnrichedPlot(plot, merged);
            } catch (e) {
              console.error(`Failed to upsert plot ${plot.id}:`, e);
              continue;
            }
          }

          totalProcessed += 1;
          console.log(`Zoning saved for plot ${plot.id} (${zoning.label || 'unknown'})`);

          // Respect dry run limit
          if (CRUS_DRY_RUN && typeof CRUS_DRY_RUN_LIMIT === 'number' && totalProcessed >= CRUS_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }

        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }

        // Small polite delay to avoid server overload
        if (CRUS_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, CRUS_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: CRUS_CONCURRENCY }, (_, idx) => worker(idx)));

    // If fewer than batch size, we're done
    if (plots.length < batchSize) {
      console.log('Reached end of plots');
      break;
    }

    if (shouldStop) {
      console.log('Dry run limit reached; stopping.');
      break;
    }

    offset += batchSize;
    console.log(`Batch complete. Processed ${toProcess.length} plots for zoning.`);
  }

  console.log(`\n=== CRUS Zoning Enrichment Complete ===`);
  console.log(`Total plots updated with zoning: ${totalProcessed}`);
}
