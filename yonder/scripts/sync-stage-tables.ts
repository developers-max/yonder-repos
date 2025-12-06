import 'dotenv/config';
import { Client } from 'pg';

// Configuration of expected table schemas based on schema.ts
// Note: This script only ADDS missing columns/indexes. It will not drop or change existing definitions.

type ColumnSpec = {
  name: string;
  typeSQL: string;
  notNull?: boolean;
  defaultExpr?: string; // SQL expression, e.g. "'version-test'"
  generatedExpr?: string; // e.g. "st_setsrid(st_makepoint(longitude, latitude), 4326)"
  generatedStored?: boolean; // true if GENERATED ALWAYS AS (...) STORED
};

type IndexSpec = {
  name: string;
  using: 'btree' | 'gist' | 'gin';
  columns?: string[]; // normal/simple/compound index
  where?: string; // partial index where clause
  // If custom index is needed (e.g. operations like asc/nullsLast/op), use customSQL
  customSQL?: string; // full index creation SQL after "create index if not exists <name> on <table>"
};

const plotsStageColumns: ColumnSpec[] = [
  { name: 'id', typeSQL: 'uuid', notNull: true },
  { name: 'latitude', typeSQL: 'double precision', notNull: true },
  { name: 'longitude', typeSQL: 'double precision', notNull: true },
  { name: 'environment', typeSQL: 'text', notNull: true, defaultExpr: "'version-test'" },
  {
    name: 'geom',
    typeSQL: 'geometry(Point,4326)',
    generatedExpr: 'st_setsrid(st_makepoint(longitude, latitude), 4326)',
    generatedStored: true,
  },
  { name: 'price', typeSQL: 'numeric(10,2)', defaultExpr: "'0.00'" },
  { name: 'size', typeSQL: 'numeric' },
  { name: 'enriched', typeSQL: 'boolean', defaultExpr: 'false' },
  { name: 'casafari_id', typeSQL: 'bigint' },
];

const plotsStageIndexes: IndexSpec[] = [
  { name: 'idx_plots_stage_size', using: 'btree', columns: ['size'] },
  { name: 'plots_stage_geom_idx', using: 'gist', columns: ['geom'] },
  { name: 'idx_plots_stage_enriched', using: 'btree', columns: ['enriched'] },
  { name: 'idx_plots_stage_casafari_id', using: 'btree', columns: ['casafari_id'] },
];

const enrichedStageColumns: ColumnSpec[] = [
  { name: 'id', typeSQL: 'uuid', notNull: true },
  { name: 'latitude', typeSQL: 'double precision', notNull: true },
  { name: 'longitude', typeSQL: 'double precision', notNull: true },
  { name: 'environment', typeSQL: 'text', notNull: true, defaultExpr: "'version-test'" },
  {
    name: 'geom',
    typeSQL: 'geometry(Point,4326)',
    generatedExpr: 'st_setsrid(st_makepoint(longitude, latitude), 4326)',
    generatedStored: true,
  },
  { name: 'price', typeSQL: 'numeric(10,2)', defaultExpr: "'0.00'" },
  { name: 'size', typeSQL: 'numeric' },
  { name: 'enrichment_data', typeSQL: 'jsonb' },
  { name: 'images', typeSQL: 'jsonb' },
  { name: 'municipality_id', typeSQL: 'integer' },
];

const enrichedStageIndexes: IndexSpec[] = [
  { name: 'enriched_plots_stage_geom_idx', using: 'gist', columns: ['geom'] },
  { name: 'idx_enriched_plots_stage_size', using: 'btree', columns: ['size'] },
  { name: 'idx_enriched_plots_stage_price', using: 'btree', columns: ['price'] },
  { name: 'idx_enriched_plots_stage_enrichment_gin', using: 'gin', columns: ['enrichment_data'] },
  { name: 'idx_enriched_plots_stage_municipality_id', using: 'btree', columns: ['municipality_id'] },
  { name: 'idx_enriched_plots_stage_price_size', using: 'btree', columns: ['price', 'size'], where: 'price IS NOT NULL AND size IS NOT NULL' },
  { name: 'idx_enriched_plots_stage_price_not_null', using: 'btree', columns: ['price'], where: 'price IS NOT NULL' },
  { name: 'idx_enriched_plots_stage_size_not_null', using: 'btree', columns: ['size'], where: 'size IS NOT NULL' },
  { name: 'idx_enriched_plots_stage_environment', using: 'btree', columns: ['environment'] },
];

async function ensureExtension(client: Client, ext: string) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const { rows } = await client.query(
    `SELECT to_regclass($1) as oid`,
    [tableName]
  );
  return !!rows[0]?.oid;
}

async function getColumnMap(client: Client, tableName: string): Promise<Record<string, { data_type: string; is_nullable: 'YES' | 'NO'; column_default: string | null; generation_expression: string | null }>> {
  const { rows } = await client.query(
    `SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, pg_get_expr(ad.adbin, ad.adrelid) as generation_expression
     FROM information_schema.columns c
     LEFT JOIN pg_attrdef ad
       ON ad.adrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass
      AND ad.adnum = (SELECT attnum FROM pg_attribute WHERE attrelid = (quote_ident(c.table_schema)||'.'||quote_ident(c.table_name))::regclass AND attname = c.column_name)
     WHERE c.table_schema = 'public' AND c.table_name = $1`,
    [tableName]
  );
  const map: Record<string, any> = {};
  for (const r of rows) {
    map[r.column_name] = {
      data_type: r.data_type,
      is_nullable: r.is_nullable,
      column_default: r.column_default,
      generation_expression: r.generation_expression,
    };
  }
  return map;
}

async function getIndexNames(client: Client, tableName: string): Promise<Set<string>> {
  const { rows } = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1`,
    [tableName]
  );
  return new Set(rows.map((r) => r.indexname as string));
}

function buildAddColumnSQL(table: string, col: ColumnSpec): string {
  if (col.generatedExpr && col.generatedStored) {
    return `ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.typeSQL} GENERATED ALWAYS AS (${col.generatedExpr}) STORED`;
  }
  const parts = [`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.typeSQL}`];
  if (col.notNull) parts.push('NOT NULL');
  if (col.defaultExpr !== undefined) parts.push(`DEFAULT ${col.defaultExpr}`);
  return parts.join(' ');
}

function buildCreateIndexSQL(table: string, idx: IndexSpec): string {
  if (idx.customSQL) {
    return `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${table} ${idx.customSQL}`;
  }
  const cols = (idx.columns || []).join(', ');
  const where = idx.where ? ` WHERE ${idx.where}` : '';
  return `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${table} USING ${idx.using} (${cols})${where}`;
}

async function ensurePrimaryKey(client: Client, table: string, colName: string) {
  const { rows } = await client.query(
    `SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = $1 AND constraint_type = 'PRIMARY KEY'
     LIMIT 1`,
    [table]
  );
  if (!rows.length) {
    await client.query(`ALTER TABLE "public"."${table}" ADD PRIMARY KEY ("${colName}")`);
  }
}

async function ensureDefaults(client: Client, table: string, col: ColumnSpec) {
  if (!col.defaultExpr) return;
  const { rows } = await client.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     LIMIT 1`,
    [table, col.name]
  );
  const current = rows[0]?.column_default as string | null | undefined;
  if (!current) {
    await client.query(`ALTER TABLE "public"."${table}" ALTER COLUMN "${col.name}" SET DEFAULT ${col.defaultExpr}`);
  }
}

async function ensureTable(client: Client, table: string, columns: ColumnSpec[], indexes: IndexSpec[]) {
  // Ensure postgis extension for geometry
  await ensureExtension(client, 'postgis');

  const exists = await tableExists(client, table);
  if (!exists) {
    // Create minimal table with first column, then add rest iteratively to preserve expressions
    const idCol = columns.find(c => c.name === 'id') || columns[0];
    await client.query(`CREATE TABLE ${table} (${idCol.name} ${idCol.typeSQL}${idCol.notNull ? ' NOT NULL' : ''})`);
  }

  // Columns
  const colMap = await getColumnMap(client, table);
  for (const col of columns) {
    if (!colMap[col.name]) {
      const sql = buildAddColumnSQL(table, col);
      await client.query(sql);
      // Set defaults post-add if needed
      if (col.defaultExpr) {
        await ensureDefaults(client, table, col);
      }
    } else {
      // Ensure default exists if specified in spec
      if (col.defaultExpr) {
        await ensureDefaults(client, table, col);
      }
    }
  }

  // Primary key on id if it matches spec
  if (columns.some(c => c.name === 'id')) {
    await ensurePrimaryKey(client, table, 'id');
  }

  // Indexes
  const idxNames = await getIndexNames(client, table);
  for (const idx of indexes) {
    if (!idxNames.has(idx.name)) {
      const sql = buildCreateIndexSQL(table, idx);
      await client.query(sql);
    }
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Sync plots_stage
    await ensureTable(client, 'plots_stage', plotsStageColumns, plotsStageIndexes);

    // Sync enriched_plots_stage
    await ensureTable(client, 'enriched_plots_stage', enrichedStageColumns, enrichedStageIndexes);

    console.log('Stage tables synchronized successfully.');
  } catch (err) {
    console.error('Failed to synchronize stage tables:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
