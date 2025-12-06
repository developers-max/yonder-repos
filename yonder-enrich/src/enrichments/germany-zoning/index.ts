import dotenv from 'dotenv';
import { getGermanZoningForPoint } from './germany_lookup';
import { translateZoningLabel } from '../../llm/translate';
import { getPgPool, upsertEnrichedPlot, getExistingEnrichmentDataMap } from '../helpers/db-helpers';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
const GERMANY_ZONING_DRY_RUN = (process.env.GERMANY_ZONING_DRY_RUN || '').toLowerCase() === 'true';
const GERMANY_ZONING_DRY_RUN_LIMIT_ENV = parseInt(process.env.GERMANY_ZONING_DRY_RUN_LIMIT || '', 10);
const GERMANY_ZONING_DRY_RUN_LIMIT = Number.isFinite(GERMANY_ZONING_DRY_RUN_LIMIT_ENV)
  ? GERMANY_ZONING_DRY_RUN_LIMIT_ENV
  : (GERMANY_ZONING_DRY_RUN ? 5 : undefined);
const GERMANY_ZONING_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.GERMANY_ZONING_INTER_PLOT_DELAY_MS || '', 10);
const GERMANY_ZONING_INTER_PLOT_DELAY_MS = Number.isFinite(GERMANY_ZONING_INTER_PLOT_DELAY_MS_ENV)
  ? GERMANY_ZONING_INTER_PLOT_DELAY_MS_ENV
  : 500;
const GERMANY_ZONING_CONCURRENCY_ENV = parseInt(process.env.GERMANY_ZONING_CONCURRENCY || '', 10);
const GERMANY_ZONING_CONCURRENCY = Number.isFinite(GERMANY_ZONING_CONCURRENCY_ENV)
  ? Math.min(Math.max(GERMANY_ZONING_CONCURRENCY_ENV, 1), 5)
  : 3;
const GERMANY_ZONING_TRANSLATE = (process.env.GERMANY_ZONING_TRANSLATE || '').toLowerCase() === 'true';
const GERMANY_ZONING_TRANSLATE_TARGET_LANG = (process.env.GERMANY_ZONING_TRANSLATE_TARGET_LANG || 'en').trim();
const GERMANY_ZONING_FORCE_REFRESH = (process.env.GERMANY_ZONING_FORCE_REFRESH || '').toLowerCase() === 'true';

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  const pgPool = getPgPool();
  const client = await pgPool.connect();
  try {
    const res = await client.query(
      `SELECT id, latitude, longitude
       FROM plots_stage
       WHERE country = 'DE'
       ORDER BY id
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}


export async function runGermanyZoningEnrichment() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;

  console.log('Starting Germany zoning enrichment...');
  console.log('DE mode: Uses state services (NRW OGC-API, Berlin WFS) via germany_lookup');
  if (GERMANY_ZONING_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof GERMANY_ZONING_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${GERMANY_ZONING_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  if (GERMANY_ZONING_FORCE_REFRESH) {
    console.log('🔄 FORCE REFRESH enabled: Will re-process all plots, including those with existing zoning.');
  }
  console.log('Concurrency:', GERMANY_ZONING_CONCURRENCY);

  let shouldStop = false;
  while (true) {
    console.log(`\n=== Processing batch starting at offset ${offset} ===`);

    let plots: Array<{ id: string; latitude: number; longitude: number }> = [];
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

    const idList = plots.map(p => p.id);
    const enrichmentMap = await getExistingEnrichmentDataMap(idList);

    const toProcess = plots.filter(p => {
      if (GERMANY_ZONING_FORCE_REFRESH) return true;
      const existing = enrichmentMap.get(p.id);
      const alreadyHas = existing && typeof existing === 'object' && existing.zoning != null;
      return !alreadyHas;
    });

    if (toProcess.length === 0) {
      console.log(`All ${plots.length} plots in this batch already have zoning.`);
      offset += batchSize;
      continue;
    }

    console.log(`Found ${toProcess.length} plots needing German zoning (out of ${plots.length}).`);

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

          const payload = await getGermanZoningForPoint(lon, lat);
          const zoning: any = {
            label: payload?.label,
            source: 'Germany State services (via germany_lookup)',
            state: payload?.state,
            service_type: payload?.service_type,
            service_url: payload?.service_url,
            collection_id: payload?.collection_id,
            typename: payload?.typename,
            srs: 'EPSG:4326',
            feature_count: payload?.feature_count ?? 0,
            sample_properties: payload?.properties || {},
            notes: payload?.notes,
          };
          if (GERMANY_ZONING_TRANSLATE && zoning.label) {
            try {
              const t = await translateZoningLabel(String(zoning.label), {
                municipality: payload?.state,
                collectionId: payload?.service_url,
                sourceLangHint: 'de',
                targetLang: GERMANY_ZONING_TRANSLATE_TARGET_LANG,
              });
              if (t?.label_en) {
                zoning.label_en = t.label_en;
              }
            } catch (e) {
              console.warn('Zoning translation failed:', e);
            }
          }
          const existing = enrichmentMap.get(plot.id) || {};
          const merged = { ...existing, zoning };
          if (GERMANY_ZONING_DRY_RUN) {
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
          console.log(`Zoning saved for plot ${plot.id} (${zoning.state || 'unknown'}: ${zoning.label || 'unknown'})`);
          if (GERMANY_ZONING_DRY_RUN && typeof GERMANY_ZONING_DRY_RUN_LIMIT === 'number' && totalProcessed >= GERMANY_ZONING_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }
        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }
        if (GERMANY_ZONING_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, GERMANY_ZONING_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: GERMANY_ZONING_CONCURRENCY }, (_, idx) => worker(idx)));

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

  console.log(`\n=== Germany Zoning Enrichment Complete ===`);
  console.log(`Total plots updated with zoning: ${totalProcessed}`);
}
