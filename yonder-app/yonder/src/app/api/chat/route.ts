import { openai } from '@ai-sdk/openai';
import { streamText, appendResponseMessages, smoothStream } from 'ai';
import { searchPlotsTool } from '../../../lib/ai/tools/search-plots';
import { initiateOutreachTool } from '../../../lib/ai/tools/initiate-outreach';
import { getPlotDetailsTool } from '../../../lib/ai/tools/get-plot-details';
import { setSelectedPlotTool } from '../../../lib/ai/tools/set-selected-plot';
import { updateProgressTool } from '../../../lib/ai/tools/update-progress';
import { getNextStepTool } from '../../../lib/ai/tools/get-next-step';
import { getProjectProgressTool } from '../../../lib/ai/tools/get-project-progress';
import { getAcquisitionStepsTool } from '../../../lib/ai/tools/get-acquisition-steps';
import { getProjectContextTool } from '../../../lib/ai/tools/get-project-context';
import { generateReportTool } from '../../../lib/ai/tools/generate-report';
import { askMunicipalPlanningTool } from '../../../lib/ai/tools/ask-municipal-planning';
import { getLayerInfoTool } from '../../../lib/ai/tools/get-layer-info';
import { navigateToLocationTool } from '../../../lib/ai/tools/navigate-to-location';
import { setToolContext, type PlotContextData, type GeoJSONPolygon } from '../../../lib/ai/tools/tool-context';
import { auth } from '@/lib/auth/auth';
import { headers } from 'next/headers';
import { appRouter } from '@/server/trpc';
import { db } from '@/lib/db';
import { usersTable } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: Request) {
  try {
    const { messages, chatId, plotId, droppedPinCoords } = await req.json();

    // Get user session for authentication
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check user's remaining chat queries
    const [user] = await db
      .select({ remainingChatQueries: usersTable.remainingChatQueries })
      .from(usersTable)
      .where(eq(usersTable.id, session.user.id))
      .limit(1);

    if (!user || user.remainingChatQueries <= 0) {
      return new Response(JSON.stringify({ 
        error: 'Chat query limit reached',
        message: 'You have reached your chat query limit. Please contact an administrator.'
      }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Decrement chat queries count
    await db
      .update(usersTable)
      .set({ 
        remainingChatQueries: sql`${usersTable.remainingChatQueries} - 1`
      })
      .where(eq(usersTable.id, session.user.id));

    // Check if user is admin (for restricted tools)
    const isAdmin = user.remainingChatQueries !== undefined && 
      await db
        .select({ role: usersTable.role })
        .from(usersTable)
        .where(eq(usersTable.id, session.user.id))
        .limit(1)
        .then(rows => rows[0]?.role === 'admin');

    // Create tRPC caller for saving messages
    const caller = appRouter.createCaller({
      session,
      user: session.user,
    });

    // Get organization ID if chat exists
    let organizationId: string | undefined;
    
    // Validate chat exists if chatId is provided
    if (chatId) {
      try {
        const chat = await caller.chat.getChat({ chatId });
        organizationId = chat.organization?.id;
      } catch {
        return new Response('Chat not found', { status: 404 });
      }
    }

    // Fetch plot data if plotId is provided - makes full context available to all tools
    let plotData: PlotContextData | undefined;
    if (plotId) {
      try {
        const plot = await caller.plots.getPlot({ id: plotId });
        const enrichmentData = plot.enrichmentData as Record<string, unknown> | null;
        
        // Extract polygon from cadastral data if available
        const cadastralData = enrichmentData?.cadastral as Record<string, unknown> | undefined;
        const cadastralPolygon = cadastralData?.polygon as GeoJSONPolygon | undefined;
        
        // Extract municipality info
        const municipality = plot.municipality as { id: number; name: string; countryCode?: string } | undefined;
        
        // Extract listing coordinates (less accurate)
        const listingLat = typeof plot.latitude === 'string' ? parseFloat(plot.latitude) : Number(plot.latitude);
        const listingLng = typeof plot.longitude === 'string' ? parseFloat(plot.longitude) : Number(plot.longitude);
        
        // Extract real/accurate coordinates if available (from enrichment)
        const plotWithReal = plot as { real_latitude?: number | string | null; real_longitude?: number | string | null };
        const realLat = plotWithReal.real_latitude != null 
          ? (typeof plotWithReal.real_latitude === 'string' ? parseFloat(plotWithReal.real_latitude) : Number(plotWithReal.real_latitude))
          : undefined;
        const realLng = plotWithReal.real_longitude != null 
          ? (typeof plotWithReal.real_longitude === 'string' ? parseFloat(plotWithReal.real_longitude) : Number(plotWithReal.real_longitude))
          : undefined;
        
        // Check if we have valid accurate coordinates
        const hasAccurateCoordinates = realLat !== undefined && realLng !== undefined && 
          !isNaN(realLat) && !isNaN(realLng);
        
        plotData = {
          id: String(plot.id),
          latitude: listingLat,
          longitude: listingLng,
          realLatitude: hasAccurateCoordinates ? realLat : undefined,
          realLongitude: hasAccurateCoordinates ? realLng : undefined,
          hasAccurateCoordinates,
          price: Number(plot.price),
          size: plot.size ? Number(plot.size) : null,
          images: Array.isArray(plot.images) ? (plot.images as string[]) : [],
          listingTitle: (plot as { title?: string }).title,
          listingDescription: (plot as { description?: string }).description,
          polygon: cadastralPolygon,
          enrichmentData: enrichmentData || undefined,
          municipality: municipality ? {
            id: municipality.id,
            name: municipality.name,
            countryCode: municipality.countryCode,
          } : undefined,
        };
      } catch (error) {
        console.warn('[chat] Failed to fetch plot data for context:', error);
        // Continue without plot data - tools will fetch as needed
      }
    }

    // Set global context for tools that need authentication
    setToolContext({ session, user: session.user, chatId, organizationId, plotId, plotData, droppedPinCoords });

    // Build simplified system prompt - context and steps now available via tools
    const systemPrompt = `You are an expert on Portugal real estate with a specialization in finding plots of land for sale throughout Portugal. 

You have extensive knowledge about:
- Portuguese land regulations and zoning laws
- Regional differences in land prices across Portugal
- Popular areas for investment and development
- Rural vs urban plot considerations
- Legal requirements for foreign buyers
- Construction permits and building restrictions
- Agricultural land classifications
- Coastal and inland property markets

You can help users understand plot characteristics, pricing trends, legal considerations, and provide guidance on finding the right land for their needs. You're knowledgeable about all regions of Portugal from the Algarve to the north, including islands like Madeira and the Azores.

You have access to specialized tools for helping users find and contact realtors about plots:

1. **searchPlots**: Use when users want to find, browse, view, or select plots for their project. Opens the plot selection panel. Use for queries like "find plots", "search near Lisbon", "I want to select plots", "show me land". Configures filters for location, price, size, amenities, zoning.

2. **initiateOutreach**: ONLY use when users explicitly want to contact, reach out to, or email realtors. Opens the realtor outreach dialog. Use for queries like "contact realtors", "reach out about plots", "email agents". Do NOT use for general plot browsing or selection.

3. **getPlotDetails**: Use when plot context is available or when users ask about a specific plot by ID. Returns detailed information about a specific plot including price, size, location, and enrichment data.

4. **setSelectedPlot**: Use when users want to focus on a specific plot for their project. This sets a plot as the "selected plot" for the current conversation, creating a project if needed and making this plot the primary focus.

5. **updateProgress**: Use when users indicate they have completed an acquisition milestone or step. Examples: "I got my NIF number", "We signed the CPCV", "Construction permits were approved". This tool detects progress and creates an interactive component for users to confirm and update their project status.

6. **getNextStep**: Use when users ask about next steps, want details about a specific process step, or need guidance on what to do. Examples: "What's my next step?", "Tell me about the NIF process", "What do I need for legal checks?". Returns detailed step information with partner contact if available.

7. **getProjectProgress**: Use when users ask about their overall progress, want to see a checklist, or when you detect milestone completion. Examples: "How am I doing?", "Show me my progress", "What have I completed?". Returns project ID for frontend to generate interactive progress checklist.

8. **getProjectContext**: Use when you need to understand the user's current project status, selected plots, or progress to provide personalized advice. This replaces having project context in the prompt.

9. **getAcquisitionSteps**: Use when you need to explain the Portugal land acquisition process, reference specific steps, or provide workflow information. This gives you the complete step-by-step process.

${isAdmin ? `10. **generateReport**: Use when users want to generate a comprehensive property report for a specific plot. Examples: "Generate a report for this plot", "Create a property report", "I need documentation for this land". This creates an interactive component with a download button for the AI-powered report.

11.` : `10.`} **askMunicipalPlanning**: Use when users ask questions about planning and building regulations, zoning laws, building restrictions, or urban development rules for a specific plot or municipality. Examples: "What are the zoning regulations?", "What are building height restrictions for this plot?", "Tell me about construction permits", "What are the land use regulations?". This tool queries official municipal planning documents (PDM/POUM) and returns authoritative answers with source citations. **IMPORTANT**: First call getPlotDetails to get the municipality info, then use the municipality.id and municipality.countryCode from that response as parameters.

${isAdmin ? `12.` : `11.`} **getLayerInfo**: Use when users ask about geographic or regulatory layer data for a plot or location. Examples: "What zone is this plot in?", "Is this land protected?", "Is there REN/RAN on this plot?", "What's the land use classification?", "Show cadastral information", "What municipality is this in?". Returns data from cadastre, REN (ecological reserve), RAN (agricultural reserve), municipality, parish, district, NUTS III, land use (COS), Corine Land Cover, built-up areas, and elevation. Automatically uses plot context when available (coordinates and polygon geometry), or accepts explicit coordinates.

${isAdmin ? `13.` : `12.`} **navigateToLocation**: Use when users provide specific coordinates and want to navigate the map to that location. Examples: "Go to 41.7400, -8.8080", "Show me coordinates 38.7223, -9.1393", "Navigate to latitude 41.1579, longitude -8.6291". This moves the map view to the specified coordinates.

TOOL RESPONSE STRUCTURE: All tools return a standardized structure:
- **filters**: The search criteria that will be applied
- **summary**: A human-readable description of the filters
- **suggestions**: Contextual guidance with message, recommended actions, and priority level

IMPORTANT: When using any tools, ALWAYS provide explanatory text alongside the tool call. For example:
- Before/during: "I'll search for plots matching your criteria..." or "Let me set up outreach for those plots..." or "Let me get details about this plot..."
- After getting results: "I found matching plots..." or "I've prepared outreach for plots matching your requirements..." or "Looking at this plot in detail..."

USING TOOL SUGGESTIONS: When you receive tool results, ALWAYS incorporate the suggestions naturally:
1. Include the suggestion message in your response
2. Use the recommended actions to guide your advice:
   - "add_location": Suggest specific regions in Portugal
   - "refine_filters": Recommend adding more specific criteria
   - "relax_filters": Suggest expanding criteria if search is too narrow
   - "initiate_outreach": Encourage contacting realtors

Never make silent tool calls - always explain what you're doing and what the results mean.

Be helpful, informative, and always encourage users to verify legal and financial information with qualified Portuguese real estate professionals and lawyers.

${plotId ? `
PLOT CONTEXT AVAILABLE: The user is currently viewing a specific plot (ID: ${plotId}). Use the getPlotDetails tool to fetch information about this plot and provide contextual, specific advice about it. Assume they want to discuss this particular plot unless they explicitly mention searching for other plots.
` : ''}
${droppedPinCoords ? `
DROPPED PIN COORDINATES: The user has dropped a pin on the map at coordinates: latitude ${droppedPinCoords.latitude}, longitude ${droppedPinCoords.longitude}. When the user refers to "the pin", "this location", "these coordinates", "the dropped pin", or similar phrases, use these coordinates. You can use these coordinates with tools like getLayerInfo, searchPlots (as location center), askMunicipalPlanning, or navigateToLocation.
` : ''}`;

    const result = streamText({
      model: openai('gpt-5-mini'),
      messages,
      system: systemPrompt,
      temperature: 1, // GPT-5 models only support temperature: 1
      maxSteps: 5, // Enable multi-step tool calling
      toolCallStreaming: true,
      experimental_transform: smoothStream({
        delayInMs: 10,
        chunking: 'word',
      }),
      tools: {
        searchPlots: searchPlotsTool,
        initiateOutreach: initiateOutreachTool,
        getPlotDetails: getPlotDetailsTool,
        setSelectedPlot: setSelectedPlotTool,
        updateProgress: updateProgressTool,
        getNextStep: getNextStepTool,
        getProjectProgress: getProjectProgressTool,
        getProjectContext: getProjectContextTool,
        getAcquisitionSteps: getAcquisitionStepsTool,
        // generateReport is admin-only
        ...(isAdmin ? { generateReport: generateReportTool } : {}),
        askMunicipalPlanning: askMunicipalPlanningTool,
        getLayerInfo: getLayerInfoTool,
        navigateToLocation: navigateToLocationTool
      },
      async onFinish({ response }) {
        // Only save messages if chatId is provided
        if (chatId) {
          try {
            // Use appendResponseMessages to get the correct structure
            const finalMessages = appendResponseMessages({
              messages,
              responseMessages: response.messages,
            });

            // Save the complete conversation to database
            await caller.chat.saveMessages({
              chatId,
              messages: finalMessages,
            });
          } catch (error) {
            console.error('Failed to save messages:', error);
          }
        }
      },
      onError: (error) => {
        console.error('Chat API error:', error);
      }
    });

    return result.toDataStreamResponse({
      sendReasoning: true
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 