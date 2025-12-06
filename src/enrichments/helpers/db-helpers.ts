import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';

let pgPool: Pool | null = null;

/**
 * Get or create the PostgreSQL connection pool
 */
export function getPgPool(): Pool {
  if (!pgPool && DATABASE_URL) {
    pgPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  if (!pgPool) {
    throw new Error('DATABASE_URL not configured.');
  }
  return pgPool;
}

/**
 * Upsert enrichment data for a plot, merging with existing enrichment_data
 * This preserves all existing enrichment sections and only updates/adds new ones
 * 
 * @param plot - Plot with id, latitude, and longitude
 * @param enrichmentData - Enrichment data to merge (e.g., { "zoning": {...} })
 */
export async function upsertEnrichedPlot(
  plot: { id: string; latitude: number; longitude: number },
  enrichmentData: any
): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO enriched_plots_stage (id, latitude, longitude, enrichment_data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         enrichment_data = COALESCE(enriched_plots_stage.enrichment_data, '{}'::jsonb) || EXCLUDED.enrichment_data`,
      [plot.id, plot.latitude, plot.longitude, JSON.stringify(enrichmentData)]
    );
  } finally {
    client.release();
  }
}

/**
 * Upsert plot municipality without affecting other fields
 * 
 * @param client - Database client
 * @param plot - Plot with id, latitude, and longitude
 * @param municipalityId - Municipality ID to set
 */
export async function upsertPlotMunicipality(
  client: any,
  plot: { id: string; latitude: number; longitude: number },
  municipalityId: number
): Promise<boolean> {
  try {
    await client.query(
      `INSERT INTO enriched_plots_stage (id, latitude, longitude, municipality_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         municipality_id = EXCLUDED.municipality_id`,
      [plot.id, plot.latitude, plot.longitude, municipalityId]
    );
    return true;
  } catch (error) {
    console.error(`Error upserting plot ${plot.id}:`, error);
    return false;
  }
}

/**
 * Get existing enrichment data for a list of plot IDs
 * 
 * @param ids - Array of plot IDs
 * @returns Map of plot ID to enrichment_data object
 */
export async function getExistingEnrichmentDataMap(ids: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (ids.length === 0) return map;
  
  const pool = getPgPool();
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        'SELECT id, enrichment_data FROM enriched_plots_stage WHERE id = ANY($1)',
        [ids]
      );
      for (const row of res.rows) {
        map.set(row.id, row.enrichment_data || {});
      }
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn('Failed to load existing enrichment_data via Postgres:', e);
  }
  return map;
}
