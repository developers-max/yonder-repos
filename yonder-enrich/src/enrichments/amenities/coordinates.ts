import * as geolib from 'geolib';

/**
 * Validates if coordinates are valid numbers within reasonable ranges
 * @param lat - Latitude to validate
 * @param lon - Longitude to validate
 * @returns boolean indicating if coordinates are valid
 */
export function isValidCoordinate(lat: number | undefined | null, lon: number | undefined | null): boolean {
  if (lat === undefined || lat === null || lon === undefined || lon === null) return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Safely calculates distance between two points using the Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters, or undefined if calculation fails
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number | undefined {
  try {
    if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
      console.warn('Invalid coordinates:', { lat1, lon1, lat2, lon2 });
      return undefined;
    }
    return geolib.getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    );
  } catch (error) {
    console.warn('Error calculating distance:', error);
    return undefined;
  }
} 