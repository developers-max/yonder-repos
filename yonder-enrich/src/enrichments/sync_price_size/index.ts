import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
function assertEnv() { if (!DATABASE_URL) throw new Error('Missing DATABASE_URL'); }

export async function syncPriceSize() {
  assertEnv();
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    // Ensure destination table exists and has required columns
    await client.query('CREATE TABLE IF NOT EXISTS enriched_plots_stage (LIKE enriched_plots INCLUDING ALL)');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS size NUMERIC');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS price NUMERIC');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_url TEXT');
    await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_json JSONB');

    // 1) Update existing rows in enriched_plots_stage from plots_stage
    const updateRes = await client.query(`
      UPDATE public.enriched_plots_stage eps
      SET
        size = ps.size,
        price = ps.price
      FROM public.plots_stage ps
      WHERE eps.id = ps.id
        AND (eps.size IS DISTINCT FROM ps.size OR eps.price IS DISTINCT FROM ps.price)
    `);

    // 2) Insert missing rows into enriched_plots_stage selecting lat/lon+size/price from plots_stage
    //    Only insert rows that have non-null coordinates to avoid NOT NULL violations.
    const insertRes = await client.query(`
      INSERT INTO public.enriched_plots_stage (id, latitude, longitude, size, price)
      SELECT ps.id, ps.latitude, ps.longitude, ps.size, ps.price
      FROM public.plots_stage ps
      LEFT JOIN public.enriched_plots_stage eps ON eps.id = ps.id
      WHERE eps.id IS NULL
        AND ps.latitude IS NOT NULL
        AND ps.longitude IS NOT NULL
    `);

    console.log(`sync-price-size: updated ${updateRes.rowCount} row(s), inserted ${insertRes.rowCount} row(s).`);
  } catch (e) {
    console.error('sync-price-size failed:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
