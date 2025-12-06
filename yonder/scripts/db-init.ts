import 'dotenv/config';
import { Client } from 'pg';
import { ensureRealtorsTable, ensurePlotsStageRealtorsJoinTable } from "../src/lib/db/schema";

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
    console.log('Connected. Ensuring PostGIS extension exists...');

    // Create PostGIS (needed for geometry types in your schema)
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');

    // Optionally enable additional related extensions if you plan to use them
    // await client.query('CREATE EXTENSION IF NOT EXISTS postgis_topology');
    // await client.query('CREATE EXTENSION IF NOT EXISTS postgis_raster');

    console.log('PostGIS ensured.');

    // Ensure realtor companies table exists for domain-based role assignment
    console.log('Ensuring realtors table exists...');
    await ensureRealtorsTable(client);
    console.log('Realtors table ensured.');

    // Ensure plots_stage_realtors join table exists
    console.log('Ensuring plots_stage_realtors table exists...');
    await ensurePlotsStageRealtorsJoinTable(client);
    console.log('plots_stage_realtors table ensured.');
  } catch (err) {
    console.error('Failed to initialize database extensions:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
