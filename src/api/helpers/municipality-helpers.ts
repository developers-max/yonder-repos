import axios from 'axios';
import { isValidCoordinate } from '../../enrichments/amenities/coordinates';

interface NominatimResponse {
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string; // ISO-2 country code
  };
}

export interface MunicipalityData {
  name: string;
  district?: string;
  country?: string; // ISO-2 country code
}

export interface Municipality {
  id: number;
  name: string;
  district?: string;
  country?: string; // ISO-2 country code
}

/**
 * Retries a function with exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 100,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

/**
 * Gets municipality data from coordinates using Nominatim reverse geocoding
 */
export async function getMunicipalityFromCoordinates(
  latitude: number, 
  longitude: number
): Promise<MunicipalityData | null> {
  if (!isValidCoordinate(latitude, longitude)) {
    console.warn(`Invalid coordinates: ${latitude}, ${longitude}`);
    return null;
  }

  try {
    const response = await retry(() =>
      axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat: latitude,
          lon: longitude,
          addressdetails: 1,
          zoom: 10,
        },
        headers: {
          'User-Agent': 'YonderEnrich/1.0.0'
        },
        timeout: 30000
      })
    );

    const data: NominatimResponse = response.data;
    
    if (!data || !data.address) {
      console.warn(`No address data found for coordinates: ${latitude}, ${longitude}`);
      return null;
    }

    const municipalityName = data.address.city || 
                            data.address.town || 
                            data.address.village || 
                            data.address.municipality ||
                            data.address.county;

    if (!municipalityName) {
      console.warn(`No municipality found in address for coordinates: ${latitude}, ${longitude}`);
      return null;
    }

    const district = data.address.state || data.address.county;
    const countryCode = data.address.country_code?.toUpperCase().slice(0, 2);

    return { name: municipalityName, district, country: countryCode };

  } catch (error) {
    console.error(`Error geocoding coordinates ${latitude}, ${longitude}:`, error);
    return null;
  }
}

/**
 * Finds municipality by name in the municipalities table
 */
export async function findMunicipalityByName(client: any, municipalityName: string): Promise<Municipality | null> {
  try {
    let res = await client.query(
      'SELECT id, name, district, country FROM municipalities WHERE name = $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    res = await client.query(
      'SELECT id, name, district, country FROM municipalities WHERE name ILIKE $1 LIMIT 1',
      [municipalityName]
    );
    if (res.rows && res.rows.length > 0) return res.rows[0];

    return null;

  } catch (error) {
    console.error(`Error finding municipality "${municipalityName}":`, error);
    return null;
  }
}

/**
 * Inserts a new municipality into the database
 */
export async function insertMunicipality(client: any, municipalityName: string, district?: string, country?: string): Promise<Municipality | null> {
  try {
    const res = await client.query(
      `INSERT INTO municipalities (name, district, country, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE SET 
         district = COALESCE(EXCLUDED.district, municipalities.district),
         country = COALESCE(EXCLUDED.country, municipalities.country),
         updated_at = NOW()
       RETURNING id, name, district, country`,
      [municipalityName, district || null, country || null]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }

    return null;
  } catch (error) {
    console.error(`Error inserting municipality "${municipalityName}":`, error);
    return null;
  }
}
