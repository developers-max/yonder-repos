# Yonder Monorepo

This monorepo contains the Yonder platform applications and shared packages.

## Workspace Structure

```
yonder-repos/
├── packages/
│   └── yonder-persistence/    # Shared DB schema, types, and utilities
├── yonder-app/yonder/         # Next.js web application
├── yonder-enrich/             # Plot enrichment service
├── yonder-agent/              # AI agents for plot reports & PDM (Python)
└── yonder-scrape/             # Scraping service (not in workspace)
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+

### Installation

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies
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

# Run commands in a specific package
pnpm --filter yonder <command>
pnpm --filter yonder-enrich <command>
pnpm --filter @yonder/persistence <command>
```

### Database

Both applications share the same PostgreSQL database. Schema definitions are in `@yonder/persistence`.

```bash
# Push schema changes (from yonder-app)
pnpm db:push
```

## Shared Package: @yonder/persistence

The `@yonder/persistence` package contains:

- **Schema Definitions**: Drizzle ORM table definitions for plots, municipalities, realtors, etc.
- **Connection Utilities**: PostgreSQL pool and Drizzle instance management
- **Common Operations**: Reusable database operations (upsert, query helpers)

### Usage

```typescript
// Import schema
import { enrichedPlots, municipalities } from '@yonder/persistence/schema';

// Import connection
import { getDrizzle, getPgPool } from '@yonder/persistence/connection';

// Import operations
import { upsertEnrichedPlot } from '@yonder/persistence';
```

## Environment Variables

Create `.env` files in each application directory with:

```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PLOTS_TABLE_ENV=stage  # or 'prod'
```
