import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PlotDescriptionInput {
  location: {
    address?: string;
    municipality?: string;
    district?: string;
  };
  zoning?: {
    label?: string;
    label_en?: string;
  };
  amenities: Array<{
    type: string;
    distance: number;
  }>;
  price?: number;
  size?: number;
}

export async function generatePlotDescription(input: PlotDescriptionInput): Promise<string> {
  const { location, zoning, amenities, price, size } = input;

  // Build context for the LLM
  const locationText = location.address || location.municipality || 'this location';
  const zoningText = zoning?.label_en || zoning?.label || '';
  const nearbyText = amenities
    .slice(0, 3)
    .map(a => `${a.type} (${Math.round(a.distance)}m)`)
    .join(', ');

  const prompt = `Generate a compelling 25-word maximum sales pitch for a land plot with these details:

Location: ${locationText}
${zoningText ? `Zoning: ${zoningText}` : ''}
${price ? `Price: €${price.toLocaleString()}` : ''}
${size ? `Size: ${size}m²` : ''}
${nearbyText ? `Nearby: ${nearbyText}` : ''}

Requirements:
- Maximum 25 words
- Focus on location highlights and development potential
- Use persuasive, professional tone
- Start with a strong descriptor
- NO generic phrases like "stunning views" unless specifically supported by data

Description:`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a real estate copywriter specializing in concise, compelling property descriptions. Generate exactly what is requested, nothing more.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    const description = completion.choices[0]?.message?.content?.trim() || 
      `Prime land plot in ${locationText}. Ideal for development.`;

    return description;
  } catch (error) {
    console.error('Error generating plot description:', error);
    // Fallback to simple description
    return `Prime land plot in ${locationText}${zoningText ? ` zoned for ${zoningText.toLowerCase()}` : ''}.`;
  }
}
