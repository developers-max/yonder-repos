import { Pool } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import { upsertEnrichedPlot } from '../helpers/db-helpers';
import { LocationInfo, Plot, EnrichmentData } from '../../types';
import { isValidCoordinate, getDistance } from './coordinates';
import { queryOverpass, getFeatureType } from './overpass';

dotenv.config();
const DATABASE_URL = process.env.DATABASE_URL || '';
function assertEnv() { if (!DATABASE_URL) throw new Error('Missing DATABASE_URL'); }

async function ensureEnrichedStage(client: any) {
  // Create staging table with the same structure as enriched_plots
  await client.query(
    'CREATE TABLE IF NOT EXISTS enriched_plots_stage (LIKE enriched_plots INCLUDING ALL)'
  );
  // Ensure bubble_id does not block upserts
  await client.query('ALTER TABLE enriched_plots_stage DROP COLUMN IF EXISTS bubble_id');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_url TEXT');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_json JSONB');
}

/**
 * Finds the nearest feature from a list of OSM elements to a given point
 * Handles both nodes and ways (linear features) from OSM
 * @param elements - Array of OSM elements (nodes or ways)
 * @param plotLat - Latitude of the reference point
 * @param plotLon - Longitude of the reference point
 * @returns Distance to the nearest feature in meters, or undefined if no features found
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
 * Enriches a plot with nearby feature information from OpenStreetMap
 * @param plot - Plot to enrich
 * @returns EnrichmentData containing distances and details of nearby features
 */
export async function enrichPlot(plot: Plot): Promise<EnrichmentData> {
  const enrichmentData: EnrichmentData = {
    coastline: { distance: undefined },
    beach: { distance: undefined },
    airport: { distance: undefined },
    nearest_main_town: { distance: undefined },
    public_transport: { distance: undefined },
    supermarket: { distance: undefined },
    convenience_store: { distance: undefined },
    restaurant_or_fastfood: { distance: undefined },
    cafe: { distance: undefined }
  };

  if (!isValidCoordinate(plot.latitude, plot.longitude)) {
    console.warn(`Invalid plot coordinates for plot ${plot.id}:`, { lat: plot.latitude, lon: plot.longitude });
    return enrichmentData;
  }

  const radius = 10000; // 10km radius

  try {
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

      enrichmentData.coastline = coastline;
      enrichmentData.beach = beach;
      enrichmentData.airport = airport;
      enrichmentData.nearest_main_town = mainTown;
      enrichmentData.public_transport = publicTransport;
      enrichmentData.supermarket = supermarket;
      enrichmentData.convenience_store = convenienceStore;
      enrichmentData.restaurant_or_fastfood = restaurantOrFastfood;
      enrichmentData.cafe = cafe;
    }

    return enrichmentData;
  } catch (error) {
    console.error('Error enriching plot:', error);
    return enrichmentData;
  }
}

/**
 * Main entry point for amenities enrichment
 */
export async function enrichAmenities() {
  assertEnv();
  const batchSize = 100; // Process 100 plots at a time
  let offset = 0;
  let totalProcessed = 0;
  
  try {
    console.log('Starting amenities enrichment with batching...');
    const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();
    try {
    // Ensure destination table exists
    await ensureEnrichedStage(client);
    
    while (true) {
      console.log(`\n=== Processing batch starting at offset ${offset} ===`);
      
      // Get batch of plots from staging
      const { rows: plots } = await client.query(
        'SELECT id, latitude, longitude FROM plots_stage ORDER BY id OFFSET $1 LIMIT $2',
        [offset, batchSize]
      );
      
      if (!plots || plots.length === 0) {
        console.log('No more plots to process');
        break;
      }
      
      // Filter out plots that are already enriched
      const plotIds = plots.map((p: any) => p.id);
      const { rows: enrichedRows } = await client.query(
        'SELECT id FROM enriched_plots_stage WHERE id = ANY($1) AND enrichment_data IS NOT NULL',
        [plotIds]
      );
      const enrichedIds = new Set(enrichedRows.map((r: any) => r.id));
      const unenrichedPlots = plots.filter(plot => !enrichedIds.has(plot.id));
      
      if (!unenrichedPlots || unenrichedPlots.length === 0) {
        console.log(`No unenriched plots in this batch (${plots.length} plots already enriched)`);
        offset += batchSize;
        continue;
      }
      
      console.log(`Found ${unenrichedPlots.length} unenriched plots in this batch (${plots.length - unenrichedPlots.length} already enriched)`);
      
      // Process each unenriched plot in the batch
      for (const plot of unenrichedPlots) {
        console.log(`Processing plot ${plot.id}...`);
        const enrichmentData = await enrichPlot(plot as Plot);
        
        // Insert or update plot with enrichment data in enriched_plots_stage table
        await upsertEnrichedPlot(
          { id: plot.id, latitude: (plot as any).latitude, longitude: (plot as any).longitude },
          enrichmentData
        );
        
        console.log(`Successfully enriched plot ${plot.id}`);
        totalProcessed++;
      }
      
      // If we got fewer plots than the batch size, we're done
      if (plots.length < batchSize) {
        console.log('Reached end of plots');
        break;
      }
      
      offset += batchSize;
      console.log(`Batch complete. Processed ${unenrichedPlots.length} plots in this batch.`);
    }
    } finally {
      client.release();
      await pool.end();
    }
    
    console.log(`\n=== Amenities Enrichment Complete ===`);
    console.log(`Total plots processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error in amenities enrichment:', error);
  }
}