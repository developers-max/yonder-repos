import dotenv from 'dotenv';
import { getSpanishCadastralInfo } from './spain_cadastre_lookup';
import { 
  upsertEnrichedPlot, 
  getExistingEnrichmentDataMap,
  fetchPlotsBatch as fetchPlotsBatchShared,
} from '@yonder/persistence';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

// Configuration from environment variables
const SPAIN_CADASTRE_DRY_RUN = (process.env.SPAIN_CADASTRE_DRY_RUN || '').toLowerCase() === 'true';
const SPAIN_CADASTRE_DRY_RUN_LIMIT_ENV = parseInt(process.env.SPAIN_CADASTRE_DRY_RUN_LIMIT || '', 10);
const SPAIN_CADASTRE_DRY_RUN_LIMIT = Number.isFinite(SPAIN_CADASTRE_DRY_RUN_LIMIT_ENV) 
  ? SPAIN_CADASTRE_DRY_RUN_LIMIT_ENV 
  : (SPAIN_CADASTRE_DRY_RUN ? 5 : undefined);

// Inter-plot delay (politeness / rate limiting)
const SPAIN_CADASTRE_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.SPAIN_CADASTRE_INTER_PLOT_DELAY_MS || '', 10);
const SPAIN_CADASTRE_INTER_PLOT_DELAY_MS = Number.isFinite(SPAIN_CADASTRE_INTER_PLOT_DELAY_MS_ENV) 
  ? SPAIN_CADASTRE_INTER_PLOT_DELAY_MS_ENV 
  : 1000; // Default 1 second for Cadastre API

// Limited concurrency
const SPAIN_CADASTRE_CONCURRENCY_ENV = parseInt(process.env.SPAIN_CADASTRE_CONCURRENCY || '', 10);
const SPAIN_CADASTRE_CONCURRENCY = Number.isFinite(SPAIN_CADASTRE_CONCURRENCY_ENV)
  ? Math.min(Math.max(SPAIN_CADASTRE_CONCURRENCY_ENV, 1), 3) // Max 3 for Cadastre API
  : 2; // Conservative default

// Force refresh existing plots
const SPAIN_CADASTRE_FORCE_REFRESH = (process.env.SPAIN_CADASTRE_FORCE_REFRESH || '').toLowerCase() === 'true';

// Retry only failed plots (plots with cadastral data but null/N/A reference)
const SPAIN_CADASTRE_RETRY_FAILED = (process.env.SPAIN_CADASTRE_RETRY_FAILED || '').toLowerCase() === 'true';

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}

// Use shared fetchPlotsBatch with Spain country filter
async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  // SPAIN ONLY - Cadastral information for Spanish plots
  return fetchPlotsBatchShared(offset, limit, { country: 'ES' });
}


export async function enrichSpanishCadastre() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;

  console.log('Starting Spanish Cadastre enrichment...');
  console.log('⚠️  SPAIN ONLY: Uses Dirección General del Catastro API');
  console.log('Services: OVCCoordenadas + INSPIRE WFS (Parcels, Buildings, Addresses)');
  console.log('DB mode: Postgres via DATABASE_URL');
  
  if (SPAIN_CADASTRE_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof SPAIN_CADASTRE_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${SPAIN_CADASTRE_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  
  if (SPAIN_CADASTRE_FORCE_REFRESH) {
    console.log('🔄 FORCE REFRESH enabled: Will re-process all plots, including those with existing cadastral data.');
  }
  
  if (SPAIN_CADASTRE_RETRY_FAILED) {
    console.log('🔁 RETRY FAILED enabled: Will only process plots with failed cadastral lookups (null/N/A references).');
  }
  
  console.log('Concurrency:', SPAIN_CADASTRE_CONCURRENCY);
  console.log('Inter-plot delay:', SPAIN_CADASTRE_INTER_PLOT_DELAY_MS, 'ms');

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

    // Load existing enrichment_data for these plots
    const idList = plots.map(p => p.id);
    const enrichmentMap = await getExistingEnrichmentDataMap(idList);

    const toProcess = plots.filter(p => {
      const existing = enrichmentMap.get(p.id) as { cadastral?: { cadastral_reference?: string | null } } | undefined;
      
      // Retry failed mode: only process plots with null/N/A cadastral references
      if (SPAIN_CADASTRE_RETRY_FAILED) {
        const hasCadastral = existing && typeof existing === 'object' && existing.cadastral != null;
        if (!hasCadastral) return false; // Skip plots with no cadastral data at all
        
        const cadastralRef = existing.cadastral?.cadastral_reference;
        const isFailed = !cadastralRef || cadastralRef === 'N/A' || cadastralRef === null;
        return isFailed;
      }
      
      // Force refresh mode: process all plots
      if (SPAIN_CADASTRE_FORCE_REFRESH) {
        return true;
      }
      
      // Normal mode: only process plots without cadastral data
      const alreadyHas = existing && typeof existing === 'object' && existing.cadastral != null;
      return !alreadyHas;
    });

    if (toProcess.length === 0) {
      console.log(`All ${plots.length} plots in this batch already have cadastral data.`);
      offset += batchSize;
      continue;
    }

    console.log(`Found ${toProcess.length} plots needing cadastral data (out of ${plots.length}).`);

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

          const cadastralInfo = await getSpanishCadastralInfo(lon, lat);
          
          const cadastral: any = {
            cadastral_reference: cadastralInfo?.cadastral_reference || null,
            address: cadastralInfo?.address || null,
            postal_code: cadastralInfo?.postal_code || null,
            municipality: cadastralInfo?.municipality || null,
            province: cadastralInfo?.province || null,
            distance_meters: cadastralInfo?.distance_meters || null,
            
            // Parcel information (now includes all parcels at location)
            parcel: cadastralInfo?.parcel || null,
            parcels: cadastralInfo?.parcels || null,
            parcel_count: cadastralInfo?.parcel_count || null,
            
            // Building information (now includes all buildings)
            building: cadastralInfo?.building || null,
            buildings: cadastralInfo?.buildings || null,
            building_count: cadastralInfo?.building_count || null,
            
            // Address information
            addresses: cadastralInfo?.addresses || null,
            address_count: cadastralInfo?.address_count || null,
            
            // Map visualization URLs
            map_images: cadastralInfo?.map_images ? {
              wms_url: cadastralInfo.map_images.wms_url,
              viewer_url: cadastralInfo.map_images.viewer_url,
              embeddable_html: cadastralInfo.map_images.embeddable_html,
              // Note: interactive_map_html excluded to save space (can be regenerated)
              // Include it by uncommenting: interactive_map_html: cadastralInfo.map_images.interactive_map_html,
              description: cadastralInfo.map_images.description
            } : null,
            
            // Coordinates from cadastre
            cadastral_coordinates: cadastralInfo?.coordinates || null,
            
            // Source metadata
            source: cadastralInfo?.source || 'Spanish Cadastre',
            service_urls: cadastralInfo?.service_urls || [],
            srs: 'EPSG:4326',
            notes: cadastralInfo?.notes || null
          };

          // Merge with existing enrichment_data (preserve all other keys)
          const existing = enrichmentMap.get(plot.id) || {};
          
          // Defensive merge: explicitly preserve all existing keys except 'cadastral'
          const merged = {
            ...existing,           // Spread all existing data first
            cadastral: {           // Then add/update only the cadastral key
              ...(existing.cadastral || {}),  // Preserve any existing cadastral fields not in new data
              ...cadastral                    // Add new cadastral data
            }
          };
          
          // Verify merge preserved other enrichment types
          const existingKeys = Object.keys(existing);
          const mergedKeys = Object.keys(merged);
          if (existingKeys.length > 0 && mergedKeys.length < existingKeys.length) {
            console.warn(`⚠️  Warning: Merge may have lost data for plot ${plot.id}. Keys before: ${existingKeys.length}, after: ${mergedKeys.length}`);
          }

          if (SPAIN_CADASTRE_DRY_RUN) {
            console.log(`[DRY RUN] Would upsert cadastral data for plot ${plot.id}`, { 
              cadastral_reference: cadastral.cadastral_reference,
              address: cadastral.address 
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
          console.log(`Cadastral data saved for plot ${plot.id} (ref: ${cadastral.cadastral_reference || 'N/A'})`);

          // Respect dry run limit
          if (SPAIN_CADASTRE_DRY_RUN && typeof SPAIN_CADASTRE_DRY_RUN_LIMIT === 'number' && totalProcessed >= SPAIN_CADASTRE_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }

        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }

        // Politeness delay - Spanish Cadastre API needs rate limiting
        if (SPAIN_CADASTRE_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, SPAIN_CADASTRE_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: SPAIN_CADASTRE_CONCURRENCY }, (_, idx) => worker(idx)));

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
    console.log(`Batch complete. Processed ${toProcess.length} plots for cadastral data.`);
  }

  console.log(`\n=== Spanish Cadastre Enrichment Complete ===`);
  console.log(`Total plots updated with cadastral data: ${totalProcessed}`);
}
