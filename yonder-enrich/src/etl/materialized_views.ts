import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || '';
function assertEnv() { if (!DATABASE_URL) throw new Error('Missing DATABASE_URL'); }

function tsSuffix() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

async function getExistingRelation(client: any, relName: string): Promise<null | { schema: string; kind: string }> {
  const { rows } = await client.query(
    `SELECT n.nspname as schema, c.relkind as kind
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = $1
     LIMIT 1`,
    [relName]
  );
  return rows[0] || null;
}

async function renameRelationIfExists(client: any, relName: string): Promise<string | null> {
  const rel = await getExistingRelation(client, relName);
  if (!rel) return null;
  const backupName = `${relName}_backup_${tsSuffix()}`;
  let alter: string;
  if (rel.kind === 'r' || rel.kind === 'p') {
    alter = `ALTER TABLE public.${relName} RENAME TO ${backupName}`;
  } else if (rel.kind === 'v') {
    alter = `ALTER VIEW public.${relName} RENAME TO ${backupName}`;
  } else if (rel.kind === 'm') {
    alter = `ALTER MATERIALIZED VIEW public.${relName} RENAME TO ${backupName}`;
  } else if (rel.kind === 'S') {
    alter = `ALTER SEQUENCE public.${relName} RENAME TO ${backupName}`;
  } else {
    // default fallback
    alter = `ALTER TABLE public.${relName} RENAME TO ${backupName}`;
  }
  console.log(`Renaming existing relation public.${relName} -> ${backupName}`);
  await client.query(alter);
  return backupName;
}

async function createMaterializedViews(client: any) {
  // plots
  const plotsBackup = await renameRelationIfExists(client, 'plots');
  const plotsSource = plotsBackup ? `public.${plotsBackup}` : 'public.plots_stage';
  console.log(`Creating materialized view public.plots from ${plotsSource}`);
  await client.query(`CREATE MATERIALIZED VIEW IF NOT EXISTS public.plots AS SELECT * FROM ${plotsSource}`);
  try {
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS plots_mv_id_idx ON public.plots (id)`);
  } catch (e) {
    console.warn('Could not create unique index on public.plots(id). Concurrent refresh may be unavailable.', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS plots_enriched_id_idx ON public.plots (enriched, id)`);
  } catch (e) {
    console.warn('Could not create index plots_enriched_id_idx on public.plots(enriched, id):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS plots_unenriched_idx ON public.plots (id) WHERE enriched = false`);
  } catch (e) {
    console.warn('Could not create partial index plots_unenriched_idx on public.plots(id) WHERE enriched=false:', e);
  }

  // Additional indexes mirroring base table `plots` (use MV-specific names to avoid collisions)
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS plots_mv_geom_idx ON public.plots USING GIST (geom)`);
  } catch (e) {
    console.warn('Could not create GIST index plots_mv_geom_idx on public.plots(geom):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plots_mv_size ON public.plots (size ASC NULLS LAST)`);
  } catch (e) {
    console.warn('Could not create index idx_plots_mv_size on public.plots(size):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plots_mv_enriched ON public.plots (enriched)`);
  } catch (e) {
    console.warn('Could not create index idx_plots_mv_enriched on public.plots(enriched):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_plots_mv_casafari_id ON public.plots (casafari_id)`);
  } catch (e) {
    console.warn('Could not create index idx_plots_mv_casafari_id on public.plots(casafari_id):', e);
  }

  // enriched_plots
  const enrichedBackup = await renameRelationIfExists(client, 'enriched_plots');
  const enrichedSource = enrichedBackup ? `public.${enrichedBackup}` : 'public.enriched_plots_stage';
  console.log(`Creating materialized view public.enriched_plots from ${enrichedSource}`);
  await client.query(`CREATE MATERIALIZED VIEW IF NOT EXISTS public.enriched_plots AS SELECT * FROM ${enrichedSource}`);
  try {
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS enriched_plots_mv_id_idx ON public.enriched_plots (id)`);
  } catch (e) {
    console.warn('Could not create unique index on public.enriched_plots(id). Concurrent refresh may be unavailable.', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS enriched_plots_muni_idx ON public.enriched_plots (municipality_id)`);
  } catch (e) {
    console.warn('Could not create index enriched_plots_muni_idx on public.enriched_plots(municipality_id):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS enriched_plots_enrichment_gin ON public.enriched_plots USING GIN (enrichment_data)`);
  } catch (e) {
    console.warn('Could not create GIN index enriched_plots_enrichment_gin on public.enriched_plots(enrichment_data):', e);
  }

  // Additional indexes mirroring base table `enriched_plots` (use MV-specific names to avoid collisions)
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS enriched_plots_mv_geom_idx ON public.enriched_plots USING GIST (geom)`);
  } catch (e) {
    console.warn('Could not create GIST index enriched_plots_mv_geom_idx on public.enriched_plots(geom):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_size ON public.enriched_plots (size ASC NULLS LAST)`);
  } catch (e) {
    console.warn('Could not create index idx_enriched_plots_mv_size on public.enriched_plots(size):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price ON public.enriched_plots (price ASC NULLS LAST)`);
  } catch (e) {
    console.warn('Could not create index idx_enriched_plots_mv_price on public.enriched_plots(price):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price_size ON public.enriched_plots (price, size) WHERE price IS NOT NULL AND size IS NOT NULL`);
  } catch (e) {
    console.warn('Could not create composite partial index idx_enriched_plots_mv_price_size on public.enriched_plots(price, size):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price_not_null ON public.enriched_plots (price) WHERE price IS NOT NULL`);
  } catch (e) {
    console.warn('Could not create partial index idx_enriched_plots_mv_price_not_null on public.enriched_plots(price):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_size_not_null ON public.enriched_plots (size) WHERE size IS NOT NULL`);
  } catch (e) {
    console.warn('Could not create partial index idx_enriched_plots_mv_size_not_null on public.enriched_plots(size):', e);
  }
  try {
    await client.query(`CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_environment ON public.enriched_plots (environment)`);
  } catch (e) {
    console.warn('Could not create index idx_enriched_plots_mv_environment on public.enriched_plots(environment):', e);
  }
}

async function ensureStageColumnsExist(client: any) {
  console.log('Ensuring all required columns exist in stage tables...');
  
  // Ensure enriched_plots_stage has all required columns
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_json JSONB');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS plot_report_url TEXT');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS images JSONB');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS size NUMERIC');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS price NUMERIC');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS municipality_id INTEGER');
  await client.query('ALTER TABLE enriched_plots_stage ADD COLUMN IF NOT EXISTS primary_listing_link TEXT');
  
  console.log('Stage table columns verified.');
}

async function refreshMaterializedViews(client: any) {
  // Recreate both materialized views to switch their sources to _stage tables
  // Handle any existing relation named 'plots' / 'enriched_plots'

  // Ensure stage tables have all required columns before recreating MVs
  await ensureStageColumnsExist(client);

  // plots
  {
    const rel = await getExistingRelation(client, 'plots');
    if (rel) {
      if (rel.kind === 'm') {
        await client.query('DROP MATERIALIZED VIEW IF EXISTS public.plots');
      } else {
        // Rename non-MV to backup to free the name
        await renameRelationIfExists(client, 'plots');
      }
    }
    console.log('Creating materialized view public.plots from public.plots_stage');
    await client.query('CREATE MATERIALIZED VIEW public.plots AS SELECT * FROM public.plots_stage');
    try {
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS plots_mv_id_idx ON public.plots (id)');
    } catch (e) {
      console.warn('Could not create unique index on public.plots(id). Concurrent refresh may be unavailable.', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS plots_enriched_id_idx ON public.plots (enriched, id)');
    } catch (e) {
      console.warn('Could not create index plots_enriched_id_idx on public.plots(enriched, id):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS plots_unenriched_idx ON public.plots (id) WHERE enriched = false');
    } catch (e) {
      console.warn('Could not create partial index plots_unenriched_idx on public.plots(id) WHERE enriched=false:', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS plots_mv_geom_idx ON public.plots USING GIST (geom)');
    } catch (e) {
      console.warn('Could not create GIST index plots_mv_geom_idx on public.plots(geom):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_plots_mv_size ON public.plots (size ASC NULLS LAST)');
    } catch (e) {
      console.warn('Could not create index idx_plots_mv_size on public.plots(size):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_plots_mv_enriched ON public.plots (enriched)');
    } catch (e) {
      console.warn('Could not create index idx_plots_mv_enriched on public.plots(enriched):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_plots_mv_casafari_id ON public.plots (casafari_id)');
    } catch (e) {
      console.warn('Could not create index idx_plots_mv_casafari_id on public.plots(casafari_id):', e);
    }
  }

  // enriched_plots
  {
    const rel = await getExistingRelation(client, 'enriched_plots');
    if (rel) {
      if (rel.kind === 'm') {
        await client.query('DROP MATERIALIZED VIEW IF EXISTS public.enriched_plots');
      } else {
        await renameRelationIfExists(client, 'enriched_plots');
      }
    }
    console.log('Creating materialized view public.enriched_plots from public.enriched_plots_stage');
    await client.query('CREATE MATERIALIZED VIEW public.enriched_plots AS SELECT * FROM public.enriched_plots_stage');
    try {
      await client.query('CREATE UNIQUE INDEX IF NOT EXISTS enriched_plots_mv_id_idx ON public.enriched_plots (id)');
    } catch (e) {
      console.warn('Could not create unique index on public.enriched_plots(id). Concurrent refresh may be unavailable.', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS enriched_plots_muni_idx ON public.enriched_plots (municipality_id)');
    } catch (e) {
      console.warn('Could not create index enriched_plots_muni_idx on public.enriched_plots(municipality_id):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS enriched_plots_enrichment_gin ON public.enriched_plots USING GIN (enrichment_data)');
    } catch (e) {
      console.warn('Could not create GIN index enriched_plots_enrichment_gin on public.enriched_plots(enrichment_data):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS enriched_plots_mv_geom_idx ON public.enriched_plots USING GIST (geom)');
    } catch (e) {
      console.warn('Could not create GIST index enriched_plots_mv_geom_idx on public.enriched_plots(geom):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_size ON public.enriched_plots (size ASC NULLS LAST)');
    } catch (e) {
      console.warn('Could not create index idx_enriched_plots_mv_size on public.enriched_plots(size):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price ON public.enriched_plots (price ASC NULLS LAST)');
    } catch (e) {
      console.warn('Could not create index idx_enriched_plots_mv_price on public.enriched_plots(price):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price_size ON public.enriched_plots (price, size) WHERE price IS NOT NULL AND size IS NOT NULL');
    } catch (e) {
      console.warn('Could not create composite partial index idx_enriched_plots_mv_price_size on public.enriched_plots(price, size):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_price_not_null ON public.enriched_plots (price) WHERE price IS NOT NULL');
    } catch (e) {
      console.warn('Could not create partial index idx_enriched_plots_mv_price_not_null on public.enriched_plots(price):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_size_not_null ON public.enriched_plots (size) WHERE size IS NOT NULL');
    } catch (e) {
      console.warn('Could not create partial index idx_enriched_plots_mv_size_not_null on public.enriched_plots(size):', e);
    }
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_enriched_plots_mv_environment ON public.enriched_plots (environment)');
    } catch (e) {
      console.warn('Could not create index idx_enriched_plots_mv_environment on public.enriched_plots(environment):', e);
    }
  }
}

async function main() {
  assertEnv();
  const action = (process.argv[2] || '').trim();
  if (!action || !['create', 'refresh'].includes(action)) {
    console.error('Usage: ts-node src/etl/materialized_views.ts <create|refresh>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    if (action === 'create') {
      console.log('Creating materialized views public.plots and public.enriched_plots from stage tables...');
      await createMaterializedViews(client);
      console.log('Done.');
    } else if (action === 'refresh') {
      console.log('Recreating materialized views to use stage sources (plots_stage, enriched_plots_stage)...');
      await refreshMaterializedViews(client);
      console.log('Done.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('materialized_views error:', err);
  process.exit(1);
});
