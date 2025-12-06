import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';
import { isValidCoordinate } from '../amenities/coordinates';
import { upsertPlotMunicipality } from '../helpers/db-helpers';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
function assertEnv() { if (!DATABASE_URL) throw new Error('Missing DATABASE_URL'); }

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
    country_code?: string; // ISO-2 country code
  };
}

interface MunicipalityData {
  name: string;
  district?: string;
  country?: string; // ISO-2 country code
}

interface Municipality {
  id: number;
  name: string;
  district?: string;
  country?: string; // ISO-2 country code
}

interface PlotWithMunicipality {
  id: string;
  latitude: number;
  longitude: number;
  municipality_id?: number | null;
}

/**
 * Retries a function with exponential backoff
 * @param fn - Function to retry
 * @param retries - Number of retries remaining
 * @param delay - Delay before next retry in ms
 * @param backoff - Multiplier for delay on each retry
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 100,
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
 * Gets municipality data from coordinates using Nominatim reverse geocoding
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Municipality data (name and district) or null if not found
 */
async function getMunicipalityFromCoordinates(
  latitude: number, 
  longitude: number
): Promise<MunicipalityData | null> {
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
          zoom: 10, // Administrative level for municipalities
        },
        headers: {
          'User-Agent': 'YonderEnrich/1.0.0'
        },
        timeout: 30000
      })
    );

    const data: NominatimResponse = response.data;
    
    if (!data || !data.address) {
      console.warn(`No address data found for coordinates: ${latitude}, ${longitude}`);
      return null;
    }

    // Extract municipality name from address components
    // Priority: city > town > village > municipality > county
    const municipalityName = data.address.city || 
                            data.address.town || 
                            data.address.village || 
                            data.address.municipality ||
                            data.address.county;

    if (!municipalityName) {
      console.warn(`No municipality found in address for coordinates: ${latitude}, ${longitude}`);
      return null;
    }

    // Extract district (state or county)
    const district = data.address.state || data.address.county;

    // Extract and normalize country code to ISO-2 format
    const countryCode = data.address.country_code?.toUpperCase().slice(0, 2);

    console.log(`Found municipality: ${municipalityName} (district: ${district || 'N/A'}, country: ${countryCode || 'N/A'}) for coordinates: ${latitude}, ${longitude}`);
    return { name: municipalityName, district, country: countryCode };

  } catch (error) {
    console.error(`Error geocoding coordinates ${latitude}, ${longitude}:`, error);
    return null;
  }
}

/**
 * Inserts a new municipality into the database
 * @param municipalityName - Name of the municipality
 * @param district - Optional district/state name
 * @param country - Optional ISO-2 country code
 * @returns Municipality object or null if insertion failed
 */
async function insertMunicipality(client: any, municipalityName: string, district?: string, country?: string): Promise<Municipality | null> {
  try {
    const res = await client.query(
      `INSERT INTO municipalities (name, district, country, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET 
         district = COALESCE(EXCLUDED.district, municipalities.district),
         country = COALESCE(EXCLUDED.country, municipalities.country),
         updated_at = NOW()
       RETURNING id, name, district, country`,
      [municipalityName, district || null, country || null]
    );

    if (res.rows && res.rows.length > 0) {
      console.log(`Inserted new municipality: "${municipalityName}" (district: ${district || 'N/A'}, country: ${country || 'N/A'})`);
      return res.rows[0];
    }

    return null;
  } catch (error) {
    console.error(`Error inserting municipality "${municipalityName}":`, error);
    return null;
  }
}

/**
 * Finds municipality by name in the municipalities table
 * @param municipalityName - Name of the municipality to find
 * @returns Municipality object or null if not found
 */
async function findMunicipalityByName(client: any, municipalityName: string): Promise<Municipality | null> {
  try {
    // First exact match
    let res = await client.query(
      'SELECT id, name, district, country FROM municipalities WHERE name = $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    // Case-insensitive match
    res = await client.query(
      'SELECT id, name, district, country FROM municipalities WHERE name ILIKE $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    console.warn(`Municipality not found in database: "${municipalityName}"`);
    return null;

  } catch (error) {
    console.error(`Error finding municipality "${municipalityName}":`, error);
    return null;
  }
}

/**
 * Inserts or updates a plot with municipality_id in enriched_plots table
 * @param plot - Plot data from the plots table
 * @param municipalityId - ID of the municipality to link
 */

interface EnrichMunicipalitiesOptions {
  country?: string; // ISO 2-letter country code (e.g., 'ES' for Spain, 'PT' for Portugal)
  forceRefresh?: boolean; // If true, re-process plots that already have municipality_id
}

/**
 * Main entry point for municipality enrichment
 */
export async function enrichMunicipalities(options: EnrichMunicipalitiesOptions = {}) {
  assertEnv();
  const { country, forceRefresh = false } = options;
  const batchSize = 50; // Smaller batches due to API rate limits
  let offset = 0;
  let totalProcessed = 0;
  let totalSuccessCount = 0;
  let totalFailureCount = 0;

  console.log('Starting municipality enrichment with batching...');
  if (country) {
    console.log(`Filtering by country: ${country}`);
  }
  if (forceRefresh) {
    console.log('Force refresh enabled: will re-process plots with existing municipality data');
  }
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // Ensure destination table exists
    await ensureEnrichedStage(client);
    while (true) {
      console.log(`\n=== Processing batch starting at offset ${offset} ===`);

      // Get batch of plots from staging, optionally filtered by country
      let query = 'SELECT id, latitude, longitude FROM plots_stage';
      const params: any[] = [];
      
      if (country) {
        query += ' WHERE country = $1';
        params.push(country);
      }
      
      query += ' ORDER BY id OFFSET $' + (params.length + 1) + ' LIMIT $' + (params.length + 2);
      params.push(offset, batchSize);
      
      const { rows: plots } = await client.query(query, params);

      if (!plots || plots.length === 0) {
        console.log('No more plots to process');
        break;
      }

      // Filter out plots that already have municipality data (unless force refresh is enabled)
      let unenrichedPlots = plots;
      
      if (!forceRefresh) {
        const plotIds = plots.map((p: any) => p.id);
        const { rows: enrichedRows } = await client.query(
          'SELECT id FROM enriched_plots_stage WHERE id = ANY($1) AND municipality_id IS NOT NULL',
          [plotIds]
        );
        const enrichedIds = new Set(enrichedRows.map((r: any) => r.id));
        unenrichedPlots = plots.filter((plot: any) => !enrichedIds.has(plot.id));
      }

      if (!unenrichedPlots || unenrichedPlots.length === 0) {
        if (!forceRefresh) {
          console.log(`No unenriched plots in this batch (${plots.length} plots already have municipality data)`);
        } else {
          console.log('No plots in this batch');
        }
        offset += batchSize;
        continue;
      }

      if (forceRefresh) {
        console.log(`Processing ${unenrichedPlots.length} plots (force refresh mode)`);
      } else {
        console.log(`Found ${unenrichedPlots.length} plots needing municipality enrichment (${plots.length - unenrichedPlots.length} already enriched)`);
      }

      let batchSuccessCount = 0;
      let batchFailureCount = 0;

      // Process each unenriched plot in the batch
      for (let i = 0; i < unenrichedPlots.length; i++) {
        const plot = unenrichedPlots[i];
        console.log(`Processing plot ${i + 1}/${unenrichedPlots.length}: ${plot.id}...`);

        try {
          // Get municipality data from coordinates
          const municipalityData = await getMunicipalityFromCoordinates(plot.latitude, plot.longitude);

          if (!municipalityData) {
            console.warn(`Could not determine municipality for plot ${plot.id}`);
            batchFailureCount++;
            continue;
          }

          // Find municipality in database
          let municipality = await findMunicipalityByName(client, municipalityData.name);

          // If not found, insert it
          if (!municipality) {
            console.log(`Municipality "${municipalityData.name}" not found, inserting...`);
            municipality = await insertMunicipality(client, municipalityData.name, municipalityData.district, municipalityData.country);
            
            if (!municipality) {
              console.error(`Failed to insert municipality "${municipalityData.name}" for plot ${plot.id}`);
              batchFailureCount++;
              continue;
            }
          }

          // Insert or update plot with municipality_id in enriched_plots_stage table
          const updateSuccess = await upsertPlotMunicipality(client, plot, municipality.id);

          if (updateSuccess) {
            console.log(`Successfully linked plot ${plot.id} to municipality "${municipality.name}" (ID: ${municipality.id})`);
            batchSuccessCount++;
            totalProcessed++;
          } else {
            console.error(`Failed to update plot ${plot.id}`);
            batchFailureCount++;
          }

          // Polite delay for Nominatim
          if (i < unenrichedPlots.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }
        } catch (error) {
          console.error(`Error processing plot ${plot.id}:`, error);
          batchFailureCount++;
          continue;
        }
      }

      totalSuccessCount += batchSuccessCount;
      totalFailureCount += batchFailureCount;

      console.log(`Batch complete. Success: ${batchSuccessCount}, Failed: ${batchFailureCount}`);

      // If we got fewer plots than the batch size, we're done
      if (plots.length < batchSize) {
        console.log('Reached end of plots');
        break;
      }

      offset += batchSize;
    }

    console.log('\n=== Municipality Enrichment Complete ===');
    console.log(`Successfully processed: ${totalSuccessCount} plots`);
    console.log(`Failed to process: ${totalFailureCount} plots`);
    console.log(`Total plots processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error in municipality enrichment:', error);
  } finally {
    client.release();
    await pool.end();
  }
}