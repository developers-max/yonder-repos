import { z } from 'zod';
import { tool } from 'ai';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

/**
 * Parse a single DMS (Degrees, Minutes, Seconds) coordinate component to decimal degrees.
 * Supports formats like: 41°11'55.0"N, 41° 11' 55.0" N, 41d11m55.0sN, etc.
 */
function parseDMSComponent(dmsStr: string): { decimal: number; isNegative: boolean } | null {
  // Normalize the string
  const normalized = dmsStr
    .trim()
    .replace(/[″"''`]/g, '"')  // Normalize quotes
    .replace(/[′']/g, "'")     // Normalize prime
    .replace(/[°º]/g, '°')     // Normalize degree symbol
    .replace(/\s+/g, ' ');     // Normalize whitespace

  // Match DMS pattern: degrees°minutes'seconds"[direction]
  // Supports various formats: 41°11'55.0"N, 41 11 55.0 N, 41d11m55.0s N
  const dmsPattern = /^(-?)(\d+(?:\.\d+)?)[°d\s]+(\d+(?:\.\d+)?)?['m\s]*(\d+(?:\.\d+)?)?["s\s]*([NSEW]?)$/i;
  
  const match = normalized.match(dmsPattern);
  if (!match) return null;

  const [, negSign, degStr, minStr, secStr, direction] = match;
  
  const degrees = parseFloat(degStr) || 0;
  const minutes = parseFloat(minStr || '0') || 0;
  const seconds = parseFloat(secStr || '0') || 0;

  // Convert to decimal degrees
  let decimal = degrees + (minutes / 60) + (seconds / 3600);

  // Determine if negative based on direction or sign
  const isNegative = negSign === '-' || 
    direction?.toUpperCase() === 'S' || 
    direction?.toUpperCase() === 'W';

  if (isNegative) {
    decimal = -decimal;
  }

  return { decimal, isNegative };
}

/**
 * Parse a coordinate string that may contain DMS format.
 * Supports formats like:
 * - "41°11'55.0"N 8°40'06.6"W"
 * - "41°11'55.0"N, 8°40'06.6"W"
 * - "41 11 55.0 N 8 40 06.6 W"
 * - "N 41°11'55.0" W 8°40'06.6""
 */
function parseCoordinateString(coordStr: string): { latitude: number; longitude: number } | null {
  if (!coordStr) return null;

  // First, try to detect if it's a simple decimal format "lat, lng" or "lat lng"
  const simpleDecimalPattern = /^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/;
  const simpleMatch = coordStr.trim().match(simpleDecimalPattern);
  if (simpleMatch) {
    const lat = parseFloat(simpleMatch[1]);
    const lng = parseFloat(simpleMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // Try to split into two components for DMS parsing
  // Look for patterns that separate lat and lng
  const normalized = coordStr
    .replace(/[″"''`]/g, '"')
    .replace(/[′']/g, "'")
    .replace(/[°º]/g, '°');

  // Try to split by comma, or by direction letter boundaries
  let parts: string[] = [];
  
  // Split by comma if present
  if (normalized.includes(',')) {
    parts = normalized.split(',').map(s => s.trim());
  } else {
    // Try to split after N/S and before E/W, or after first complete DMS
    const splitPattern = /([NS])\s*(?=\d)|(?<=["'\d])\s+(?=\d)/i;
    parts = normalized.split(splitPattern).filter(s => s && s.trim().length > 1);
    
    // If that didn't work, try splitting in half based on direction indicators
    if (parts.length < 2) {
      const nsMatch = normalized.match(/.*?[NS]["'\s]/i);
      if (nsMatch) {
        parts = [
          normalized.substring(0, nsMatch[0].length).trim(),
          normalized.substring(nsMatch[0].length).trim()
        ];
      }
    }
  }

  if (parts.length !== 2) {
    // Last resort: try to find two DMS patterns
    const dmsPattern = /(-?\d+[°d]\s*\d*['m]?\s*\d*\.?\d*["s]?\s*[NSEW]?)/gi;
    const matches = normalized.match(dmsPattern);
    if (matches && matches.length >= 2) {
      parts = [matches[0], matches[1]];
    }
  }

  if (parts.length !== 2) return null;

  const first = parseDMSComponent(parts[0]);
  const second = parseDMSComponent(parts[1]);

  if (!first || !second) return null;

  // Determine which is lat and which is lng based on direction or value
  // Latitude is typically N/S (or value <= 90), Longitude is E/W (or value > 90)
  let latitude: number, longitude: number;

  const firstHasNS = /[NS]/i.test(parts[0]);
  const firstHasEW = /[EW]/i.test(parts[0]);
  const secondHasNS = /[NS]/i.test(parts[1]);
  const secondHasEW = /[EW]/i.test(parts[1]);

  if (firstHasNS || secondHasEW) {
    latitude = first.decimal;
    longitude = second.decimal;
  } else if (firstHasEW || secondHasNS) {
    latitude = second.decimal;
    longitude = first.decimal;
  } else {
    // No direction indicators, assume first is lat (smaller range)
    if (Math.abs(first.decimal) <= 90) {
      latitude = first.decimal;
      longitude = second.decimal;
    } else {
      latitude = second.decimal;
      longitude = first.decimal;
    }
  }

  // Validate ranges
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

// Schema for navigating to a location on the map
// Note: Using .nullable() instead of .optional() for OpenAI strict schema compatibility
export const navigateToLocationSchema = z.object({
  action: z.enum(['navigate', 'clear']).nullable().describe('Action to perform: "navigate" to go to location and drop pin (default), "clear" to remove the pin from the map.'),
  latitude: z.number().nullable().describe('Latitude coordinate in decimal degrees. Use this OR coordinatesText. Not needed for "clear" action.'),
  longitude: z.number().nullable().describe('Longitude coordinate in decimal degrees. Use this OR coordinatesText. Not needed for "clear" action.'),
  coordinatesText: z.string().nullable().describe('Raw coordinate string in any format (DMS, decimal, etc). Examples: "41°11\'55.0"N 8°40\'06.6"W", "41.1986, -8.6685". The tool will parse this automatically.'),
  zoom: z.number().nullable().describe('Zoom level (1-20, default: 14). Use higher values for closer view.'),
  label: z.string().nullable().describe('Optional label to describe the location (e.g., "Lisbon city center", "User-provided coordinates")'),
});

export type NavigateToLocationParams = z.infer<typeof navigateToLocationSchema>;

// Direct result type
export type NavigateToLocationResult = ToolResult<{
  action: 'navigate' | 'clear';
  latitude?: number;
  longitude?: number;
  zoom?: number;
  label?: string | null;
  metadata: {
    assistantMessage: string;
  };
}>;

export async function navigateToLocation(params: NavigateToLocationParams): Promise<NavigateToLocationResult> {
  try {
    const action = params.action ?? 'navigate';

    // Handle clear action - remove pin from map
    if (action === 'clear') {
      return {
        data: {
          action: 'clear',
          metadata: {
            assistantMessage: 'Cleared the pin from the map'
          }
        },
        suggestions: [
          { id: 'navigate_new', action: 'Navigate to a new location' },
          { id: 'search_plots', action: 'Search for plots in an area' },
        ]
      };
    }

    let latitude: number | null = params.latitude;
    let longitude: number | null = params.longitude;

    // If coordinatesText is provided, try to parse it
    if (params.coordinatesText) {
      const parsed = parseCoordinateString(params.coordinatesText);
      if (parsed) {
        latitude = parsed.latitude;
        longitude = parsed.longitude;
      } else {
        return {
          error: {
            code: ToolErrorCode.INVALID_PARAMETERS,
            details: `Could not parse coordinates from "${params.coordinatesText}". Supported formats: decimal (41.1986, -8.6685), DMS (41°11'55.0"N 8°40'06.6"W)`
          },
          suggestions: [
            { id: 'use_decimal', action: 'Try using decimal format: latitude, longitude' },
            { id: 'check_format', action: 'Check the DMS format includes degrees (°), minutes (\'), seconds (") and direction (N/S/E/W)' }
          ]
        };
      }
    }

    // Check that we have coordinates
    if (latitude === null || longitude === null) {
      return {
        error: {
          code: ToolErrorCode.INVALID_PARAMETERS,
          details: 'No coordinates provided. Please provide latitude/longitude or a coordinate string.'
        },
        suggestions: [
          { id: 'provide_coords', action: 'Provide latitude and longitude values' },
          { id: 'provide_text', action: 'Provide coordinates as text (e.g., "41°11\'55.0"N 8°40\'06.6"W")' }
        ]
      };
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90) {
      return {
        error: {
          code: ToolErrorCode.INVALID_PARAMETERS,
          details: 'Latitude must be between -90 and 90 degrees'
        },
        suggestions: [
          { id: 'fix_latitude', action: 'Provide a valid latitude between -90 and 90' }
        ]
      };
    }

    if (longitude < -180 || longitude > 180) {
      return {
        error: {
          code: ToolErrorCode.INVALID_PARAMETERS,
          details: 'Longitude must be between -180 and 180 degrees'
        },
        suggestions: [
          { id: 'fix_longitude', action: 'Provide a valid longitude between -180 and 180' }
        ]
      };
    }

    const zoom = params.zoom ?? 14;
    const label = params.label ?? null;

    const assistantMessage = label
      ? `Navigating to ${label} (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      : `Navigating to coordinates ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

    return {
      data: {
        action: 'navigate',
        latitude,
        longitude,
        zoom: Math.min(Math.max(zoom, 1), 20), // Clamp between 1 and 20
        label,
        metadata: {
          assistantMessage
        }
      },
      suggestions: [
        { id: 'search_nearby', action: 'Search for plots near this location' },
        { id: 'get_layer_info', action: 'Get layer information for this location' },
        { id: 'clear_pin', action: 'Clear the pin from the map' },
      ]
    };
  } catch (error) {
    return {
      error: {
        code: ToolErrorCode.UNKNOWN_ERROR,
        details: error instanceof Error ? error.message : 'Failed to navigate to location'
      },
      suggestions: [
        { id: 'retry', action: 'Try again with valid coordinates' }
      ]
    };
  }
}

export const navigateToLocationTool = tool({
  description: `Navigate the main search map to a specific location and drop a pin, or remove the pin from the map.

Use this tool when users:
- Provide specific coordinates (latitude/longitude) and want to see that location on the map
- Ask to "go to", "show me", "navigate to", or "center the map on" a specific location
- Mention coordinates in ANY format: decimal, DMS (degrees/minutes/seconds), etc.
- Ask to "remove the pin", "clear the marker", or "hide the pin" from the map

**Actions:**
- action: "navigate" (default) - Navigate to location and drop a pin
- action: "clear" - Remove the pin from the map (no coordinates needed)

**Supported coordinate formats:**
- Decimal: "41.1986, -8.6685" or "41.1986 -8.6685"
- DMS: "41°11'55.0"N 8°40'06.6"W" or "41° 11' 55.0" N, 8° 40' 06.6" W"
- Mixed: "41d11m55s N 8d40m06s W"

**How to use:**
- To clear pin: action: "clear" (no other params needed)
- For DMS or text coordinates: use coordinatesText parameter with the raw string
- For decimal coordinates: use latitude and longitude parameters directly

Examples:
- "Go to 41°11'55.0"N 8°40'06.6"W" → action: "navigate", coordinatesText: "41°11'55.0"N 8°40'06.6"W"
- "Navigate to 41.1986, -8.6685" → action: "navigate", latitude: 41.1986, longitude: -8.6685
- "Remove the pin" → action: "clear"
- "Clear the marker from the map" → action: "clear"

For named places (e.g., "show me Lisbon"), use searchPlots with the location's coordinates instead.`,
  parameters: navigateToLocationSchema,
  execute: async (params: NavigateToLocationParams): Promise<NavigateToLocationResult> => {
    console.log('[navigateToLocationTool] Tool called with params:', params);
    const result = await navigateToLocation(params);
    console.log('[navigateToLocationTool] Tool result:', result);
    return result;
  }
});
