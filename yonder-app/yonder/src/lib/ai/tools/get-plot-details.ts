import { tool } from 'ai';
import { z } from 'zod';
import { appRouter } from '@/server/trpc';
import type { EnrichmentData } from '@/server/trpc/router/plot/plots';
import { 
  ToolResult, 
  ToolErrorCode 
} from './types';

// Direct result type without intermediate interfaces
export type PlotDetailsResult = ToolResult<{
  plotId: string;
  plot: {
    id: string;
    price: number;
    size: number | null;
    latitude: number;
    longitude: number;
    images: string[];
    enrichmentData: EnrichmentData | null;
  };
  zoning: {
    label: string | null;
    labelEn: string | null;
    typename: string | null;
    source: string | null;
    hasData: boolean;
  };
  cadastral: {
    reference: string | null;
    address: string | null;
    municipality: string | null;
    province: string | null;
    postalCode: string | null;
    distanceMeters: number | null;
    parcel: {
      reference: string | null;
      area: number | null;
      label: string | null;
    } | null;
    parcelCount: number | null;
    buildingCount: number | null;
    mapViewerUrl: string | null;
    hasData: boolean;
  };
  analysis: {
    pricing: {
      total: number;
      pricePerSqm: number | null;
      notes: string;
    };
  };
  metadata: {
    assistantMessage: string;
  };
}>;

// Tool for getting specific plot details
export const getPlotDetailsTool = tool({
  description: 'Get comprehensive information about a specific plot including price, location, zoning classification, and cadastral data. Use when users mention a plot ID, ask for plot details, zoning information, or cadastral reference.',
  parameters: z.object({
    plotId: z.string().describe('The unique identifier of the plot to get details for')
  }),
  execute: async ({ plotId }): Promise<PlotDetailsResult> => {
    try {
      // Create a tRPC caller with minimal context for plot data (public endpoint)
      const caller = appRouter.createCaller({
        session: null,
        user: undefined,
      });
      
      // Fetch plot details from database
      const plot = await caller.plots.getPlot({ id: plotId });
      
      // Create plot data object
      const plotData = {
        id: plot.id,
        price: plot.price,
        size: plot.size,
        latitude: plot.latitude,
        longitude: plot.longitude,
        images: plot.images,
        enrichmentData: plot.enrichmentData
      };
      
      // Extract zoning information
      const enrichmentData = plotData.enrichmentData as EnrichmentData | null;
      const zoningData = enrichmentData?.zoning;
      const zoning = {
        label: zoningData?.label || null,
        labelEn: zoningData?.label_en || null,
        typename: zoningData?.typename || null,
        source: zoningData?.source || null,
        hasData: !!zoningData,
      };

      // Extract cadastral information
      const cadastralData = enrichmentData?.cadastral;
      const cadastral = {
        reference: cadastralData?.cadastral_reference || null,
        address: cadastralData?.address || null,
        municipality: cadastralData?.municipality || null,
        province: cadastralData?.province || null,
        postalCode: cadastralData?.postal_code || null,
        distanceMeters: cadastralData?.distance_meters || null,
        parcel: cadastralData?.parcel ? {
          reference: cadastralData.parcel.cadastral_reference || null,
          area: cadastralData.parcel.area_value || null,
          label: cadastralData.parcel.label || null,
        } : null,
        parcelCount: cadastralData?.parcel_count || null,
        buildingCount: cadastralData?.building_count || null,
        mapViewerUrl: cadastralData?.map_images?.viewer_url || null,
        hasData: !!cadastralData,
      };
      
      const lat = Number(plotData.latitude);
      const lng = Number(plotData.longitude);
      
      // Build assistant message with zoning/cadastral info
      let assistantMessage = `Retrieved details for plot ${plotId}: €${plotData.price.toLocaleString()}${plotData.size ? `, ${plotData.size.toLocaleString()}m²` : ''} at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}.`;
      
      if (cadastral.hasData) {
        assistantMessage += ` Cadastral reference: ${cadastral.reference || 'N/A'}${cadastral.municipality ? `, ${cadastral.municipality}` : ''}`;
      }
      
      if (zoning.hasData) {
        assistantMessage += ` Zoning: ${zoning.label || zoning.labelEn || zoning.typename || 'Available'}`;
      }
      
      assistantMessage += ' You can analyze pricing, discuss location/amenities, zoning regulations, cadastral details, or guide through next steps.';
      
      const result: PlotDetailsResult = {
        data: {
          plotId,
          plot: plotData,
          zoning,
          cadastral,
          analysis: {
            pricing : generatePricingAnalysis(plotData)
          },
          metadata: {
            assistantMessage
          }
        },
        suggestions: [
          { id: 'analyze_pricing', action: 'Analyze pricing and value proposition' },
          { id: 'discuss_zoning', action: zoning.hasData ? `Explain zoning classification: ${zoning.label || zoning.labelEn || 'Available'}` : 'Discuss zoning regulations' },
          { id: 'review_cadastral', action: cadastral.hasData ? `Review cadastral data: Ref ${cadastral.reference}` : 'Check cadastral information' },
          { id: 'discuss_location', action: 'Discuss location and accessibility' },
          { id: 'review_amenities', action: 'Review nearby amenities and distances' },
          { id: 'ask_municipal_planning', action: cadastral.municipality ? `Query planning regulations for ${cadastral.municipality}` : 'Get municipal planning information' },
          { id: 'generate_report', action: 'Generate comprehensive property report' },
          { id: 'select_plot', action: 'Add to project for tracking' },
        ]
      };
      return result;
    } catch (error) {
      const errorResult: PlotDetailsResult = {
        error: {
          code: ToolErrorCode.RESOURCE_NOT_FOUND,
          details: error instanceof Error ? error.message : 'Failed to fetch plot details'
        },
        suggestions: [
          { id: 'retry', action: 'Try again' },
          { id: 'contact_support', action: 'Contact support' }
        ]
      };
      
      return errorResult;
    }
  },
});

function generatePricingAnalysis(plot: { price: number; size: number | null }) {
  const pricePerSqm = plot.size ? plot.price / plot.size : null;
  
  return {
    total: plot.price,
    pricePerSqm,
    notes: pricePerSqm 
      ? pricePerSqm < 10 ? "Very affordable pricing"
      : pricePerSqm < 25 ? "Moderate pricing" 
      : "Premium pricing"
      : "Size not available for per-sqm calculation"
  };
}