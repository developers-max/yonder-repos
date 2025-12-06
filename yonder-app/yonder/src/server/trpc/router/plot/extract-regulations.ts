import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Schema for the extracted building regulations
export const BuildingRegulationsSchema = z.object({
  maxBuildingHeight: z.string().nullable(),
  maxCoverage: z.string().nullable(),
  setbackRequirements: z.string().nullable(),
  maxFloors: z.string().nullable(),
  parkingRequired: z.string().nullable(),
  greenSpace: z.string().nullable(),
});

export type BuildingRegulations = z.infer<typeof BuildingRegulationsSchema>;

/**
 * Uses GPT-4o-mini to intelligently extract building regulation values from plot report JSON
 */
export async function extractBuildingRegulations(
  plotReportJson: unknown
): Promise<BuildingRegulations> {
  try {
    const prompt = `You are a building regulations data extractor. Given a plot report JSON, extract the following specific values:

1. **Max Building Height** - Maximum allowed building height (e.g., "6m", "9.5 meters", "PB+2 floors")
2. **Max Coverage** - Maximum plot coverage percentage (e.g., "50%", "60% maximum")
3. **Setback Requirements** - Required setbacks from property lines (e.g., "5m front, 3m sides", "3 meters all sides")
4. **Max Floors** - Maximum number of floors allowed (e.g., "PB+2", "2 stories", "Ground + 2")
5. **Parking Required** - Minimum parking spaces required (e.g., "2 spaces minimum", "1.5 spaces/dwelling")
6. **Green Space** - Minimum green space percentage (e.g., "20% minimum", "15%")

Extract these values from the JSON below. Look in sections like:
- legal_cadastral.building_regulations
- building_regulations
- zoning information
- municipal regulations
- development_potential

If a value is not found or unclear, return null for that field.

Format your response as a JSON object with these exact keys:
{
  "maxBuildingHeight": "string or null",
  "maxCoverage": "string or null",
  "setbackRequirements": "string or null",
  "maxFloors": "string or null",
  "parkingRequired": "string or null",
  "greenSpace": "string or null"
}

Plot Report JSON:
${JSON.stringify(plotReportJson, null, 2)}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a precise data extraction assistant. Extract only the requested information and return valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    const validated = BuildingRegulationsSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error('[extract-regulations] Error extracting building regulations:', error);
    
    // Return all nulls if extraction fails
    return {
      maxBuildingHeight: null,
      maxCoverage: null,
      setbackRequirements: null,
      maxFloors: null,
      parkingRequired: null,
      greenSpace: null,
    };
  }
}
