/**
 * Database Connection Utilities
 * Provides both Drizzle ORM and raw Pool access
 */
import { Pool, PoolClient } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../schema';

// Singleton instances
let pgPool: Pool | null = null;
let drizzleInstance: NodePgDatabase<typeof schema> | null = null;

/**
 * Get database URL from environment
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

/**
 * Get or create the PostgreSQL connection pool
 * Useful for raw SQL queries in yonder-enrich
 */
export function getPgPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

/**
 * Get or create the Drizzle ORM instance
 * Useful for type-safe queries in yonder-app
 */
export function getDrizzle(): NodePgDatabase<typeof schema> {
  if (!drizzleInstance) {
    drizzleInstance = drizzle(getDatabaseUrl(), { schema });
  }
  return drizzleInstance;
}

/**
 * Create a new Drizzle instance with a custom pool
 * Useful for testing or special configurations
 */
export function createDrizzle(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}

/**
 * Close all database connections
 * Call this on application shutdown
 */
export async function closeConnections(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  drizzleInstance = null;
}

/**
 * Helper to get a client from the pool for transactions
 */
export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Re-export the schema for convenience
export { schema };

// Type exports
export type { NodePgDatabase } from 'drizzle-orm/node-postgres';
export type { Pool, PoolClient } from 'pg';
