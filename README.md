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

Shared database layer containing:

- **Schema**: Drizzle ORM table definitions (plots, municipalities, realtors, etc.)
- **Connection**: PostgreSQL pool management
- **Operations**: Reusable database helpers

```typescript
import { enrichedPlots, municipalities } from '@yonder/persistence/schema';
import { getDrizzle, getPgPool } from '@yonder/persistence/connection';
```

### yonder-app

Next.js web application. See [yonder-app/yonder/README.md](./yonder-app/yonder/README.md).

### yonder-enrich

Plot enrichment service for amenities, zoning, and geocoding. See [yonder-enrich/README.md](./yonder-enrich/README.md).

## Environment Variables

Create `.env` files in each application directory:

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PLOTS_TABLE_ENV=stage  # or 'prod'
```

See `.env.example` files in each package for full configuration.
