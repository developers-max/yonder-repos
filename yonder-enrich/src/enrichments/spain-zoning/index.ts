import dotenv from 'dotenv';
import { getSpanishZoningForPoint } from './spain_lookup';
import { translateZoningLabel } from '../../llm/translate';
import { getPgPool, upsertEnrichedPlot, getExistingEnrichmentDataMap } from '../helpers/db-helpers';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

// Dry run controls
const SPAIN_ZONING_DRY_RUN = (process.env.SPAIN_ZONING_DRY_RUN || '').toLowerCase() === 'true';
const SPAIN_ZONING_DRY_RUN_LIMIT_ENV = parseInt(process.env.SPAIN_ZONING_DRY_RUN_LIMIT || '', 10);
const SPAIN_ZONING_DRY_RUN_LIMIT = Number.isFinite(SPAIN_ZONING_DRY_RUN_LIMIT_ENV) 
  ? SPAIN_ZONING_DRY_RUN_LIMIT_ENV 
  : (SPAIN_ZONING_DRY_RUN ? 5 : undefined);

// Inter-plot delay (politeness / rate limiting)
const SPAIN_ZONING_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.SPAIN_ZONING_INTER_PLOT_DELAY_MS || '', 10);
const SPAIN_ZONING_INTER_PLOT_DELAY_MS = Number.isFinite(SPAIN_ZONING_INTER_PLOT_DELAY_MS_ENV) 
  ? SPAIN_ZONING_INTER_PLOT_DELAY_MS_ENV 
  : 500;

// Limited concurrency (number of workers)
const SPAIN_ZONING_CONCURRENCY_ENV = parseInt(process.env.SPAIN_ZONING_CONCURRENCY || '', 10);
const SPAIN_ZONING_CONCURRENCY = Number.isFinite(SPAIN_ZONING_CONCURRENCY_ENV)
  ? Math.min(Math.max(SPAIN_ZONING_CONCURRENCY_ENV, 1), 5)
  : 3;

// LLM translation controls
const SPAIN_ZONING_TRANSLATE = (process.env.SPAIN_ZONING_TRANSLATE || '').toLowerCase() === 'true';
const SPAIN_ZONING_TRANSLATE_TARGET_LANG = (process.env.SPAIN_ZONING_TRANSLATE_TARGET_LANG || 'en').trim();

// Force refresh existing plots
const SPAIN_ZONING_FORCE_REFRESH = (process.env.SPAIN_ZONING_FORCE_REFRESH || '').toLowerCase() === 'true';

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}


async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  const pgPool = getPgPool();
  const client = await pgPool.connect();
  try {
    // SPAIN ONLY - Regional zoning services for Spanish autonomous communities
    // Only process plots in Spain
    const res = await client.query(
      `SELECT id, latitude, longitude 
       FROM plots_stage 
       WHERE country = 'ES'
       ORDER BY id 
       OFFSET $1 LIMIT $2`,
      [offset, limit]
    );
    return res.rows;
  } finally {
    client.release();
  }
}


export async function enrichSpanishZoning() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;

  console.log('Starting Spanish zoning enrichment...');
  console.log('⚠️  SPAIN ONLY: Uses regional WFS services from Autonomous Communities');
  console.log('DB mode: Postgres via DATABASE_URL');
  console.log('Lookup mode: using spain_lookup.ts (CCAA + regional WFS resolution)');
  if (SPAIN_ZONING_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof SPAIN_ZONING_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${SPAIN_ZONING_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  if (SPAIN_ZONING_FORCE_REFRESH) {
    console.log('🔄 FORCE REFRESH enabled: Will re-process all plots, including those with existing zoning.');
  }
  console.log('Concurrency:', SPAIN_ZONING_CONCURRENCY);

  let shouldStop = false;
  while (true) {
    console.log(`\n=== Processing batch starting at offset ${offset} ===`);

    // Load plots to process
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

    // Load existing enrichment_data for these plots to merge and to skip those that already have zoning
    const idList = plots.map(p => p.id);
    const enrichmentMap = await getExistingEnrichmentDataMap(idList);

    const toProcess = plots.filter(p => {
      if (SPAIN_ZONING_FORCE_REFRESH) {
        return true; // Process all plots when force refresh is enabled
      }
      const existing = enrichmentMap.get(p.id);
      const alreadyHas = existing && typeof existing === 'object' && existing.zoning != null;
      return !alreadyHas;
    });

    if (toProcess.length === 0) {
      console.log(`All ${plots.length} plots in this batch already have zoning.`);
      offset += batchSize;
      continue;
    }

    console.log(`Found ${toProcess.length} plots needing Spanish zoning (out of ${plots.length}).`);

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

          const payload = await getSpanishZoningForPoint(lon, lat);
          const zoning: any = {
            label: payload?.label,
            
            // Individual zoning fields (Catalunya MUC)
            zoning_qualification: payload?.zoning_qualification,
            zoning_qualification_code: payload?.zoning_qualification_code,
            zoning_municipal: payload?.zoning_municipal,
            zoning_municipal_code: payload?.zoning_municipal_code,
            land_classification: payload?.land_classification,
            land_classification_code: payload?.land_classification_code,
            municipality_code: payload?.municipality_code,
            
            // Source metadata
            picked_field: payload?.picked_field,
            source: 'Spain Regional WFS (via spain_lookup)',
            ccaa: payload?.ccaa,
            service_type: payload?.service_type,
            service_url: payload?.service_url,
            typename: payload?.typename,
            srs: 'EPSG:4326',
            feature_count: payload?.feature_count ?? 0,
            sample_properties: payload?.properties || {},
            notes: payload?.notes,
          };

          // Optional: LLM-powered English translation of zoning label
          if (SPAIN_ZONING_TRANSLATE && zoning.label) {
            try {
              const t = await translateZoningLabel(String(zoning.label), {
                municipality: payload?.ccaa,
                collectionId: payload?.service_url,
                sourceLangHint: 'es',
                targetLang: SPAIN_ZONING_TRANSLATE_TARGET_LANG,
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

          if (SPAIN_ZONING_DRY_RUN) {
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
          console.log(`Zoning saved for plot ${plot.id} (${zoning.ccaa}: ${zoning.label || 'unknown'})`);

          // Respect dry run limit
          if (SPAIN_ZONING_DRY_RUN && typeof SPAIN_ZONING_DRY_RUN_LIMIT === 'number' && totalProcessed >= SPAIN_ZONING_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }

        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }

        // Small polite delay to avoid server overload
        if (SPAIN_ZONING_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, SPAIN_ZONING_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: SPAIN_ZONING_CONCURRENCY }, (_, idx) => worker(idx)));

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

  console.log(`\n=== Spanish Zoning Enrichment Complete ===`);
  console.log(`Total plots updated with zoning: ${totalProcessed}`);
}
