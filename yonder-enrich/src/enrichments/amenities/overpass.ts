import axios from 'axios';

/**
 * Retries a function with exponential backoff
 * @param fn - Function to retry
 * @param retries - Number of retries remaining
 * @param delay - Delay before next retry in ms
 * @param backoff - Multiplier for delay on each retry
 */
async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
  backoff = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.log(`Retrying after ${delay}ms...`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * backoff, backoff);
  }
}

/**
 * Available Overpass API endpoints for redundancy
 */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

/**
 * Queries the OpenStreetMap Overpass API with retry and fallback logic
 * @param query - Overpass QL query string
 * @returns Promise containing the query results
 */
export async function queryOverpass(query: string) {
  let lastError;
  
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await retry(() => 
        axios.post(endpoint, query, {
          timeout: 30000, // 30 second timeout
          headers: {
            'User-Agent': 'YonderEnrich/1.0.0'
          }
        })
      );
      return response.data;
    } catch (error) {
      lastError = error;
      console.log(`Failed with endpoint ${endpoint}, trying next...`);
      continue;
    }
  }
  
  throw lastError;
}

/**
 * Determines the feature type from OSM tags
 * @param tags - OpenStreetMap tags object
 * @returns String representing the feature type
 */
export function getFeatureType(tags: any): string {
  // Natural features
  if (tags.natural === 'coastline') return 'coastline';
  if (tags.natural === 'beach') return 'beach';
  
  // Transport
  if (tags.aeroway) return tags.aeroway;
  if (tags.place) return tags.place;
  
  // Public transport specifics
  if (tags.highway === 'bus_stop') return 'bus_stop';
  if (tags.railway === 'station') return 'train_station';
  if (tags.amenity === 'bus_station') return 'bus_station';
  if (tags.public_transport === 'platform') {
    if (tags.bus === 'yes') return 'bus_stop';
    if (tags.train === 'yes') return 'train_platform';
    return 'transport_platform';
  }
  if (tags.public_transport === 'station') {
    if (tags.bus === 'yes') return 'bus_station';
    if (tags.train === 'yes') return 'train_station';
    return 'transport_station';
  }
  
  // Shops and amenities
  if (tags.shop === 'supermarket') return 'supermarket';
  if (tags.shop === 'convenience') return 'convenience_store';
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.amenity === 'restaurant') return 'restaurant';
  if (tags.amenity === 'fast_food') return 'fast_food';
  
  return 'unknown';
} 