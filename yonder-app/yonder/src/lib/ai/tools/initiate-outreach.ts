import { z } from 'zod';
import { tool } from 'ai';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Simple schema for outreach - just basic filters
// Note: Using .nullable() instead of .optional() for OpenAI strict schema compatibility
export const initiateOutreachSchema = z.object({
  latitude: z.number().nullable().describe('Center latitude for location search'),
  longitude: z.number().nullable().describe('Center longitude for location search'),
  radiusKm: z.number().nullable().describe('Search radius in kilometers'),
  minPrice: z.number().nullable().describe('Minimum price in euros'),
  maxPrice: z.number().nullable().describe('Maximum price in euros'),
  minSize: z.number().nullable().describe('Minimum size in square meters'),
  maxSize: z.number().nullable().describe('Maximum size in square meters'),
  maxDistanceToBeach: z.number().nullable().describe('Maximum distance to beach in meters'),
  maxDistanceToCafe: z.number().nullable().describe('Maximum distance to café in meters'),
  maxDistanceToSupermarket: z.number().nullable().describe('Maximum distance to supermarket in meters'),
  maxDistanceToPublicTransport: z.number().nullable().describe('Maximum distance to public transport in meters'),
  maxDistanceToRestaurant: z.number().nullable().describe('Maximum distance to restaurant in meters'),
  maxDistanceToMainTown: z.number().nullable().describe('Maximum distance to main town in meters'),
  sortBy: z.enum(['price', 'size', 'distance']).nullable().describe('Sort results by price, size, or distance'),
  sortOrder: z.enum(['asc', 'desc']).nullable().describe('Sort order: ascending or descending')
});

export type InitiateOutreachParams = z.infer<typeof initiateOutreachSchema>;

// Direct result type without intermediate interface
export type InitiateOutreachResult = ToolResult<{
  filters: InitiateOutreachParams;
  summary: string;
  metadata: {
    assistantMessage: string;
    specificity: string;
  };
}>;

export async function generateOutreachFilters(params: InitiateOutreachParams): Promise<InitiateOutreachResult> {
  try {
    // Clean the params to remove null values
    const cleanedParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== null && value !== undefined)
    ) as InitiateOutreachParams;
    
    const summary = generateOutreachSummary(cleanedParams);
    
    return {
      data: {
        filters: cleanedParams,
        summary,
        metadata: {
          assistantMessage: "Click below to select plots for outreach to realtors",
          specificity: "interactive"
        }
      },
      suggestions: []
    };
  } catch (error) {
    return {
      error: {
        code: ToolErrorCode.UNKNOWN_ERROR,
        details: error instanceof Error ? error.message : 'Failed to initiate outreach'
      },
      suggestions: [
        { id: 'retry', action: 'Try again' }
      ]
    };
  }
}

function generateOutreachSummary(params: InitiateOutreachParams): string {
  const parts = [];
  
  if (params.latitude && params.longitude) {
    parts.push(`Near ${params.latitude.toFixed(4)}, ${params.longitude.toFixed(4)} (${params.radiusKm || 50}km radius)`);
  }
  
  if (params.minPrice || params.maxPrice) {
    const min = params.minPrice ? `€${params.minPrice.toLocaleString()}` : '€0';
    const max = params.maxPrice ? `€${params.maxPrice.toLocaleString()}` : '∞';
    parts.push(`Price: ${min} - ${max}`);
  }
  
  if (params.minSize || params.maxSize) {
    const min = params.minSize ? `${params.minSize}m²` : '0m²';
    const max = params.maxSize ? `${params.maxSize}m²` : '∞';
    parts.push(`Size: ${min} - ${max}`);
  }
  
  const amenities = [];
  if (params.maxDistanceToBeach) amenities.push(`Beach <${params.maxDistanceToBeach}m`);
  if (params.maxDistanceToCafe) amenities.push(`Café <${params.maxDistanceToCafe}m`);
  if (params.maxDistanceToSupermarket) amenities.push(`Supermarket <${params.maxDistanceToSupermarket}m`);
  if (params.maxDistanceToPublicTransport) amenities.push(`Transport <${params.maxDistanceToPublicTransport}m`);
  if (params.maxDistanceToRestaurant) amenities.push(`Restaurant <${params.maxDistanceToRestaurant}m`);
  if (params.maxDistanceToMainTown) amenities.push(`Town <${params.maxDistanceToMainTown}m`);
  
  if (amenities.length > 0) {
    parts.push(`Amenities: ${amenities.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'All plots';
}



// Tool for initiating outreach to realtors
export const initiateOutreachTool = tool({
  description: 'Open the realtor outreach dialog to contact realtors about plots. ONLY use this when the user explicitly wants to contact, reach out to, or email realtors. Do NOT use for general plot browsing or adding plots to a project - use searchPlots for that instead. IMPORTANT: Always provide latitude/longitude when user mentions specific locations in Portugal. Keep radiusKm reasonable (10-50km max). Example coordinates: Lisbon: 38.7223, -9.1393 | Porto: 41.1579, -8.6291 | Meadela: 41.7400, -8.8080',
  parameters: initiateOutreachSchema,
  execute: async (params: InitiateOutreachParams): Promise<InitiateOutreachResult> => {
    console.log('[initiateOutreachTool] Tool called with params:', params);
    
    // Ensure reasonable radius
    if (params.radiusKm && params.radiusKm > 50) {
      params.radiusKm = 50;
    }
    
    const result = await generateOutreachFilters(params);
    console.log('[initiateOutreachTool] Tool result:', result);
    return result;
  }
}); 