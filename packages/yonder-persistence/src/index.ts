/**
 * Yonder Persistence - Shared database schema, types, and utilities
 *
 * @example
 * ```typescript
 * // Import schema for Drizzle queries
 * import { enrichedPlots, municipalities } from '@yonder/persistence/schema';
 *
 * // Import connection utilities
 * import { getDrizzle, getPgPool } from '@yonder/persistence/connection';
 *
 * // Import common operations
 * import { upsertEnrichedPlot } from '@yonder/persistence';
 * ```
 */

// Schema exports
export * from './schema';

// Connection exports
export * from './connection';

// Operations exports
export * from './operations';
