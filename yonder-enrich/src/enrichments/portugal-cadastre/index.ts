import dotenv from 'dotenv';
import { getPortugalCadastralInfo } from './portugal_cadastre_lookup';
import { getBUPiPropertyInfo } from './bupi_lookup';
import { getBUPiPropertyInfoArcGIS } from './bupi_arcgis_rest';
import { getPgPool, upsertEnrichedPlot, getExistingEnrichmentDataMap } from '../helpers/db-helpers';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

// Configuration from environment variables
const PORTUGAL_CADASTRE_DRY_RUN = (process.env.PORTUGAL_CADASTRE_DRY_RUN || '').toLowerCase() === 'true';
const PORTUGAL_CADASTRE_DRY_RUN_LIMIT_ENV = parseInt(process.env.PORTUGAL_CADASTRE_DRY_RUN_LIMIT || '', 10);
const PORTUGAL_CADASTRE_DRY_RUN_LIMIT = Number.isFinite(PORTUGAL_CADASTRE_DRY_RUN_LIMIT_ENV) 
  ? PORTUGAL_CADASTRE_DRY_RUN_LIMIT_ENV 
  : (PORTUGAL_CADASTRE_DRY_RUN ? 5 : undefined);

// Inter-plot delay (politeness / rate limiting)
const PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS_ENV = parseInt(process.env.PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS || '', 10);
const PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS = Number.isFinite(PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS_ENV) 
  ? PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS_ENV 
  : 500; // Default 500ms (Portugal API is more modern/faster)

// Limited concurrency
const PORTUGAL_CADASTRE_CONCURRENCY_ENV = parseInt(process.env.PORTUGAL_CADASTRE_CONCURRENCY || '', 10);
const PORTUGAL_CADASTRE_CONCURRENCY = Number.isFinite(PORTUGAL_CADASTRE_CONCURRENCY_ENV)
  ? Math.min(Math.max(PORTUGAL_CADASTRE_CONCURRENCY_ENV, 1), 5) // Max 5 for OGC API
  : 3; // Conservative default

// Force refresh existing plots
const PORTUGAL_CADASTRE_FORCE_REFRESH = (process.env.PORTUGAL_CADASTRE_FORCE_REFRESH || '').toLowerCase() === 'true';

// Retry only failed plots
const PORTUGAL_CADASTRE_RETRY_FAILED = (process.env.PORTUGAL_CADASTRE_RETRY_FAILED || '').toLowerCase() === 'true';

// Force update only cadastral data (preserve all other enrichment types)
const PORTUGAL_CADASTRE_FORCE_CADASTRAL_ONLY = (process.env.PORTUGAL_CADASTRE_FORCE_CADASTRAL_ONLY || '').toLowerCase() === 'true';

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error('Missing DATABASE_URL. Set the Postgres connection string in env.');
  }
}


async function fetchPlotsBatch(offset: number, limit: number): Promise<Array<{ id: string; latitude: number; longitude: number }>> {
  const pgPool = getPgPool();
  const client = await pgPool.connect();
  try {
    // PORTUGAL ONLY - Cadastral information for Portuguese plots
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


export async function enrichPortugalCadastre() {
  try {
    assertEnv();
  } catch (e) {
    console.error(String(e));
    return;
  }

  const batchSize = 50;
  let offset = 0;
  let totalProcessed = 0;
  let totalSuccessful = 0; // Plots with actual cadastral data
  let totalDGT = 0; // Plots with DGT data
  let totalBUPi = 0; // Plots with BUPi data (fallback)

  console.log('Starting Portugal Cadastre enrichment...');
  console.log('⚠️  PORTUGAL ONLY: Uses Direção-Geral do Território OGC API');
  console.log('Service: OGC API Features (cadastro collection)');
  console.log('DB mode: Postgres via DATABASE_URL');
  
  if (PORTUGAL_CADASTRE_DRY_RUN) {
    console.log('DRY RUN is enabled. No database writes will be performed.');
    if (typeof PORTUGAL_CADASTRE_DRY_RUN_LIMIT === 'number') {
      console.log(`DRY RUN limit: will process at most ${PORTUGAL_CADASTRE_DRY_RUN_LIMIT} plot(s).`);
    }
  }
  
  if (PORTUGAL_CADASTRE_FORCE_REFRESH) {
    console.log('🔄 FORCE REFRESH enabled: Will re-process all plots, including those with existing cadastral data.');
  }
  
  if (PORTUGAL_CADASTRE_RETRY_FAILED) {
    console.log('🔁 RETRY FAILED enabled: Will only process plots with failed cadastral lookups.');
  }
  
  if (PORTUGAL_CADASTRE_FORCE_CADASTRAL_ONLY) {
    console.log('🎯 FORCE CADASTRAL ONLY enabled: Will only update cadastral field, preserving all other enrichment data.');
  }
  
  console.log('Concurrency:', PORTUGAL_CADASTRE_CONCURRENCY);
  console.log('Inter-plot delay:', PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS, 'ms');

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
      const existing = enrichmentMap.get(p.id);
      
      // Retry failed mode: only process plots with null/missing cadastral references
      if (PORTUGAL_CADASTRE_RETRY_FAILED) {
        const hasCadastral = existing && typeof existing === 'object' && existing.cadastral != null;
        if (!hasCadastral) return false;
        
        const cadastralRef = existing.cadastral?.cadastral_reference;
        const isFailed = !cadastralRef || cadastralRef === 'N/A' || cadastralRef === null;
        return isFailed;
      }
      
      // Force cadastral only mode: process all plots (will only update cadastral field)
      if (PORTUGAL_CADASTRE_FORCE_CADASTRAL_ONLY) {
        return true;
      }
      
      // Force refresh mode: process all plots
      if (PORTUGAL_CADASTRE_FORCE_REFRESH) {
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

          // Call both DGT and BUPi in parallel to get all available geometry
          const [dgtInfo, bupiInfo] = await Promise.all([
            getPortugalCadastralInfo(lon, lat),
            getBUPiPropertyInfoArcGIS(lon, lat).catch(() => null)
          ]);
          
          // Try WFS as additional fallback if ArcGIS failed
          let bupiData = bupiInfo;
          if (!bupiData) {
            console.log(`  No BUPi ArcGIS data, trying BUPi WFS...`);
            bupiData = await getBUPiPropertyInfo(lon, lat).catch(() => null);
          }
          
          let cadastralInfo: any = null;
          let dataSource = 'None';
          
          // Use DGT as primary source if available
          if (dgtInfo && dgtInfo.cadastral_reference) {
            cadastralInfo = dgtInfo;
            dataSource = 'DGT';
            
            // Add BUPi geometry as supplementary data for validation/comparison
            if (bupiData && bupiData.bupi_id) {
              console.log(`  ✓ DGT data found, also storing BUPi geometry for validation`);
              cadastralInfo.bupi_geometry = bupiData.geometry;
              cadastralInfo.bupi_area_m2 = bupiData.area_m2;
              cadastralInfo.bupi_id = bupiData.bupi_id;
              cadastralInfo.bupi_source = bupiData.source;
            }
          } 
          // Fallback to BUPi if DGT has no data
          else if (bupiData && bupiData.bupi_id) {
            console.log(`  No DGT data, using BUPi as primary source`);
            cadastralInfo = {
              cadastral_reference: bupiData.bupi_id,
              inspire_id: undefined,
              label: bupiData.bupi_id ? `BUPi-${bupiData.bupi_id}` : undefined,
              parcel_area_m2: bupiData.area_m2 || undefined,
              registration_date: undefined,
              administrative_unit: undefined,
              municipality_code: undefined,
              geometry: bupiData.geometry || null,
              centroid: bupiData.centroid || undefined,
              distance_meters: bupiData.distance_meters ?? undefined,
              contains_point: bupiData.contains_point ?? false,
              coordinates: bupiData.coordinates,
              source: bupiData.source,
              service_url: bupiData.service_url,
              notes: bupiData.notes || undefined
            };
            dataSource = 'BUPi';
          }
          
          const cadastral: any = {
            cadastral_reference: cadastralInfo?.cadastral_reference || null,
            inspire_id: cadastralInfo?.inspire_id || null,
            label: cadastralInfo?.label || null,
            
            // Parcel information
            parcel_area_m2: cadastralInfo?.parcel_area_m2 || null,
            registration_date: cadastralInfo?.registration_date || null,
            administrative_unit: cadastralInfo?.administrative_unit || null,
            municipality_code: cadastralInfo?.municipality_code || null,
            
            // Primary Geometry (from DGT or BUPi)
            geometry: cadastralInfo?.geometry || null,
            centroid: cadastralInfo?.centroid || null,
            
            // BUPi supplementary geometry (when DGT is primary source)
            bupi_geometry: cadastralInfo?.bupi_geometry || null,
            bupi_area_m2: cadastralInfo?.bupi_area_m2 || null,
            bupi_id: cadastralInfo?.bupi_id || null,
            bupi_source: cadastralInfo?.bupi_source || null,
            
            // Accuracy
            distance_meters: cadastralInfo?.distance_meters ?? null,
            contains_point: cadastralInfo?.contains_point ?? false,
            
            // Coordinates from cadastre
            cadastral_coordinates: cadastralInfo?.coordinates || null,
            
            // Source metadata
            source: cadastralInfo?.source || 'Portugal Cadastre - DGT',
            service_url: cadastralInfo?.service_url || '',
            srs: 'EPSG:4326',
            notes: cadastralInfo?.notes || null
          };

          // Merge with existing enrichment_data (preserve all other keys)
          const existing = enrichmentMap.get(plot.id) || {};
          
          // Ultra-defensive merge: ONLY update the cadastral field, preserve everything else
          const merged = {
            ...existing,           // Spread ALL existing data first
            cadastral: cadastral   // Replace only the cadastral key with new data
          };
          
          // Verify merge preserved other enrichment types
          const existingKeys = Object.keys(existing).filter(k => k !== 'cadastral');
          const mergedKeys = Object.keys(merged).filter(k => k !== 'cadastral');
          
          // Check if any non-cadastral keys were lost
          const lostKeys = existingKeys.filter(k => !mergedKeys.includes(k));
          if (lostKeys.length > 0) {
            console.error(`❌ ERROR: Lost enrichment data for plot ${plot.id}!`);
            console.error(`   Lost keys: ${lostKeys.join(', ')}`);
            console.error(`   This should NEVER happen. Skipping to avoid data loss.`);
            continue;
          }
          
          // Log what we're preserving
          if (existingKeys.length > 0) {
            console.log(`  ✓ Preserved ${existingKeys.length} other enrichment type(s): ${existingKeys.join(', ')}`);
          }

          if (PORTUGAL_CADASTRE_DRY_RUN) {
            console.log(`[DRY RUN] Would upsert cadastral data for plot ${plot.id}`, { 
              cadastral_reference: cadastral.cadastral_reference,
              label: cadastral.label,
              area: cadastral.parcel_area_m2
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
          
          // Track successful lookups (where data was found)
          if (cadastral.cadastral_reference && cadastral.cadastral_reference !== null) {
            totalSuccessful += 1;
            
            // Track source
            if (dataSource === 'DGT') {
              totalDGT += 1;
            } else if (dataSource === 'BUPi') {
              totalBUPi += 1;
            }
          }
          
          console.log(`Cadastral data saved for plot ${plot.id} (ref: ${cadastral.label || cadastral.cadastral_reference || 'N/A'})`);

          // Respect dry run limit
          if (PORTUGAL_CADASTRE_DRY_RUN && typeof PORTUGAL_CADASTRE_DRY_RUN_LIMIT === 'number' && totalProcessed >= PORTUGAL_CADASTRE_DRY_RUN_LIMIT) {
            shouldStop = true;
            break;
          }

        } catch (err) {
          console.error(`Error processing plot ${plot.id}:`, err);
          continue;
        }

        // Politeness delay
        if (PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS > 0) {
          await new Promise(res => setTimeout(res, PORTUGAL_CADASTRE_INTER_PLOT_DELAY_MS));
        }
      }
    };

    await Promise.all(Array.from({ length: PORTUGAL_CADASTRE_CONCURRENCY }, (_, idx) => worker(idx)));

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

  console.log(`\n=== Portugal Cadastre Enrichment Complete ===`);
  console.log(`Total plots processed: ${totalProcessed}`);
  console.log(`✅ Successful (with data): ${totalSuccessful}`);
  console.log(`  └─ DGT (official cadastre): ${totalDGT}`);
  console.log(`  └─ BUPi (property boundaries): ${totalBUPi}`);
  console.log(`❌ No data found: ${totalProcessed - totalSuccessful}`);
  
  if (totalProcessed > 0) {
    const successRate = ((totalSuccessful / totalProcessed) * 100).toFixed(2);
    const dgtRate = ((totalDGT / totalProcessed) * 100).toFixed(2);
    const bupiRate = ((totalBUPi / totalProcessed) * 100).toFixed(2);
    console.log(`📊 Overall success rate: ${successRate}%`);
    console.log(`  └─ DGT coverage: ${dgtRate}%`);
    console.log(`  └─ BUPi coverage: ${bupiRate}%`);
  }
}

// Run if executed directly
if (require.main === module) {
  enrichPortugalCadastre()
    .then(() => {
      console.log('Enrichment completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Enrichment failed:', err);
      process.exit(1);
    });
}
