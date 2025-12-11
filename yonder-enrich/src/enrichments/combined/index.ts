import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
import { LocationInfo, Plot, EnrichmentData } from '../../types';
import { isValidCoordinate, getDistance } from '../amenities/coordinates';
import { queryOverpass, getFeatureType } from '../amenities/overpass';
import { 
  getPgPool,
  findMunicipalityByName as findMunicipalityByNameShared,
  upsertEnrichedPlotWithMunicipality,
  markPlotEnriched,
  type Municipality,
} from '@yonder/persistence';

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL || '';
function assertEnv() { if (!DATABASE_URL) throw new Error('Missing DATABASE_URL'); }
// Per-plot polite delay (ms) to respect external API rate limits; override to speed up
const PER_PLOT_DELAY_MS = Number.isFinite(Number(process.env.COMBINED_DELAY_MS))
  ? Number(process.env.COMBINED_DELAY_MS)
  : 100;
// Concurrency limit for parallel processing (default: 5)
const CONCURRENCY_LIMIT = Number.isFinite(Number(process.env.COMBINED_CONCURRENCY))
  ? Number(process.env.COMBINED_CONCURRENCY)
  : 5;

async function ensureEnrichedStage(client: any) {
  await client.query('CREATE TABLE IF NOT EXISTS enriched_plots_stage (LIKE enriched_plots INCLUDING ALL)');
  await client.query('ALTER TABLE enriched_plots_stage DROP COLUMN IF EXISTS bubble_id');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS images jsonb');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_url TEXT');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_json JSONB');
}

interface NominatimResponse {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}


interface CombinedEnrichmentData {
  amenities: EnrichmentData;
  municipality_id?: number;
  municipality_name?: string;
}

/**
 * Retries a function with exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = PER_PLOT_DELAY_MS,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(`Retrying after ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

/**
 * Process items with a concurrency limit
 */
async function processConcurrently<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing = new Set<Promise<void>>();
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const promise = processor(item, i).then(result => {
      results[i] = result;
      executing.delete(promise);
    });
    
    executing.add(promise);
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(Array.from(executing));
  return results;
}

/**
 * Gets municipality name from coordinates using Nominatim reverse geocoding
 */
async function getMunicipalityFromCoordinates(
  latitude: number, 
  longitude: number
): Promise<string | null> {
  if (!isValidCoordinate(latitude, longitude)) {
    console.warn(`Invalid coordinates: ${latitude}, ${longitude}`);
    return null;
  }

  try {
    const response = await retry(() =>
      axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude,
          addressdetails: 1,
          zoom: 10,
        },
        headers: {
          'User-Agent': 'YonderEnrich/1.0.0'
        },
        timeout: 30000
      })
    );

    const data: NominatimResponse = response.data;
    
    if (!data || !data.address) {
      return null;
    }

    // Extract municipality name from address components
    const municipalityName = data.address.city || 
                            data.address.town || 
                            data.address.village || 
                            data.address.municipality ||
                            data.address.county;

    return municipalityName || null;

  } catch (error) {
    console.error(`Error geocoding coordinates ${latitude}, ${longitude}:`, error);
    return null;
  }
}

/**
 * Finds municipality by name in the municipalities table
 */
async function findMunicipalityByName(client: any, municipalityName: string): Promise<Municipality | null> {
  try {
    // Exact match
    let res = await client.query(
      'SELECT id, name, district FROM municipalities WHERE name = $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    // Case-insensitive
    res = await client.query(
      'SELECT id, name, district FROM municipalities WHERE name ILIKE $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    return null;
  } catch (error) {
    console.error(`Error finding municipality "${municipalityName}":`, error);
    return null;
  }
}

/**
 * Finds the nearest feature from a list of OSM elements to a given point
 */
async function findNearestFeature(elements: any[], plotLat: number, plotLon: number): Promise<LocationInfo> {
  if (!elements || elements.length === 0 || !isValidCoordinate(plotLat, plotLon)) {
    return { distance: undefined };
  }

  let minDistance = Infinity;
  let nearestPoint = null;
  let nearestElement = null;

  for (const element of elements) {
    try {
      let featureLat, featureLon;

      if (element.type === 'node') {
        featureLat = element.lat;
        featureLon = element.lon;
        if (!isValidCoordinate(featureLat, featureLon)) continue;

        const distance = await getDistance(plotLat, plotLon, featureLat, featureLon);
        if (distance && distance < minDistance) {
          minDistance = distance;
          nearestPoint = { lat: featureLat, lon: featureLon };
          nearestElement = element;
        }
      } else if (element.type === 'way' && element.geometry) {
        for (const point of element.geometry) {
          if (!isValidCoordinate(point.lat, point.lon)) continue;

          const distance = await getDistance(plotLat, plotLon, point.lat, point.lon);
          if (distance && distance < minDistance) {
            minDistance = distance;
            nearestPoint = { lat: point.lat, lon: point.lon };
            nearestElement = element;
          }
        }
      }
    } catch (error) {
      console.warn('Error processing element:', error);
      continue;
    }
  }

  if (nearestPoint && nearestElement) {
    const tags = nearestElement.tags || {};
    return {
      distance: minDistance === Infinity ? undefined : minDistance,
      nearest_point: {
        ...nearestPoint,
        name: tags.name || undefined,
        type: getFeatureType(tags)
      }
    };
  }

  return { distance: undefined };
}

/**
 * Enriches a plot with both amenities and municipality data
 */
async function enrichPlotCombined(plot: Plot, client: any): Promise<CombinedEnrichmentData> {
  const result: CombinedEnrichmentData = {
    amenities: {
      coastline: { distance: undefined },
      beach: { distance: undefined },
      airport: { distance: undefined },
      nearest_main_town: { distance: undefined },
      public_transport: { distance: undefined },
      supermarket: { distance: undefined },
      convenience_store: { distance: undefined },
      restaurant_or_fastfood: { distance: undefined },
      cafe: { distance: undefined }
    }
  };

  if (!isValidCoordinate(plot.latitude, plot.longitude)) {
    console.warn(`Invalid plot coordinates for plot ${plot.id}:`, { lat: plot.latitude, lon: plot.longitude });
    return result;
  }

  const radius = 10000; // 10km radius

  try {
    // Run both amenities and municipality enrichment in parallel
    const [amenitiesResult, municipalityResult] = await Promise.all([
      // Amenities enrichment
      (async () => {
        const combinedQuery = `
          [out:json][timeout:60];
          (
            // Coastline
            way(around:${radius},${plot.latitude},${plot.longitude})["natural"="coastline"];
            
            // Beach
            way(around:${radius},${plot.latitude},${plot.longitude})["natural"="beach"];
            node(around:${radius},${plot.latitude},${plot.longitude})["natural"="beach"];
            
            // Airport
            way(around:${radius},${plot.latitude},${plot.longitude})["aeroway"~"^(aerodrome|terminal)$"];
            node(around:${radius},${plot.latitude},${plot.longitude})["aeroway"~"^(aerodrome|terminal)$"];
            
            // Main Towns and Cities only
            node(around:${radius},${plot.latitude},${plot.longitude})["place"~"^(town|city)$"];
            
            // Public transport - more specific matching
            node(around:${radius},${plot.latitude},${plot.longitude})["highway"="bus_stop"];
            node(around:${radius},${plot.latitude},${plot.longitude})["public_transport"="platform"]["bus"="yes"];
            node(around:${radius},${plot.latitude},${plot.longitude})["public_transport"="platform"]["train"="yes"];
            node(around:${radius},${plot.latitude},${plot.longitude})["railway"="station"];
            node(around:${radius},${plot.latitude},${plot.longitude})["amenity"="bus_station"];
            
            // Supermarkets only
            node(around:${radius},${plot.latitude},${plot.longitude})["shop"="supermarket"];
            way(around:${radius},${plot.latitude},${plot.longitude})["shop"="supermarket"];
            
            // Convenience stores
            node(around:${radius},${plot.latitude},${plot.longitude})["shop"="convenience"];
            way(around:${radius},${plot.latitude},${plot.longitude})["shop"="convenience"];
            
            // Restaurants and fast food
            node(around:${radius},${plot.latitude},${plot.longitude})["amenity"~"^(restaurant|fast_food)$"];
            way(around:${radius},${plot.latitude},${plot.longitude})["amenity"~"^(restaurant|fast_food)$"];
            
            // Cafes
            node(around:${radius},${plot.latitude},${plot.longitude})["amenity"="cafe"];
            way(around:${radius},${plot.latitude},${plot.longitude})["amenity"="cafe"];
          );
          out geom;
          out tags;
        `;

        const data = await queryOverpass(combinedQuery);
        
        if (data.elements) {
          const features = data.elements.reduce((acc: any, element: any) => {
            const tags = element.tags || {};
            if (tags.natural === 'coastline') acc.coastline.push(element);
            else if (tags.natural === 'beach') acc.beach.push(element);
            else if (tags.aeroway) acc.airport.push(element);
            else if (tags.place === 'town' || tags.place === 'city') acc.mainTown.push(element);
            else if (tags.highway === 'bus_stop' || 
                    tags.railway === 'station' || 
                    tags.amenity === 'bus_station' ||
                    tags.public_transport) acc.transport.push(element);
            else if (tags.shop === 'supermarket') acc.supermarket.push(element);
            else if (tags.shop === 'convenience') acc.convenience.push(element);
            else if (tags.amenity === 'cafe') acc.cafe.push(element);
            else if (tags.amenity === 'restaurant' || tags.amenity === 'fast_food') 
              acc.restaurant.push(element);
            return acc;
          }, {
            coastline: [],
            beach: [],
            airport: [],
            mainTown: [],
            transport: [],
            supermarket: [],
            convenience: [],
            restaurant: [],
            cafe: []
          });

          const [
            coastline,
            beach,
            airport,
            mainTown,
            publicTransport,
            supermarket,
            convenienceStore,
            restaurantOrFastfood,
            cafe
          ] = await Promise.all([
            findNearestFeature(features.coastline, plot.latitude, plot.longitude),
            findNearestFeature(features.beach, plot.latitude, plot.longitude),
            findNearestFeature(features.airport, plot.latitude, plot.longitude),
            findNearestFeature(features.mainTown, plot.latitude, plot.longitude),
            findNearestFeature(features.transport, plot.latitude, plot.longitude),
            findNearestFeature(features.supermarket, plot.latitude, plot.longitude),
            findNearestFeature(features.convenience, plot.latitude, plot.longitude),
            findNearestFeature(features.restaurant, plot.latitude, plot.longitude),
            findNearestFeature(features.cafe, plot.latitude, plot.longitude)
          ]);

          return {
            coastline,
            beach,
            airport,
            nearest_main_town: mainTown,
            public_transport: publicTransport,
            supermarket,
            convenience_store: convenienceStore,
            restaurant_or_fastfood: restaurantOrFastfood,
            cafe
          };
        }

        return result.amenities;
      })(),

      // Municipality enrichment
      (async () => {
        const municipalityName = await getMunicipalityFromCoordinates(plot.latitude, plot.longitude);
        if (!municipalityName) {
          return { municipality_id: undefined, municipality_name: undefined };
        }

        const municipality = await findMunicipalityByName(client, municipalityName);
        return {
          municipality_id: municipality?.id,
          municipality_name: municipality?.name || municipalityName
        };
      })()
    ]);

    result.amenities = amenitiesResult;
    result.municipality_id = municipalityResult.municipality_id;
    result.municipality_name = municipalityResult.municipality_name;

    return result;
  } catch (error) {
    console.error('Error enriching plot:', error);
    return result;
  }
}

/**
 * Main entry point for combined enrichment
 */
export async function enrichCombined() {
  assertEnv();
  const batchSize = 50; // Smaller batches due to API rate limits
  let totalProcessed = 0;
  let totalSuccessCount = 0;
  let totalFailureCount = 0;
  let batchNumber = 0;

  console.log('Starting combined enrichment (amenities + municipalities) with batching...');
  console.log(`Configuration: Batch size=${batchSize}, Concurrency=${CONCURRENCY_LIMIT}, Delay=${PER_PLOT_DELAY_MS}ms`);
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // Ensure destination table exists
    await ensureEnrichedStage(client);
    while (true) {
      batchNumber++;
      console.log(`\n=== Processing batch ${batchNumber} ===`);

      // Get batch of plots that are not enriched yet (always use OFFSET 0 since we mark as enriched)
      const { rows: unenrichedPlots } = await client.query(
        'SELECT id, latitude, longitude FROM plots_stage WHERE enriched = false ORDER BY id LIMIT $1',
        [batchSize]
      );

      if (!unenrichedPlots || unenrichedPlots.length === 0) {
        console.log('No more unenriched plots to process');
        break;
      }

      console.log(`Found ${unenrichedPlots.length} plots needing enrichment`);
      console.log(`Processing with concurrency limit: ${CONCURRENCY_LIMIT}`);

      let batchSuccessCount = 0;
      let batchFailureCount = 0;

      // Process plots concurrently with rate limiting
      const results = await processConcurrently(
        unenrichedPlots,
        async (plot: Plot, index: number) => {
          console.log(`Processing plot ${index + 1}/${unenrichedPlots.length}: ${plot.id}...`);
          
          try {
            // Optional delay for rate limiting
            if (PER_PLOT_DELAY_MS > 0) {
              await new Promise((resolve) => setTimeout(resolve, PER_PLOT_DELAY_MS * Math.random()));
            }

            // Get combined enrichment data
            const enrichmentResult = await enrichPlotCombined(plot, client);

            // Insert or update plot with all enrichment data
            await client.query(
              `INSERT INTO enriched_plots_stage (id, latitude, longitude, enrichment_data, municipality_id)
               VALUES ($1, $2, $3, $4::jsonb, $5)
               ON CONFLICT (id) DO UPDATE SET
                 enrichment_data = COALESCE(enriched_plots_stage.enrichment_data, '{}'::jsonb) || EXCLUDED.enrichment_data,
                 municipality_id = EXCLUDED.municipality_id`,
              [plot.id, plot.latitude, plot.longitude, JSON.stringify(enrichmentResult.amenities), enrichmentResult.municipality_id || null]
            );

            // Mark plot as enriched in plots_stage
            await client.query('UPDATE plots_stage SET enriched = true WHERE id = $1', [plot.id]);

            console.log(`✓ Successfully enriched plot ${plot.id} with municipality: ${enrichmentResult.municipality_name || 'unknown'}`);
            totalProcessed++;
            return { success: true, plot };
          } catch (error) {
            console.error(`✗ Error processing plot ${plot.id}:`, error);
            return { success: false, plot };
          }
        },
        CONCURRENCY_LIMIT
      );

      // Count successes and failures
      batchSuccessCount = results.filter(r => r.success).length;
      batchFailureCount = results.filter(r => !r.success).length;

      totalSuccessCount += batchSuccessCount;
      totalFailureCount += batchFailureCount;

      console.log(`Batch complete. Success: ${batchSuccessCount}, Failed: ${batchFailureCount}`);

      // If we got fewer plots than the batch size, we're done
      if (unenrichedPlots.length < batchSize) {
        console.log('Reached end of plots');
        break;
      }
    }

    console.log('\n=== Combined Enrichment Complete ===');
    console.log(`Successfully processed: ${totalSuccessCount} plots`);
    console.log(`Failed to process: ${totalFailureCount} plots`);
    console.log(`Total plots processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error in combined enrichment:', error);
  } finally {
    client.release();
    await pool.end();
  }
}
