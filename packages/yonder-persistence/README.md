# @yonder/persistence

Shared database schema, types, and utilities for the Yonder platform.

## Installation

This package is part of the Yonder monorepo and is available to other workspace packages:

```bash
pnpm add @yonder/persistence --workspace
```

## Usage

### Schema Imports

```typescript
// Import Drizzle schema definitions
import { 
  enrichedPlots, 
  municipalities, 
  plots 
} from '@yonder/persistence/schema';

// Use with Drizzle queries
const results = await db.select().from(enrichedPlots);
```

### Connection Utilities

```typescript
// For Drizzle ORM (type-safe queries)
import { getDrizzle } from '@yonder/persistence/connection';

const db = getDrizzle();
const plots = await db.select().from(enrichedPlots);

// For raw SQL (yonder-enrich style)
import { getPgPool, withClient } from '@yonder/persistence/connection';

const pool = getPgPool();
const result = await pool.query('SELECT * FROM plots_stage LIMIT 10');

// Transaction helper
await withClient(async (client) => {
  await client.query('BEGIN');
  // ... your queries
  await client.query('COMMIT');
});
```

### Common Operations

```typescript
import { 
  upsertEnrichedPlot, 
  getExistingEnrichmentDataMap 
} from '@yonder/persistence';

// Upsert enrichment data
await upsertEnrichedPlot(
  { id: 'uuid', latitude: 41.0, longitude: -8.0 },
  { zoning: { type: 'residential' } }
);

// Get existing enrichment data for multiple plots
const dataMap = await getExistingEnrichmentDataMap(['uuid1', 'uuid2']);
```

## Package Structure

```
src/
├── schema/              # Drizzle schema definitions
│   ├── plots.ts         # Plots and enriched_plots tables
│   ├── municipalities.ts    # Municipalities and PDM tables
│   └── realtors.ts      # Realtor table setup functions
├── connection/          # Database connection utilities
│   └── index.ts         # Pool and Drizzle instance management
├── operations/          # Common database operations
│   ├── plots.ts         # Plot CRUD operations
│   ├── municipalities.ts    # Municipality lookup/upsert
│   └── __tests__/       # Unit tests (vitest)
└── index.ts             # Main entry point
```

## Available Operations

### Plot Operations
```typescript
import {
  upsertEnrichedPlot,
  upsertPlotMunicipality,
  upsertEnrichedPlotWithMunicipality,
  getExistingEnrichmentDataMap,
  getPlotsByIds,
  fetchPlotsBatch,
  markPlotEnriched,
} from '@yonder/persistence';
```

### Municipality Operations
```typescript
import {
  findMunicipalityByName,
  upsertMunicipality,
  findPortugalMunicipalityByName,
  findPortugalMunicipalityByCaopId,
  findPortugalMunicipality,
} from '@yonder/persistence';
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the package (tsup) |
| `pnpm dev` | Watch mode for development |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm typecheck` | TypeScript type checking |

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `PLOTS_TABLE_ENV` - `'prod'` or `'stage'` (default: `'stage'`)
- `REALTORS_DEFAULT_COUNTRY` - Default country for realtors (default: `'Portugal'`)

## Development

After making changes to this package:

```bash
# Rebuild the package
pnpm --filter @yonder/persistence build

# Run tests
pnpm --filter @yonder/persistence test
```

**Important**: Consumers import from `dist/`, so always rebuild after schema or operation changes.
