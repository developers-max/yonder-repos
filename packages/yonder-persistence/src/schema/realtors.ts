/**
 * Realtors Schema - Realtor tables and setup functions
 */

// Default country for existing/legacy realtor rows
const REALTORS_DEFAULT_COUNTRY = process.env.REALTORS_DEFAULT_COUNTRY || "Portugal";

// Minimal SQL client interface used by our ensure* helpers
export interface SqlClient {
  query: (text: string, params?: unknown[]) => Promise<unknown>;
}

/**
 * Ensure the realtors table exists with the correct schema
 * Uses raw SQL for flexibility with migrations
 */
export async function ensureRealtorsTable(client: SqlClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS realtors (
      id BIGSERIAL PRIMARY KEY,
      company_name TEXT NOT NULL,
      country TEXT NOT NULL,
      website_url TEXT NOT NULL DEFAULT '',
      email TEXT,
      telephone TEXT,
      valid_email BOOLEAN DEFAULT NULL
    );
  `);
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS country TEXT`);
  await client.query(`UPDATE realtors SET country = $1 WHERE country IS NULL OR country = ''`, [REALTORS_DEFAULT_COUNTRY]);
  await client.query(`ALTER TABLE realtors ALTER COLUMN country SET NOT NULL`);
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS id BIGSERIAL`);
  await client.query(`UPDATE realtors SET id = DEFAULT WHERE id IS NULL`);
  await client.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'realtors'::regclass AND contype = 'p'
    ) THEN
      ALTER TABLE realtors ADD PRIMARY KEY (id);
    END IF;
  END$$;`);
  await client.query(`ALTER TABLE realtors DROP CONSTRAINT IF EXISTS realtors_company_website_uidx`);
  await client.query(`DROP INDEX IF EXISTS realtors_company_website_uidx`);
  await client.query(`DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'realtors'::regclass AND conname = 'realtors_country_name_uidx'
    ) THEN
      ALTER TABLE realtors ADD CONSTRAINT realtors_country_name_uidx UNIQUE (country, company_name);
    END IF;
  END$$;`);
  await client.query(`ALTER TABLE realtors ADD COLUMN IF NOT EXISTS valid_email BOOLEAN DEFAULT NULL`);
}

/**
 * Ensure the plots_stage_realtors join table exists
 */
export async function ensurePlotsStageRealtorsJoinTable(client: SqlClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS plots_stage_realtors (
      plot_id UUID NOT NULL,
      realtor_id BIGINT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      source_file TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (plot_id, realtor_id, role)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_realtors_plot_idx ON plots_stage_realtors(plot_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS plots_stage_realtors_realtor_idx ON plots_stage_realtors(realtor_id);`);
}

// Realtor type (for raw queries - not a Drizzle table yet)
export interface Realtor {
  id: number;
  company_name: string;
  country: string;
  website_url: string;
  email?: string;
  telephone?: string;
  valid_email?: boolean;
}

export interface PlotRealtorJoin {
  plot_id: string;
  realtor_id: number;
  role: string;
  name: string;
  source_file?: string;
  created_at: Date;
}
