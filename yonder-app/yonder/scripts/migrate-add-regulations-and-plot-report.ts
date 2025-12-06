import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Please set it in your .env');
    process.exit(1);
  }

  const useSsl = /[?&]sslmode=require/.test(url);

  const client = new Client({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected. Running migrations...\n');

    // Migration 1: Add regulations table
    console.log('1. Creating regulations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS regulations (
        id SERIAL PRIMARY KEY,
        municipality_id INTEGER NOT NULL REFERENCES municipalities(id) ON DELETE CASCADE,
        doc_url TEXT NOT NULL,
        regulation JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(municipality_id, doc_url)
      );
    `);
    console.log('   ✓ regulations table created');

    // Create indexes for regulations table
    console.log('   Creating indexes for regulations table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS regulations_municipality_id_idx 
      ON regulations USING btree (municipality_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS regulations_doc_url_idx 
      ON regulations USING btree (doc_url);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS regulations_regulation_gin 
      ON regulations USING gin (regulation);
    `);
    console.log('   ✓ regulations indexes created\n');

    // Migration 2: Add plot_report_url and plot_report_json to enriched_plots_stage (base table)
    console.log('2. Adding plot_report_url and plot_report_json columns to enriched_plots_stage...');
    await client.query(`
      ALTER TABLE enriched_plots_stage 
      ADD COLUMN IF NOT EXISTS plot_report_url TEXT,
      ADD COLUMN IF NOT EXISTS plot_report_json JSONB;
    `);
    console.log('   ✓ plot_report_url and plot_report_json added to enriched_plots_stage\n');

    // Migration 3: Recreate enriched_plots materialized view with new column
    console.log('3. Recreating enriched_plots materialized view...');
    
    // Drop the existing materialized view
    await client.query(`
      DROP MATERIALIZED VIEW IF EXISTS enriched_plots;
    `);
    console.log('   ✓ Dropped old materialized view');
    
    // Recreate with the new columns
    await client.query(`
      CREATE MATERIALIZED VIEW enriched_plots AS
      SELECT 
        id,
        latitude,
        longitude,
        environment,
        geom,
        price,
        size,
        enrichment_data,
        images,
        municipality_id,
        plot_report_url,
        plot_report_json
      FROM enriched_plots_stage;
    `);
    console.log('   ✓ Created new materialized view with plot_report_url and plot_report_json');
    
    // Recreate indexes on the materialized view
    console.log('   Recreating indexes on enriched_plots...');
    await client.query(`
      CREATE INDEX enriched_plots_geom_idx 
      ON enriched_plots USING gist (geom);
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_size 
      ON enriched_plots USING btree (size);
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_price 
      ON enriched_plots USING btree (price);
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_enrichment_gin 
      ON enriched_plots USING gin (enrichment_data);
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_municipality_id 
      ON enriched_plots USING btree (municipality_id);
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_price_size 
      ON enriched_plots USING btree (price, size) 
      WHERE price IS NOT NULL AND size IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_price_not_null 
      ON enriched_plots USING btree (price) 
      WHERE price IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_size_not_null 
      ON enriched_plots USING btree (size) 
      WHERE size IS NOT NULL;
    `);
    await client.query(`
      CREATE INDEX idx_enriched_plots_environment 
      ON enriched_plots USING btree (environment);
    `);
    console.log('   ✓ Indexes recreated on enriched_plots\n');

    // Migration 4: Add valid_email to realtors table
    console.log('4. Adding valid_email column to realtors...');
    await client.query(`
      ALTER TABLE realtors 
      ADD COLUMN IF NOT EXISTS valid_email BOOLEAN DEFAULT NULL;
    `);
    console.log('   ✓ valid_email added to realtors\n');

    console.log('✅ All migrations completed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
