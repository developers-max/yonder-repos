import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const PlotAnalysisSchema = z.object({
  zoning: z.object({
    classification: z.string().nullable().describe('The specific zoning classification for this plot (e.g., "Urban Residential Zone Type 2", "Rural Agricultural")'),
    description: z.string().nullable().describe('A concise description of what this zoning allows and restricts'),
    keyRestrictions: z.array(z.string()).nullable().describe('List of 3-5 key restrictions or requirements for this zoning type'),
  }),
  buildingRegulations: z.object({
    maxHeight: z.string().nullable().describe('Maximum building height with units (e.g., "9m", "3 floors", "PB+2")'),
    maxCoverage: z.string().nullable().describe('Maximum plot coverage percentage (e.g., "50%", "60% max")'),
    maxFloors: z.string().nullable().describe('Maximum number of floors (e.g., "PB+2", "3 floors")'),
    setbacks: z.string().nullable().describe('Required setbacks from boundaries (e.g., "5m front, 3m sides")'),
    buildableArea: z.string().nullable().describe('Estimated buildable area or construction index (e.g., "200m²", "0.6 coefficient")'),
    other: z.array(z.string()).nullable().describe('Other important building regulations (parking, green space, etc.)'),
  }),
  elevation: z.object({
    averageElevation: z.string().nullable().describe('Average elevation of the plot in meters'),
    slope: z.string().nullable().describe('Slope percentage or description (e.g., "15% slope", "gentle slope", "flat")'),
    topography: z.string().nullable().describe('Brief description of topography (e.g., "relatively flat", "hilly terrain")'),
    constraints: z.array(z.string()).nullable().describe('Elevation-related constraints or advantages'),
  }),
  accessibility: z.object({
    roadAccess: z.string().nullable().describe('Type of road access (e.g., "paved road", "dirt road", "highway")'),
    distance: z.string().nullable().describe('Distance to nearest major road or town'),
    publicTransport: z.string().nullable().describe('Nearest public transport and distance'),
  }),
  environmentalFactors: z.object({
    protectedAreas: z.array(z.string()).nullable().describe('Any nearby protected areas or environmental restrictions'),
    naturalFeatures: z.array(z.string()).nullable().describe('Notable natural features (coast, forest, water bodies)'),
    riskZones: z.array(z.string()).nullable().describe('Any flood zones, fire risk, or other environmental risks'),
  }),
  keyInsights: z.array(z.string()).min(3).max(5).describe('3-5 most important insights about this plot that a buyer should know. ALWAYS provide at least 3 insights.'),
});

export type PlotAnalysis = z.infer<typeof PlotAnalysisSchema>;

interface AnalyzePlotDataInput {
  plotReportJson?: unknown;
  enrichmentData?: unknown;
  municipalityData?: {
    name: string;
    district: string | null;
    country: string | null;
  };
  plotInfo?: {
    latitude: number;
    longitude: number;
    size: number | null;
    price: number;
  };
}

/**
 * Analyzes plot data using GPT-5-nano to extract key information about zoning,
 * building regulations, elevation, and other important factors.
 */
export async function analyzePlotData(input: AnalyzePlotDataInput): Promise<PlotAnalysis> {
  try {
    const { plotReportJson, enrichmentData, municipalityData, plotInfo } = input;

    const prompt = `You are an expert real estate and urban planning analyst. Analyze the following plot data and extract key information about zoning, building regulations, elevation, accessibility, and environmental factors.

**Municipality:** ${municipalityData?.name || 'Unknown'}, ${municipalityData?.district || ''}, ${municipalityData?.country || ''}
${plotInfo ? `**Plot Size:** ${plotInfo.size ? plotInfo.size.toLocaleString() + ' m²' : 'Unknown'}
**Price:** €${plotInfo.price.toLocaleString()}
**Location:** ${plotInfo.latitude}, ${plotInfo.longitude}` : ''}

**Plot Report Data (comprehensive analysis from cadastre and layers):**
${plotReportJson ? JSON.stringify(plotReportJson, null, 2) : 'No plot report available'}

**Enrichment Data (from GIS layers, amenities, distances, etc.):**
${enrichmentData ? JSON.stringify(enrichmentData, null, 2) : 'No enrichment data available'}

IMPORTANT: The plot report JSON contains a wealth of information. Extract data from these key sections:
- **legal_cadastral**: parcel_area, cadastral_id, allowed_uses[], building_regulations (setbacks, max_height, max_floors, lot_coverage, floor_area_ratio), zoning_designation, rezoning_potential
- **executive_summary.key_findings**: risks[], advantages[], development_potential (very important insights)
- **physical_environmental**: topography.elevation_m, topography.slope, soil_type, land_cover, hydrology
- **development_potential**: insights[], alternative_uses[], rezoning_feasibility_score, current_use
- **risks_constraints**: natural_hazards[], protected_areas, environmental_restrictions[]
- **surrounding_amenities**: all distance data to facilities
- **metadata.warnings**: important gaps or unknowns in the data

Based on ALL this data, extract and analyze:

1. **Zoning**: Look for zoning in:
   - enrichmentData.zoning.label (e.g., "Culturas temporárias de sequeiro e regadio")
   - enrichmentData.zoning.land_cover.level4_label for detailed land use classification
   - enrichmentData.layers.layersRaw with layerId="pt-cos" or "pt-clc" for land cover data
   - For cadastral parcels, check if label contains zoning info
   Extract the specific zone type and translate Portuguese terms to English if needed (e.g., "Culturas temporárias" = "Temporary crops", "Florestas mistas" = "Mixed forests"). Describe what this classification means for development.

2. **Building Regulations**: Extract from multiple sources:
   - **plotReportJson.legal_cadastral.building_regulations**: max_height, max_floors, setbacks, lot_coverage, floor_area_ratio
   - **plotReportJson.legal_cadastral.parcel_area**: official parcel area in m² (e.g., 11,135.90 m² = ~1.11 ha)
   - **plotReportJson.legal_cadastral.allowed_uses[]**: what activities are permitted on this land
   - enrichmentData.cadastral.parcel_area_m2 as secondary source
   - enrichmentData.cadastral.cadastral_reference for parcel ID
   
   If building_regulations fields are null, check plotReportJson.metadata.warnings for explanation. Note any restrictions from allowed_uses. Calculate buildable area if lot_coverage or floor_area_ratio is provided.

3. **Elevation & Topography**: Extract from:
   - **plotReportJson.physical_environmental.topography**: elevation_m (e.g., 36), slope value
   - **plotReportJson.physical_environmental.soil_type**: soil composition description
   - **plotReportJson.physical_environmental.land_cover**: COS and CLC land cover data
   - enrichmentData.layers.layersRaw array - find object with layerId="elevation" and extract data.elevationM
   - enrichmentData.layers.layersByCategory.elevation array - same structure
   
   State elevation with unit (e.g., "36m"). If slope is null, infer from context (e.g., "moderate elevation suggests gentle to moderate slopes"). Mention constraints from plotReportJson.risks_constraints.natural_hazards (flood risk, coastal erosion) or advantages (views, drainage).

4. **Accessibility**: Check enrichment data for:
   - enrichmentData.amenities.public_transport (distance in meters, nearest_point with name and type)
   - enrichmentData.amenities.nearest_main_town (distance to nearest town/city)
   - enrichmentData.amenities.highway or road data (if present)
   - plot location relative to municipality center
   Convert distances to user-friendly format (e.g., 242m = "~250m", 711m = "~0.7km"). Describe access quality based on distances.

5. **Environmental Factors**: Extract from:
   - **plotReportJson.risks_constraints.protected_areas**: REN, RAN, EEM status and other protected areas (e.g., coastal safeguard strips)
   - **plotReportJson.risks_constraints.environmental_restrictions[]**: specific restrictions like coastal protection zones
   - **plotReportJson.risks_constraints.natural_hazards[]**: coastal erosion, flood risk, seismic risk
   - **plotReportJson.physical_environmental.hydrology**: coastline distance, floodplain data, surface water
   - enrichmentData.amenities.coastline, beach distances
   - enrichmentData.layers.layersRaw - pt-ren/pt-ran status
   
   IMPORTANT: If REN/RAN status is "unknown" or null, note it as a critical gap that must be verified. List any coastal safeguard strips or protection zones. Mention natural features (coast, beach, forests) with distances.

6. **Key Insights**: Synthesize the MOST IMPORTANT insights from:
   - **plotReportJson.executive_summary.key_findings.advantages[]**: major benefits (location, amenities, suitability)
   - **plotReportJson.executive_summary.key_findings.risks[]**: critical risks (REN/RAN unknown, coastal constraints, rezoning needed)
   - **plotReportJson.executive_summary.key_findings.development_potential**: overall development assessment
   - **plotReportJson.development_potential.insights[]**: detailed analysis points
   - **plotReportJson.development_potential.rezoning_feasibility_score**: feasibility (0-100 scale)
   - **plotReportJson.legal_cadastral.rezoning_potential**: rezoning options and feasibility text
   
   Prioritize insights in this order:
   1. Critical unknowns or risks (REN/RAN status, coastal restrictions, flood risk)
   2. Development constraints or opportunities (current zoning, rezoning feasibility, allowed uses)
   3. Location advantages (amenities, accessibility, proximity to coast/airport)
   4. Value considerations (parcel size, price per m², alternative uses)
   5. Next steps or required verifications (from metadata.warnings)
   
   Limit to 3-5 most impactful insights. Be specific with numbers and distances. Don't repeat information - synthesize and prioritize.

IMPORTANT: Extract ACTUAL values and data from the provided JSON. Don't make assumptions. If a field exists in the data, extract it with specific numbers and units. Only return null if truly not available in any form.`;

    const result = await generateObject({
      model: openai('gpt-5-nano'),
      schema: PlotAnalysisSchema,
      prompt,
      temperature: 0.2,
    });

    return result.object;
  } catch (error) {
    console.error('[analyzePlotData] Error:', error);
    throw new Error('Failed to analyze plot data');
  }
}
