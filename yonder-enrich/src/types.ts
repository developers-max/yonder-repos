/**
 * Represents a plot of land with its location and enrichment data
 */
export interface Plot {
  id: string;
  latitude: number;
  longitude: number;
  enrichment_data?: EnrichmentData;
}

/**
 * Information about a location, including distance and details about the nearest point
 */
export interface LocationInfo {
  distance: number | undefined;
  nearest_point?: {
    lat: number;
    lon: number;
    name?: string;
    type?: string;
  };
}

/**
 * Contains all the enriched data points for a plot
 * All distances are in meters (straight-line distance)
 */
export interface EnrichmentData {
  coastline: LocationInfo;
  beach: LocationInfo;
  airport: LocationInfo;
  nearest_main_town: LocationInfo;
  public_transport: LocationInfo;
  supermarket: LocationInfo;
  convenience_store: LocationInfo;
  restaurant_or_fastfood: LocationInfo;
  cafe: LocationInfo;
  // Optional: CRUS zoning information (Portugal DGT)
  zoning?: {
    label?: string;
    picked_field?: string;
    source?: string; // e.g. "DGT CRUS"
    typename?: string;
    srs?: string;
    feature_count?: number;
    sample_properties?: Record<string, any>;
  };
}