import dotenv from 'dotenv';
import { queryAllLayers } from '../../layers';
import type { LayerQueryResponse } from '../../layers/types';
import { 
  upsertEnrichedPlot, 
  getExistingEnrichmentDataMap,
  fetchPlotsBatch as fetchPlotsBatchShared,
} from '@yonder/persistence';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

const LAYERS_DRY_RUN = (process.env.LAYERS_DRY_RUN || '').toLowerCase() === 'true';
const LAYERS_DRY_RUN_LIMIT_ENV = parseInt(process.env.LAYERS_DRY_RUN_LIMIT || '', 10);
const LAYERS_DRY_RUN_LIMIT = Number.isFinite(LAYERS_DRY_RUN_LIMIT_ENV) 
  ? LAYERS_DRY_RUN_LIMIT_ENV 
  : (LAYERS_DRY_RUN ? 5 : undefined);

const LAYERS_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.LAYERS_INTER_PLOT_DELAY_MS || '', 10);
const LAYERS_INTER_PLOT_DELAY_MS = Number.isFinite(LAYERS_INTER_PLOT_DELAY_MS_ENV) 
  ? LAYERS_INTER_PLOT_DELAY_MS_ENV 
  : 1000;

const LAYERS_CONCURRENCY_ENV = parseInt(process.env.LAYERS_CONCURRENCY || '', 10);
const LAYERS_CONCURRENCY = Number.isFinite(LAYERS_CONCURRENCY_ENV)
  ? Math.min(Math.max(LAYERS_CONCURRENCY_ENV, 1), 3)
  : 2;

const LAYERS_FORCE_REFRESH = (process.env.LAYERS_FORCE_REFRESH || '').toLowerCase() === 'true';

const LAYERS_COUNTRY = (process.env.LAYERS_COUNTRY || '').toUpperCase();
const validCountries = ['PT', 'ES'];
const COUNTRY_FILTER = validCountries.includes(LAYERS_COUNTRY) ? LAYERS_COUNTRY : undefined;

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number; country?: string }>> {
  return fetchPlotsBatchShared(offset, limit, { 
    ...(COUNTRY_FILTER && { country: COUNTRY_FILTER })
  });
}

/**
 * Transform LayerQueryResponse into a structured enrichment object
 */
function transformLayersToEnrichment(response: LayerQueryResponse): Record<string, unknown> {
  const enrichment: Record<string, unknown> = {
    timestamp: response.timestamp,
    coordinates: response.coordinates,
    country: response.country,
  };

  if (response.areaM2) {
    enrichment.areaM2 = response.areaM2;
  }

  if (response.boundingBox) {
    enrichment.boundingBox = response.boundingBox;
  }

  const layersByCategory: Record<string, unknown[]> = {};

  for (const layer of response.layers) {
    if (!layer.found && !layer.error) continue;

    const layerData: Record<string, unknown> = {
      layerId: layer.layerId,
      layerName: layer.layerName,
      found: layer.found,
    };

    if (layer.data) {
      layerData.data = layer.data;
    }

    if (layer.error) {
      layerData.error = layer.error;
    }

    const category = categorizeLayer(layer.layerId);
    if (!layersByCategory[category]) {
      layersByCategory[category] = [];
    }
    layersByCategory[category].push(layerData);
  }

  enrichment.layersByCategory = layersByCategory;
  enrichment.layersRaw = response.layers;

  return enrichment;
}

/**
 * Categorize layer by its ID prefix
 */
function categorizeLayer(layerId: string): string {
  if (layerId.startsWith('pt-distrito') || layerId.startsWith('pt-municipio') || 
      layerId.startsWith('pt-freguesia') || layerId.startsWith('pt-nuts3')) {
    return 'administrative';
  }
  
  if (layerId.startsWith('pt-cadastro') || layerId.startsWith('es-cadastro')) {
    return 'cadastre';
  }
  
  if (layerId.startsWith('pt-crus') || layerId.startsWith('pt-ren') || 
      layerId.startsWith('pt-ran') || layerId.startsWith('es-zoning')) {
    return 'zoning';
  }
  
  if (layerId.startsWith('pt-cos') || layerId.startsWith('pt-clc') || 
      layerId.startsWith('pt-built-up')) {
    return 'landuse';
  }
  
  if (layerId === 'elevation') {
    return 'elevation';
  }
  
  if (layerId === 'pt-municipality-db') {
    return 'administrative';
  }

  if (layerId.startsWith('es-')) {
    return 'spain';
  }
  
  return 'other';
}

/**
 * Get country code from coordinates (simple heuristic)
 * Portugal: roughly -9.5 to -6.2 longitude, 36.9 to 42.2 latitude
 * Spain: roughly -9.3 to 4.3 longitude, 35.9 to 43.8 latitude
 * For overlapping regions, we'll need more sophisticated detection
 */
function inferCountryFromCoordinates(lat: number, lng: number): 'PT' | 'ES' {
  if (lng >= -9.5 && lng <= -6.2 && lat >= 36.9 && lat <= 42.2) {
    return 'PT';
  }
  return 'ES';
}

export async function enrichLayers() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalByCountry: Record<string, number> = { PT: 0, ES: 0 };

  console.log('Starting Layers enrichment...');
  console.log('Fetches all available geographic layers per plot (administrative, cadastre, zoning, land use, elevation)');
  console.log('DB mode: Postgres via DATABASE_URL');
  
  if (COUNTRY_FILTER) {
    console.log(`Country filter: ${COUNTRY_FILTER}`);
  } else {
    console.log('Processing all countries (PT and ES)');
  }
  
  if (LAYERS_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof LAYERS_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${LAYERS_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  
  if (LAYERS_FORCE_REFRESH) {
    console.log('🔄 FORCE REFRESH enabled: Will re-process all plots, including those with existing layer data.');
  }
  
  console.log('Concurrency:', LAYERS_CONCURRENCY);
  console.log('Inter-plot delay:', LAYERS_INTER_PLOT_DELAY_MS, 'ms');

  let shouldStop = false;
  
  while (true) {
    console.log(`\n=== Processing batch starting at offset ${offset} ===`);

    let plots: Array<{ id: string; latitude: number; longitude: number; country?: string }> = [];
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
      if (LAYERS_FORCE_REFRESH) {
        return true;
      }
      
      const existing = enrichmentMap.get(p.id);
      const alreadyHas = existing && typeof existing === 'object' && existing.layers != null;
      return !alreadyHas;
    });

    if (toProcess.length === 0) {
      console.log(`All ${plots.length} plots in this batch already have layer data.`);
      offset += batchSize;
      continue;
    }

    console.log(`Found ${toProcess.length} plots needing layer data (out of ${plots.length}).`);

    let nextIndex = 0;
    const worker = async (wid: number) => {
      while (true) {
        if (shouldStop) break;
        const i = nextIndex++;
        if (i >= toProcess.length) break;
        const plot = toProcess[i];
        console.log(`[Worker ${wid}] Processing plot ${i + 1}/${toProcess.length}: ${plot.id}...`);

        try {
          const lon = Number(plot.longitude);
          const lat = Number(plot.latitude);
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
            console.warn(`Invalid coordinates for plot ${plot.id}:`, { lat, lon });
            continue;
          }

          const country = (plot.country as 'PT' | 'ES' | undefined) || inferCountryFromCoordinates(lat, lon);
          
          console.log(`  Querying all layers for ${country} plot at (${lat}, ${lon})...`);
          
          const layerResponse = await queryAllLayers({
            lat,
            lng: lon,
            country,
          });

          const layersEnrichment = transformLayersToEnrichment(layerResponse);
          
          const foundLayers = layerResponse.layers.filter(l => l.found);
          console.log(`  ✓ Found ${foundLayers.length}/${layerResponse.layers.length} layers`);

          const existing = enrichmentMap.get(plot.id) || {};
          
          const merged = {
            ...existing,
            layers: layersEnrichment
          };
          
          const existingKeys = Object.keys(existing).filter(k => k !== 'layers');
          const mergedKeys = Object.keys(merged).filter(k => k !== 'layers');
          
          const lostKeys = existingKeys.filter(k => !mergedKeys.includes(k));
          if (lostKeys.length > 0) {
            console.error(`❌ ERROR: Lost enrichment data for plot ${plot.id}!`);
            console.error(`   Lost keys: ${lostKeys.join(', ')}`);
            console.error(`   This should NEVER happen. Skipping to avoid data loss.`);
            continue;
          }
          
          if (existingKeys.length > 0) {
            console.log(`  ✓ Preserved ${existingKeys.length} other enrichment type(s): ${existingKeys.join(', ')}`);
          }

          if (LAYERS_DRY_RUN) {
            console.log(`[DRY RUN] Would upsert layer data for plot ${plot.id}`, { 
              country,
              layerCount: layerResponse.layers.length,
              foundCount: foundLayers.length
            });
          } else {
            try {
              await upsertEnrichedPlot(plot, merged);
            } catch (e) {
              console.error(`Failed to upsert plot ${plot.id}:`, e);
              continue;
            }
          }

          totalProcessed += 1;
          if (foundLayers.length > 0) {
            totalSuccessful += 1;
          }
          totalByCountry[country] = (totalByCountry[country] || 0) + 1;
          
          console.log(`Layer data saved for plot ${plot.id} (${country}: ${foundLayers.length} layers found)`);

          if (LAYERS_DRY_RUN && typeof LAYERS_DRY_RUN_LIMIT === 'number' && totalProcessed >= LAYERS_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }

        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }

        if (LAYERS_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, LAYERS_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: LAYERS_CONCURRENCY }, (_, idx) => worker(idx)));

    if (plots.length < batchSize) {
      console.log('Reached end of plots');
      break;
    }

    if (shouldStop) {
      console.log('Dry run limit reached; stopping.');
      break;
    }

    offset += batchSize;
    console.log(`Batch complete. Processed ${toProcess.length} plots for layer data.`);
  }

  console.log(`\n=== Layers Enrichment Complete ===`);
  console.log(`Total plots processed: ${totalProcessed}`);
  console.log(`✅ Successful (with data): ${totalSuccessful}`);
  console.log(`By country:`);
  for (const [country, count] of Object.entries(totalByCountry)) {
    console.log(`  └─ ${country}: ${count}`);
  }
  
  if (totalProcessed > 0) {
    const successRate = ((totalSuccessful / totalProcessed) * 100).toFixed(2);
    console.log(`📊 Overall success rate: ${successRate}%`);
  }
}

if (require.main === module) {
  enrichLayers()
    .then(() => {
      console.log('Enrichment completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Enrichment failed:', err);
      process.exit(1);
    });
}
