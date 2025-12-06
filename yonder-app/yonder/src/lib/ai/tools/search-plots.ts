import { z } from 'zod';
import { tool } from 'ai';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Schema for generating plot filters based on user queries
export const searchPlotsSchema = z.object({
  latitude: z.number().optional().describe('Center latitude for location search. REQUIRED when user mentions specific places in Portugal (e.g., Meadela ≈ 41.7400, Lisbon ≈ 38.7223, Porto ≈ 41.1579)'),
  longitude: z.number().optional().describe('Center longitude for location search. REQUIRED when user mentions specific places in Portugal (e.g., Meadela ≈ -8.8080, Lisbon ≈ -9.1393, Porto ≈ -8.6291)'),
  radiusKm: z.preprocess(
    (val) => String(val), // Convert incoming value to string
    z.enum(['10', '25', '50', '100'])
  ).optional().default('50').describe('Search radius in kilometers (default: 50km)').transform(val => Number(val)),
  minPrice: z.number().optional().describe('Minimum price in euros'),
  maxPrice: z.number().optional().describe('Maximum price in euros'),
  minSize: z.number().optional().describe('Minimum size in square meters'),
  maxSize: z.number().optional().describe('Maximum size in square meters'),
  maxDistanceToBeach: z.number().optional().describe('Maximum distance to beach in meters'),
  maxDistanceToCafe: z.number().optional().describe('Maximum distance to café in meters'),
  maxDistanceToSupermarket: z.number().optional().describe('Maximum distance to supermarket in meters'),
  maxDistanceToPublicTransport: z.number().optional().describe('Maximum distance to public transport in meters'),
  maxDistanceToRestaurant: z.number().optional().describe('Maximum distance to restaurant in meters'),
  maxDistanceToMainTown: z.number().optional().describe('Maximum distance to main town in meters'),
  // Zoning filters - substring matches applied to enrichmentData.zoning fields
  zoningLabelContains: z.string().optional().describe('Substring to match in zoning.label'),
  zoningLabelEnContains: z.string().optional().describe('Substring to match in zoning.label_en (English translation)'),
  zoningTypenameContains: z.string().optional().describe('Substring to match in zoning.typename'),
  zoningPickedFieldContains: z.string().optional().describe('Substring to match in zoning.picked_field'),
  zoningSourceContains: z.string().optional().describe('Substring to match in zoning.source'),
  zoningTextContains: z.string().optional().describe('Free-text substring to match anywhere in enrichmentData.zoning JSON'),
  sortBy: z.enum(['price', 'size', 'distance']).optional().default('price').describe('Sort results by price, size, or distance'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc').describe('Sort order: ascending or descending')
});

export type SearchPlotsParams = z.infer<typeof searchPlotsSchema>;

// Direct result type without intermediate interface
export type SearchPlotsResult = ToolResult<{
  filters: SearchPlotsParams;
  summary: string;
  metadata: {
    assistantMessage: string;
    specificity: string;
  };
}>;

export async function generatePlotFilters(params: SearchPlotsParams): Promise<SearchPlotsResult> {
  try {
    const summary = generateFilterSummary(params);
    const metadata = generateSuggestions(params);
    
    return {
      data: {
        filters: params,
        summary,
        metadata
      },
      suggestions: []
    };
  } catch (error) {
    return {
      error: {
        code: ToolErrorCode.UNKNOWN_ERROR,
        details: error instanceof Error ? error.message : 'Failed to generate search filters'
      },
      suggestions: [
        { id: 'retry', action: 'Try again with different parameters' },
        { id: 'contact_support', action: 'Contact support for assistance' }
      ]
    };
  }
}

function generateFilterSummary(params: SearchPlotsParams): string {
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

  // Zoning summary
  const zoningFilters: string[] = [];
  if (params.zoningLabelContains) zoningFilters.push(`label~"${params.zoningLabelContains}"`);
  if (params.zoningLabelEnContains) zoningFilters.push(`label_en~"${params.zoningLabelEnContains}"`);
  if (params.zoningTypenameContains) zoningFilters.push(`typename~"${params.zoningTypenameContains}"`);
  if (params.zoningPickedFieldContains) zoningFilters.push(`picked_field~"${params.zoningPickedFieldContains}"`);
  if (params.zoningSourceContains) zoningFilters.push(`source~"${params.zoningSourceContains}"`);
  if (params.zoningTextContains) zoningFilters.push(`text~"${params.zoningTextContains}"`);
  if (zoningFilters.length > 0) {
    parts.push(`Zoning: ${zoningFilters.join(', ')}`);
  }
  
  if (params.sortBy && params.sortBy !== 'price') {
    parts.push(`Sorted by ${params.sortBy} (${params.sortOrder || 'asc'})`);
  }
  return parts.length > 0 ? parts.join(' • ') : 'All plots';
}

function generateSuggestions(params: SearchPlotsParams) {
  // Analyze the search criteria to provide contextual suggestions
  const hasLocation = Boolean(params.latitude && params.longitude);
  const hasPriceRange = Boolean(params.minPrice || params.maxPrice);
  const hasSizeRange = Boolean(params.minSize || params.maxSize);
  const amenityCount = [
    params.maxDistanceToBeach,
    params.maxDistanceToCafe,
    params.maxDistanceToSupermarket,
    params.maxDistanceToPublicTransport,
    params.maxDistanceToRestaurant,
    params.maxDistanceToMainTown
  ].filter(Boolean).length;

  // Calculate search specificity
  const specificityScore = [hasLocation, hasPriceRange, hasSizeRange].filter(Boolean).length + amenityCount;

  if (!hasLocation) {
    return {
      assistantMessage: "No location specified - search shows plots from all over Portugal. Consider suggesting specific regions or help refine their search criteria.",
      specificity: "broad"
    };
  }

  if (specificityScore <= 2) {
    return {
      assistantMessage: "Broad search criteria may return many results. Suggest adding more specific criteria or encourage initiating outreach if good matches are found.",
      specificity: "broad"
    };
  }

  if (specificityScore >= 5) {
    return {
      assistantMessage: "Very specific search criteria - if few results are found, suggest relaxing some criteria. If good matches exist, encourage contacting realtors immediately.",
      specificity: "very_specific"
    };
  }

  // Default case - moderate search
  return {
    assistantMessage: "Good search criteria balance. Review results and either suggest refinements for more specific matches or encourage outreach for interesting properties.",
    specificity: "moderate"
  };
}

export const searchPlotsTool = tool({
  description: 'Search and browse plots to view them in the map/list panel and add them to the project. Use this when users want to find, search, browse, view, or select plots for their project. This opens the plot selection panel (NOT the outreach panel). IMPORTANT: When users mention specific places in Portugal (cities, towns, regions), you MUST provide latitude and longitude coordinates for that location.',
  parameters: searchPlotsSchema,
  execute: async (params: SearchPlotsParams): Promise<SearchPlotsResult> => {
    console.log('[searchPlotsTool] Tool called with params:', params);
    const result = await generatePlotFilters(params);
    console.log('[searchPlotsTool] Tool result:', result);
    return result;
  }
}); 