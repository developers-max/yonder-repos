import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const GeneralZoningRulesSchema = z.object({
  areaClassification: z.string().nullable().describe('The general land use classification for the municipality (e.g., Urban, Rural, Mixed Use, Residential, etc.)'),
  typicalPlotSize: z.string().nullable().describe('Typical or minimum plot size requirements (e.g., "500 m²", "1000-2000 m²")'),
  generalHeightLimit: z.string().nullable().describe('General building height limits for the municipality (e.g., "2 floors", "9 meters", "up to 3 stories")'),
  buildingStyle: z.string().nullable().describe('Required or typical building style/architecture (e.g., "Traditional Portuguese", "Modern", "Mediterranean")'),
  futurePlans: z.array(z.string()).nullable().describe('Municipality future development plans, infrastructure projects, or upcoming regulatory changes'),
  keyPoints: z.array(z.string()).nullable().describe('Other important points about zoning, regulations, or municipality-specific considerations'),
  additionalNotes: z.string().nullable().describe('Any other important general zoning information'),
});

export type GeneralZoningRules = z.infer<typeof GeneralZoningRulesSchema>;

export async function extractGeneralZoningRules(
  pdmSummary: string
): Promise<GeneralZoningRules> {
  try {
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: GeneralZoningRulesSchema,
      prompt: `You are an expert in Portuguese and Spanish urban planning regulations (PDM/POUM documents).

Extract general, municipality-level zoning rules from the following PDM document summary. These should be GENERAL rules that apply across the municipality, NOT parcel-specific regulations.

Focus on extracting:
1. Area Classification: The general land use zones or classifications in the municipality
2. Typical Plot Size: Common or minimum plot size requirements mentioned
3. General Height Limit: General building height restrictions for the municipality
4. Building Style: Any architectural style requirements or guidelines
5. Future Plans: Any mentioned future development plans, infrastructure projects, or planned regulatory changes (return as array of strings)
6. Key Points: Other important municipality-specific considerations, special regulations, or notable restrictions (return as array of strings)
7. Additional Notes: Other important general zoning information

For Future Plans and Key Points, extract up to 5 distinct items each. Be concise and factual.
If information is not clearly stated in the summary, return null for that field.

PDM Summary (English version):
${pdmSummary}

Extract the general zoning rules:`,
      temperature: 0.1,
    });

    return result.object;
  } catch (error) {
    console.error('[extractGeneralZoningRules] Error:', error);
    throw new Error('Failed to extract general zoning rules from PDM summary');
  }
}
