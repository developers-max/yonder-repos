# Yonder Enrich

Service to load, enrich, and expose plot data via Postgres. Enrichments include amenities (OSM), municipalities (reverse geocoding), CRUS zoning, and realtor links.

## Setup

- Node.js 18+
- Postgres (or Supabase Postgres). Provide a connection string via `DATABASE_URL`.
- Install deps:
  ```bash
  npm install
  ```

## Environment variables

- `DATABASE_URL` (required): Postgres connection string.
- `OUTPUTS_DIR` (optional): Folder with JSON inputs for loaders. Default: `./outputs`.
- `REALTORS_DEFAULT_COUNTRY` (optional): Country code for realtor matching. Default: `PT`.
- CRUS options (optional) from `src/enrichments/crus/index.ts`:
  - `CRUS_DRY_RUN` (true/false): Do not write to DB when true.
  - `CRUS_DRY_RUN_LIMIT`: Max plots to process when dry run.
  - `CRUS_INTER_PLOT_DELAY_MS`: Delay between plots.
  - `CRUS_CONCURRENCY`: Number of workers (1–5).
  - `CRUS_TRANSLATE` (true/false): Attempt to translate zoning labels.
  - `CRUS_TRANSLATE_TARGET_LANG` (default `en`), `CRUS_TRANSLATE_SOURCE_LANG` (default `pt`).

## Data model (staging)

- `plots_stage`: staging plots, created/managed by loaders. Loader truncates this table before inserting.
- `enriched_plots_stage`: enrichment outputs (amenities JSON, municipality_id). Auto-created from production schema; staging removes strict columns like `bubble_id` to avoid NOT NULL violations.
- `plots_stage_realtors`: many-to-many links between plots and realtors.

Materialized views (see below) expose unified read-only relations:
- `public.plots` (MV) and `public.enriched_plots` (MV)

## Commands

- `npm run start` — Interactive CLI (`src/index.ts`).
- `npm run api` — Start the REST API server for location enrichment.
- `npm run dev` — Dev mode (auto-restart) for the CLI.
- `npm run build` — Compile TypeScript (tsc).
- `npm run test` — Run tests.

Enrichment scripts (non-interactive entrypoints):
- `npm run amenities` — Enrich amenities around plots from `plots_stage`. Writes to `enriched_plots_stage`.
- `npm run municipalities` — Link plots to municipalities via reverse geocoding. Writes `municipality_id` in `enriched_plots_stage`.
- `npm run combined` — Runs amenities + municipality together and marks `plots_stage.enriched = true`.
- `npm run crus-zoning` — Fetch CRUS zoning for plots and merge into `enriched_plots_stage.enrichment_data.zoning`.

ETL scripts:
- `npm run plots-loader` — Load plot candidates from JSON files under `OUTPUTS_DIR` into `plots_stage`. Truncates `plots_stage` before load.
- `npm run plots-realtors` — Parse outputs and link plots to known realtors into `plots_stage_realtors`.

Materialized views:
- `npm run mviews:create` — Create `public.plots` and `public.enriched_plots` as materialized views.
  - If relations named `plots`/`enriched_plots` exist, they are renamed to `*_backup_<timestamp>` and the MVs are created from those backups (so they display the existing data).
  - Indexes created:
    - `plots(id)` unique, `plots(enriched, id)`, partial `plots(id) WHERE enriched=false`
    - `enriched_plots(id)` unique, `enriched_plots(municipality_id)`, GIN on `enrichment_data`
- `npm run mviews:refresh` — Recreate MVs to source from staging tables (`plots_stage`, `enriched_plots_stage`) and reapply indexes.

## Typical workflow

1. Prepare inputs under `./outputs` (or point `OUTPUTS_DIR`).
2. Load staging plots:
   ```bash
   npm run plots-loader
   ```
3. Optional: link plots to realtors from outputs:
   ```bash
   npm run plots-realtors
   ```
4. Run enrichments (choose one or sequentially):
   ```bash
   npm run amenities
   npm run municipalities
   npm run combined
   npm run crus-zoning
   ```
5. Create or refresh materialized views for consumers:
   ```bash
   npm run mviews:create   # first time (preserves existing relations as backups)
   npm run mviews:refresh  # later runs to point to staging sources
   ```

## API Server

The enrichment service includes a REST API that automatically runs all applicable enrichments for a given location (latitude/longitude).

### Local Development

**Quick Start:**
```bash
npm run api
```

The API server provides:
- **POST `/api/enrich/location`** - Enrich a location with all available data
- **GET `/api/enrich/info`** - API documentation
- **GET `/health`** - Health check

**Documentation:**
- 📖 **Quick Start Guide**: [`src/api/doc/QUICK_START.md`](src/api/doc/QUICK_START.md)
- 📚 **Complete API Guide**: [`src/api/doc/API_USAGE.md`](src/api/doc/API_USAGE.md)
- 🔍 **Enrichment Details**: [`src/api/doc/ENRICHMENTS.md`](src/api/doc/ENRICHMENTS.md)
- 🛠️ **Implementation**: [`src/api/doc/IMPLEMENTATION_SUMMARY.md`](src/api/doc/IMPLEMENTATION_SUMMARY.md)

**Test the API:**
```bash
./src/api/examples/test-api.sh
```

### Cloud Deployment

Deploy to Google Cloud Run with Docker:

**Quick Deploy:**
```bash
# 1. Setup secrets (first time only)
./src/api/gcloud_deployment/setup-secrets.sh

# 2. Deploy to Cloud Run
./src/api/gcloud_deployment/deploy.sh
```

**Documentation:**
- 🚀 **Deployment Guide**: [`src/api/gcloud_deployment/DEPLOYMENT.md`](src/api/gcloud_deployment/DEPLOYMENT.md)
- 🐳 **Docker Testing**: `./src/api/gcloud_deployment/test-docker-build.sh`
- 📦 **Complete Setup**: [`src/api/gcloud_deployment/DOCKER_CLOUD_RUN_SETUP.md`](src/api/gcloud_deployment/DOCKER_CLOUD_RUN_SETUP.md)

**Features:**
- ✅ Serverless auto-scaling
- ✅ Secure secrets management
- ✅ IAM authentication
- ✅ HTTPS by default

## Notes & troubleshooting

- External APIs (Overpass/Nominatim) can be rate limited. Enrichments include delays and retries; for higher throughput, consider self-hosting or caching.
- Staging tables are relaxed (e.g., `bubble_id` is dropped in staging) to avoid insert failures.
- `plots-loader` truncates `plots_stage` each run — this is intentional for clean staging reloads.
