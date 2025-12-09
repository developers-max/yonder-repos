// GeoJSON Polygon type for plot geometry
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// Plot data available in context when a plot is being viewed
export interface PlotContextData {
  id: string;
  // Listing coordinates (less accurate, from listing)
  latitude: number;
  longitude: number;
  // Real coordinates (accurate, from cadastral enrichment - may not be present)
  realLatitude?: number;
  realLongitude?: number;
  // Whether we have accurate coordinates
  hasAccurateCoordinates: boolean;
  price: number;
  size: number | null;
  images: string[];
  listingTitle?: string;
  listingDescription?: string;
  polygon?: GeoJSONPolygon;
  enrichmentData?: Record<string, unknown>;
  municipality?: {
    id: number;
    name: string;
    countryCode?: string;
  };
}

// Shared global context for all tools that need authentication
let globalToolContext: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  chatId: string;
  organizationId?: string;
  plotId?: string;
  plotData?: PlotContextData;
} | null = null;

export interface ToolContextInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  session: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  chatId: string;
  organizationId?: string;
  plotId?: string;
  plotData?: PlotContextData;
}

export function setToolContext(context: ToolContextInput) {
  globalToolContext = context;
}

export function getToolContext() {
  return globalToolContext;
}

export function clearToolContext() {
  globalToolContext = null;
} 