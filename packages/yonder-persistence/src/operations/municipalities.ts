/**
 * Municipality Operations - Database operations for municipality lookups
 */
import { eq, ilike } from 'drizzle-orm';
import { getDrizzle, getPgPool } from '../connection';
import { portugalMunicipalities, municipalities, type PortugalMunicipality, type Municipality } from '../schema';

// ============================================================================
// Generic Municipality Operations (used by yonder-enrich)
// ============================================================================

export interface MunicipalityInput {
  name: string;
  district?: string | null;
  country?: string | null;
}

/**
 * Find a municipality by name (exact match first, then case-insensitive)
 */
export async function findMunicipalityByName(
  name: string
): Promise<Municipality | undefined> {
  const db = getDrizzle();
  
  // Exact match first
  let result = await db
    .select()
    .from(municipalities)
    .where(eq(municipalities.name, name))
    .limit(1);
  
  if (result[0]) return result[0];
  
  // Case-insensitive fallback
  result = await db
    .select()
    .from(municipalities)
    .where(ilike(municipalities.name, name))
    .limit(1);
  
  return result[0];
}

/**
 * Insert or update a municipality
 * Returns the municipality record
 */
export async function upsertMunicipality(
  input: MunicipalityInput
): Promise<Municipality | null> {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO municipalities (name, district, country, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET 
         district = COALESCE(EXCLUDED.district, municipalities.district),
         country = COALESCE(EXCLUDED.country, municipalities.country),
         updated_at = NOW()
       RETURNING id, name, district, country`,
      [input.name, input.district || null, input.country || null]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }
    return null;
  } catch (error) {
    console.error(`Error upserting municipality "${input.name}":`, error);
    return null;
  } finally {
    client.release();
  }
}

// ============================================================================
// Portugal-specific Municipality Operations
// ============================================================================

/**
 * Find a Portugal municipality by name
 * @param name - Municipality name (case-sensitive)
 * @returns Municipality record or undefined if not found
 */
export async function findPortugalMunicipalityByName(
  name: string
): Promise<PortugalMunicipality | undefined> {
  const db = getDrizzle();
  const result = await db
    .select()
    .from(portugalMunicipalities)
    .where(eq(portugalMunicipalities.name, name))
    .limit(1);
  return result[0];
}

/**
 * Find a Portugal municipality by CAOP ID
 * @param caopId - CAOP ID (first 4 digits are municipality code)
 * @returns Municipality record or undefined if not found
 */
export async function findPortugalMunicipalityByCaopId(
  caopId: string
): Promise<PortugalMunicipality | undefined> {
  const db = getDrizzle();
  const result = await db
    .select()
    .from(portugalMunicipalities)
    .where(eq(portugalMunicipalities.caopId, caopId))
    .limit(1);
  return result[0];
}

/**
 * Find a Portugal municipality by name or CAOP ID (fallback)
 * First tries name, then falls back to CAOP ID if name not found
 * @param name - Municipality name (optional)
 * @param caopId - CAOP ID fallback (optional)
 * @returns Municipality record or undefined if not found
 */
export async function findPortugalMunicipality(
  name?: string | null,
  caopId?: string | null
): Promise<PortugalMunicipality | undefined> {
  // Try name first if provided
  if (name) {
    const result = await findPortugalMunicipalityByName(name);
    if (result) return result;
  }
  
  // Fallback to CAOP ID if provided
  if (caopId) {
    // CAOP ID might be full code (DDCCFF), extract first 4 digits for municipality
    const municipalityCaopId = caopId.substring(0, 4);
    return findPortugalMunicipalityByCaopId(municipalityCaopId);
  }
  
  return undefined;
}
