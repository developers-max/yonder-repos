# Yonder Enrich

Plot enrichment service for the Yonder platform. Enriches real estate plots with:

- **Amenities**: Nearby points of interest from OpenStreetMap
- **Municipalities**: Reverse geocoding to link plots to administrative regions
- **CRUS Zoning**: Portuguese land use classification (DGT API)
- **Realtor Links**: Match plots to known real estate agents

## Part of Yonder Monorepo

This package is part of the [yonder-repos](../README.md) monorepo.

**Database operations** are imported from `@yonder/persistence`:

```typescript
import { 
  upsertEnrichedPlot, 
  getExistingEnrichmentDataMap,
  fetchPlotsBatch,
} from '@yonder/persistence';

import { getPgPool } from '@yonder/persistence/connection';
```

## Setup

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database

### Installation

From the monorepo root:

```bash
pnpm install
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

Run from this directory or use `pnpm --filter yonder-enrich <script>` from monorepo root.

| Command | Description |
|---------|-------------|
| `pnpm start` | Interactive CLI |
| `pnpm dev` | Dev mode with auto-restart |
| `pnpm build` | Compile TypeScript |
| `pnpm test` | Run tests |
| `pnpm api` | Start REST API server |

### Enrichment Scripts

| Command | Description |
|---------|-------------|
| `pnpm amenities` | Enrich plots with nearby amenities (OSM) |
| `pnpm municipalities` | Link plots to municipalities via geocoding |
| `pnpm combined` | Run amenities + municipalities together |
| `pnpm crus-zoning` | Fetch CRUS zoning data (Portugal only) |

### ETL Scripts

| Command | Description |
|---------|-------------|
| `pnpm plots-loader` | Load plots from JSON files into staging |
| `pnpm plots-realtors` | Link plots to realtors |

### Materialized Views

| Command | Description |
|---------|-------------|
| `pnpm mviews:create` | Create materialized views (first time) |
| `pnpm mviews:refresh` | Refresh views from staging tables |

## Typical Workflow

1. Prepare inputs under `./outputs` (or set `OUTPUTS_DIR`)
2. Load staging plots:
   ```bash
   pnpm plots-loader
   ```
3. Optional - link plots to realtors:
   ```bash
   pnpm plots-realtors
   ```
4. Run enrichments:
   ```bash
   pnpm combined        # amenities + municipalities
   pnpm crus-zoning     # Portugal zoning data
   ```
5. Create/refresh materialized views:
   ```bash
   pnpm mviews:create   # first time
   pnpm mviews:refresh  # subsequent runs
   ```

## API Server

The enrichment service includes a REST API that automatically runs all applicable enrichments for a given location (latitude/longitude).

### Local Development

**Quick Start:**
```bash
pnpm api
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
