# Yonder Monorepo

Monorepo for the Yonder platform - a real estate plot discovery and analysis tool for Portugal and Spain.

## Workspace Structure

```
yonder-repos/
├── packages/
│   └── yonder-persistence/    # Shared DB schema and utilities
├── yonder-app/yonder/         # Next.js web application
└── yonder-enrich/             # Plot enrichment service (TypeScript)
```

> **Note**: `yonder-agent` (Python AI agents) is managed in a separate repository.

## Tech Stack

- **Web App**: Next.js 16, React 19, Tailwind CSS, Mapbox GL
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Better Auth with Google OAuth
- **Enrichment**: Node.js services for OSM, CRUS zoning, geocoding
- **Package Manager**: pnpm workspaces

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Build the shared persistence package
pnpm --filter @yonder/persistence build
```

### Development

```bash
# Run the web app
pnpm dev:app

# Run the enrichment service
pnpm dev:enrich

# Build all packages
pnpm build
```

### Database

Both applications share the same PostgreSQL database. Schema definitions are in `@yonder/persistence`.

```bash
# Push schema changes
pnpm db:push
```

## Packages

### @yonder/persistence

**Single source of truth for all database-related code.**

- **Schema**: Drizzle ORM table definitions (plots, municipalities, realtors, etc.)
- **Connection**: PostgreSQL pool management (`getDrizzle`, `getPgPool`)
- **Operations**: Shared DB operations (`upsertEnrichedPlot`, `findMunicipalityByName`, etc.)
- **Testing**: Unit tests with Vitest

```typescript
// Schema
import { enrichedPlots, municipalities } from '@yonder/persistence/schema';

// Connection
import { getDrizzle, getPgPool } from '@yonder/persistence/connection';

// Operations
import { upsertEnrichedPlot, findMunicipalityByName } from '@yonder/persistence';
```

See [packages/yonder-persistence/README.md](./packages/yonder-persistence/README.md).

### yonder-app

Next.js 16 web application with tRPC, Vercel AI SDK, and Mapbox GL.

- **Framework**: Next.js 16 with App Router and Turbopack
- **API**: tRPC v11 with React Query
- **Auth**: better-auth with Google OAuth
- **UI**: Tailwind CSS v4, Radix UI, shadcn/ui

See [yonder-app/yonder/README.md](./yonder-app/yonder/README.md).

### yonder-enrich

Backend ETL service for plot data enrichment.

- **Enrichments**: Amenities (OSM), Municipalities, CRUS Zoning, Cadastre (PT/ES)
- **API**: REST API for on-demand enrichment
- **Testing**: Jest with supertest

See [yonder-enrich/README.md](./yonder-enrich/README.md).

## Environment Variables

Create `.env` files in each application directory:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PLOTS_TABLE_ENV=stage  # or 'prod'
```

See `.env.example` files in each package for full configuration.
