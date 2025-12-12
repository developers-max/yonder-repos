import { tool } from 'ai';
import { z } from 'zod';
import { getToolContext, type GeoJSONPolygon, type PlotContextData } from './tool-context';
import { appRouter } from '@/server/trpc';
import type { EnrichmentData } from '@/server/trpc/router/plot/plots';
import { ToolResult, ToolErrorCode } from './types';

// Layer result from the API
interface LayerResult {
  layerId: string;
  layerName: string;
  found: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

// API response structure
interface LayerInfoResponse {
  coordinates: { lat: number; lng: number };
  country: 'PT' | 'ES';
  timestamp: string;
  layers: LayerResult[];
  areaM2?: number;
  boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  polygon?: GeoJSONPolygon;
}

// Tool result type
export type GetLayerInfoResult = ToolResult<{
  coordinates: { lat: number; lng: number };
  country: 'PT' | 'ES';
  layers: {
    cadastre?: LayerResult;
    ren?: LayerResult;
    ran?: LayerResult;
    municipality?: LayerResult;
    freguesia?: LayerResult;
    district?: LayerResult;
    nuts3?: LayerResult;
    elevation?: LayerResult;
    landUse?: LayerResult; // COS
    corineLandCover?: LayerResult; // CLC
    builtUpAreas?: LayerResult;
  };
  allLayers: LayerResult[];
  areaM2?: number;
  boundingBox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  metadata: {
    assistantMessage: string;
    source: 'plot' | 'coordinates' | 'polygon';
    hasAccurateCoordinates: boolean;
    layersFound: number;
    layersTotal: number;
  };
}>;

// Note: Using .nullable() instead of .optional() for OpenAI strict schema compatibility
const getLayerInfoSchema = z.object({
  // Option 1: Use plot from context or explicit plotId
  plotId: z.string().uuid().nullable().describe('Plot ID to get coordinates and polygon from. If not provided, uses plot from chat context.'),
  
  // Option 2: Use explicit coordinates
  latitude: z.number().nullable().describe('Latitude coordinate (use when user provides specific coordinates)'),
  longitude: z.number().nullable().describe('Longitude coordinate (use when user provides specific coordinates)'),
  
  // Option 3: Use explicit polygon (GeoJSON)
  polygon: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number()))),
  }).nullable().describe('GeoJSON Polygon geometry to query'),
  
  // Optional area for point queries
  areaM2: z.number().nullable().describe('Area in square meters to query around the point (creates a bounding box)'),
  
  // Country override
  country: z.enum(['PT', 'ES']).nullable().describe('Country code (auto-detected from coordinates if not provided)'),
});

export type GetLayerInfoParams = z.infer<typeof getLayerInfoSchema>;

/**
 * Tool for querying geographic layer information (cadastre, zoning, land use, etc.)
 * Can use plot context, explicit coordinates, or polygon geometry
 */
export const getLayerInfoTool = tool({
  description: `Query geographic and regulatory layer information for a location or plot.

Returns data from multiple layers including:
- **Cadastre**: Parcel reference, municipality code, area
- **REN/RAN**: Protected ecological/agricultural zones
- **Administrative**: Municipality, parish (freguesia), district, NUTS III region
- **Land Use**: COS (Carta de Ocupação do Solo) classification
- **Corine Land Cover**: European land cover classification
- **Built-up Areas**: Urban/developed area classification
- **Elevation**: Altitude in meters

Use this tool when users ask about:
- "What zone is this plot in?"
- "Is this land protected?"
- "What's the land classification?"
- "Show me cadastral information"
- "What municipality is this in?"
- "Is there REN/RAN on this plot?"

**IMPORTANT - Interpreting Results:**
Each layer returns detailed attributes that require careful interpretation:

**Zoning & Restrictions (critical for buildability):**
- **REN**: Check \`type\` (TIPOLOGIA). "Exclusões" = REMOVED from REN (buildable). Other values like "Áreas de Elevado Risco de Erosão Hídrica", "Zonas Adjacentes a Cursos de Água" = active restrictions (not buildable).
- **RAN**: Check \`category\` (SERVIDÃO). "Reserva Agrícola Nacional" = active agricultural restriction. \`subcategory\` (DINÂMICA) shows status: "Revisão" = updated, "Exclusão" = removed.
- **CRUS**: \`type\` = zoning class. Solo Urbano/Urbanizável = buildable. Solo Rural/Rústico = limited building. Espaço Agrícola/Florestal/Natural = restricted.

**Administrative (jurisdiction & location):**
- **Municipality**: Official name for Câmara Municipal jurisdiction, PDM lookup, property taxes (IMI).
- **Parish (Freguesia)**: Smallest administrative unit, local services.
- **District**: Regional administration.
- **NUTS III**: EU statistical region for development programs.

**Land Classification (physical reality):**
- **COS**: Current physical land cover from satellite (2018). Shows what IS on the land (forest, agriculture, urban). Compare with CRUS to see if reality matches zoning.
- **Corine Land Cover (CLC)**: European standardized classification. Useful for cross-border comparisons.
- **Built-up Areas**: Indicates developed/urbanized zones.

**Property & Physical:**
- **Cadastre**: Official parcel reference. Compare boundaries with what's being sold. Check if multiple parcels.
- **Elevation**: Altitude in meters. Consider for access, views, construction costs.

**Buildability Assessment:**
Always cross-reference: REN (ecological) + RAN (agricultural) + CRUS (zoning) = complete picture.
Read full \`attributes\` object for legal references, dates, official designations.

**Input options** (in priority order):
1. Plot from chat context (automatic if viewing a plot)
2. Explicit plotId parameter
3. Explicit latitude/longitude coordinates
4. GeoJSON polygon geometry`,

  parameters: getLayerInfoSchema,

  execute: async (params): Promise<GetLayerInfoResult> => {
    const context = getToolContext();
    
    let lat: number | undefined;
    let lng: number | undefined;
    let polygon: GeoJSONPolygon | undefined;
    let areaM2 = params.areaM2;
    let country = params.country;
    let source: 'plot' | 'coordinates' | 'polygon' = 'coordinates';
    let hasAccurateCoordinates = true; // Assume accurate unless using listing coords

    try {
      // Priority 1: Explicit polygon
      if (params.polygon) {
        polygon = params.polygon as GeoJSONPolygon;
        source = 'polygon';
        hasAccurateCoordinates = true;
      }
      // Priority 2: Explicit coordinates (user-provided, assumed accurate)
      else if (params.latitude != null && params.longitude != null) {
        lat = params.latitude;
        lng = params.longitude;
        source = 'coordinates';
        hasAccurateCoordinates = true;
      }
      // Priority 3: Plot (from context data or explicit plotId)
      else {
        // First try to use plot data from context (already fetched by chat route)
        const plotData = context?.plotData;
        const plotId = params.plotId || context?.plotId;
        
        if (plotData) {
          // Use context data directly - no API call needed
          source = 'plot';
          
          // Check if we have accurate coordinates (real_latitude/real_longitude)
          if (plotData.hasAccurateCoordinates && plotData.realLatitude !== undefined && plotData.realLongitude !== undefined) {
            // Use accurate coordinates - can do precise searches
            lat = plotData.realLatitude;
            lng = plotData.realLongitude;
            
            // Use polygon from context if available (only valid with accurate coords)
            if (plotData.polygon && Array.isArray(plotData.polygon.coordinates)) {
              polygon = plotData.polygon;
              source = 'polygon';
            } else if (plotData.size) {
              // Use plot size as area if no polygon
              areaM2 = plotData.size;
            }
          } else {
            // Use listing coordinates (less accurate) - apply 200m buffer
            lat = plotData.latitude;
            lng = plotData.longitude;
            hasAccurateCoordinates = false;
            // ~200m radius buffer for inaccurate listing coordinates
            // 200m radius ≈ 125,600 m² area (pi * r²)
            const LISTING_COORDS_BUFFER_M2 = 125600;
            areaM2 = Math.max(areaM2 || 0, LISTING_COORDS_BUFFER_M2);
            
            // Don't use polygon with inaccurate coordinates - it may not match the location
            polygon = undefined;
          }

          // Auto-detect country from context municipality
          if (!country && plotData.municipality?.countryCode) {
            const countryCode = plotData.municipality.countryCode;
            if (countryCode === 'PT' || countryCode === 'ES') {
              country = countryCode;
            }
          }
          
          console.log('[getLayerInfo] Using plot data from context:', {
            plotId: plotData.id,
            lat,
            lng,
            hasAccurateCoordinates: plotData.hasAccurateCoordinates,
            hasPolygon: !!polygon,
            areaM2,
            country,
          });
        } else if (plotId) {
          // Fallback: Fetch plot data if not in context
          const caller = appRouter.createCaller({
            session: null,
            user: undefined,
          });

          try {
            const plot = await caller.plots.getPlot({ id: plotId });
            source = 'plot';
            
            // Check for real (accurate) coordinates
            const plotWithReal = plot as { real_latitude?: number | string | null; real_longitude?: number | string | null };
            const realLat = plotWithReal.real_latitude != null 
              ? (typeof plotWithReal.real_latitude === 'string' ? parseFloat(plotWithReal.real_latitude) : Number(plotWithReal.real_latitude))
              : undefined;
            const realLng = plotWithReal.real_longitude != null 
              ? (typeof plotWithReal.real_longitude === 'string' ? parseFloat(plotWithReal.real_longitude) : Number(plotWithReal.real_longitude))
              : undefined;
            
            const hasAccurateCoords = realLat !== undefined && realLng !== undefined && 
              !isNaN(realLat) && !isNaN(realLng);
            
            if (hasAccurateCoords) {
              // Use accurate coordinates - can do precise searches
              lat = realLat;
              lng = realLng;
              
              // Check if plot has polygon geometry in enrichment data
              const enrichmentData = plot.enrichmentData as EnrichmentData | null;
              const cadastralData = enrichmentData?.cadastral as Record<string, unknown> | undefined;
              const cadastralPolygon = cadastralData?.polygon as GeoJSONPolygon | undefined;
              
              if (cadastralPolygon && Array.isArray(cadastralPolygon.coordinates)) {
                polygon = cadastralPolygon;
                source = 'polygon';
              } else if (plot.size) {
                areaM2 = Number(plot.size);
              }
            } else {
              // Use listing coordinates (less accurate) - apply 200m buffer
              lat = typeof plot.latitude === 'string' ? parseFloat(plot.latitude) : Number(plot.latitude);
              lng = typeof plot.longitude === 'string' ? parseFloat(plot.longitude) : Number(plot.longitude);
              hasAccurateCoordinates = false;
              // ~200m radius buffer for inaccurate listing coordinates
              const LISTING_COORDS_BUFFER_M2 = 125600;
              areaM2 = Math.max(areaM2 || 0, LISTING_COORDS_BUFFER_M2);
              // Don't use polygon with inaccurate coordinates
              polygon = undefined;
            }

            // Auto-detect country from plot municipality
            if (!country) {
              const municipality = plot.municipality as Record<string, unknown> | undefined;
              const countryCode = municipality?.countryCode as string | undefined;
              if (countryCode === 'PT' || countryCode === 'ES') {
                country = countryCode;
              }
            }
          } catch (error) {
            return {
              error: {
                code: ToolErrorCode.RESOURCE_NOT_FOUND,
                details: `Failed to fetch plot ${plotId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
              suggestions: [
                { id: 'check_plot_id', action: 'Verify the plot ID is correct' },
                { id: 'provide_coords', action: 'Provide coordinates directly instead' },
              ],
            };
          }
        } else {
          return {
            error: {
              code: ToolErrorCode.INVALID_PARAMETERS,
              details: 'No location provided. Please specify coordinates, a polygon, or ensure a plot is selected in the chat.',
            },
            suggestions: [
              { id: 'provide_coords', action: 'Provide latitude and longitude coordinates' },
              { id: 'select_plot', action: 'Select a plot first' },
              { id: 'search_plots', action: 'Search for plots in an area' },
            ],
          };
        }
      }

      // Auto-detect country from coordinates if not provided
      if (!country && lat !== undefined && lng !== undefined) {
        // Simple heuristic: Portugal is roughly west of -6°, Spain is east
        // More accurate: Portugal mainland is between -9.5 and -6.2 longitude
        country = lng < -6.2 ? 'PT' : 'ES';
      }

      // Query the layer-info API
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      let response: Response;
      let data: LayerInfoResponse;

      if (polygon) {
        // POST request with polygon
        response = await fetch(`${baseUrl}/api/layer-info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            polygon,
            country: country || 'PT',
          }),
          signal: AbortSignal.timeout(300000), // 5 minutes to match API route
        });
      } else if (lat !== undefined && lng !== undefined) {
        // GET request with coordinates
        const queryParams = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          country: country || 'PT',
        });
        if (areaM2) {
          queryParams.set('area', String(areaM2));
        }
        
        response = await fetch(`${baseUrl}/api/layer-info?${queryParams}`, {
          signal: AbortSignal.timeout(300000), // 5 minutes to match API route
        });
      } else {
        return {
          error: {
            code: ToolErrorCode.INVALID_PARAMETERS,
            details: 'Could not determine location to query.',
          },
          suggestions: [
            { id: 'provide_coords', action: 'Provide latitude and longitude' },
          ],
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          error: {
            code: ToolErrorCode.EXTERNAL_API_ERROR,
            details: `Layer info API returned ${response.status}: ${errorText}`,
          },
          suggestions: [
            { id: 'retry', action: 'Try again' },
          ],
        };
      }

      data = await response.json();

      // Organize layers by type for easier access
      const findLayer = (id: string) => data.layers.find(l => l.layerId === id);
      
      const layers = {
        cadastre: findLayer('pt-cadastro') || findLayer('es-cadastro'),
        ren: findLayer('pt-ren'),
        ran: findLayer('pt-ran'),
        municipality: findLayer('pt-municipio') || findLayer('pt-municipality-db'),
        freguesia: findLayer('pt-freguesia'),
        district: findLayer('pt-distrito'),
        nuts3: findLayer('pt-nuts3'),
        elevation: findLayer('elevation'),
        landUse: findLayer('pt-cos'),
        corineLandCover: findLayer('pt-clc'),
        builtUpAreas: findLayer('pt-built-up'),
      };

      const layersFound = data.layers.filter(l => l.found).length;
      const layersTotal = data.layers.length;

      // Build assistant message
      const foundLayers = data.layers
        .filter(l => l.found)
        .map(l => l.layerName)
        .slice(0, 5);
      
      let assistantMessage = `Retrieved layer information for ${data.coordinates.lat.toFixed(4)}, ${data.coordinates.lng.toFixed(4)} (${data.country}).`;
      
      // Indicate if results are approximate due to using listing coordinates
      if (!hasAccurateCoordinates) {
        assistantMessage += ` ⚠️ Using approximate listing coordinates with 200m search radius - results may not be exact.`;
      }
      
      if (layersFound > 0) {
        assistantMessage += ` Found data in ${layersFound} of ${layersTotal} layers: ${foundLayers.join(', ')}${layersFound > 5 ? '...' : ''}.`;
      } else {
        assistantMessage += ` No layer data found at this location.`;
      }

      // Add key findings
      if (layers.cadastre?.found && layers.cadastre.data) {
        const cadastreData = layers.cadastre.data as Record<string, unknown>;
        if (cadastreData.parcelReference) {
          assistantMessage += ` Cadastral ref: ${cadastreData.parcelReference}.`;
        }
      }
      
      if (layers.ren?.found) {
        assistantMessage += ` ⚠️ REN (ecological reserve) present.`;
      }
      if (layers.ran?.found) {
        assistantMessage += ` ⚠️ RAN (agricultural reserve) present.`;
      }

      return {
        data: {
          coordinates: data.coordinates,
          country: data.country,
          layers,
          allLayers: data.layers,
          areaM2: data.areaM2,
          boundingBox: data.boundingBox,
          metadata: {
            assistantMessage,
            source,
            hasAccurateCoordinates,
            layersFound,
            layersTotal,
          },
        },
        suggestions: [
          { id: 'explain_zoning', action: 'Explain the zoning classification' },
          { id: 'check_restrictions', action: 'Check for building restrictions' },
          { id: 'view_cadastre', action: 'View cadastral details' },
          { id: 'ask_planning', action: 'Ask about municipal planning regulations' },
        ],
      };

    } catch (error) {
      return {
        error: {
          code: ToolErrorCode.UNKNOWN_ERROR,
          details: error instanceof Error ? error.message : 'Failed to query layer information',
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'provide_coords', action: 'Try with different coordinates' },
        ],
      };
    }
  },
});
