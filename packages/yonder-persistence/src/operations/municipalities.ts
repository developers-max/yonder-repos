/**
 * Municipality Operations - Database operations for municipality lookups
 */
import { eq } from 'drizzle-orm';
import { getDrizzle } from '../connection';
import { portugalMunicipalities, type PortugalMunicipality } from '../schema';

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
