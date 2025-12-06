/**
 * Plot Operations - Common database operations for plots
 */
import { getPgPool } from '../connection';

export interface PlotInput {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * Upsert enrichment data for a plot, merging with existing enrichment_data
 * This preserves all existing enrichment sections and only updates/adds new ones
 */
export async function upsertEnrichedPlot(
  plot: PlotInput,
  enrichmentData: object,
  tableName: string = 'enriched_plots_stage'
): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO ${tableName} (id, latitude, longitude, enrichment_data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         enrichment_data = COALESCE(${tableName}.enrichment_data, '{}'::jsonb) || EXCLUDED.enrichment_data`,
      [plot.id, plot.latitude, plot.longitude, JSON.stringify(enrichmentData)]
    );
  } finally {
    client.release();
  }
}

/**
 * Upsert plot municipality without affecting other fields
 */
export async function upsertPlotMunicipality(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  plot: PlotInput,
  municipalityId: number,
  tableName: string = 'enriched_plots_stage'
): Promise<boolean> {
  try {
    await client.query(
      `INSERT INTO ${tableName} (id, latitude, longitude, municipality_id)
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
 */
export async function getExistingEnrichmentDataMap(
  ids: string[],
  tableName: string = 'enriched_plots_stage'
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return map;

  const pool = getPgPool();
  try {
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, enrichment_data FROM ${tableName} WHERE id = ANY($1)`,
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

/**
 * Get plots by IDs
 */
export async function getPlotsByIds(
  ids: string[],
  tableName: string = 'enriched_plots_stage'
): Promise<Array<{ id: string; latitude: number; longitude: number; enrichment_data?: Record<string, unknown> }>> {
  if (ids.length === 0) return [];

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT id, latitude, longitude, enrichment_data FROM ${tableName} WHERE id = ANY($1)`,
      [ids]
    );
    return res.rows;
  } finally {
    client.release();
  }
}
