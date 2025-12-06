import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal/authDal";
import { processPlotOutreach, DEFAULT_REALTOR_SCHEDULE } from "../lib/campaign-manager";
import { db } from "@/lib/db";
import { plotCampaignsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const payloadSchema = z.object({
  plotId: z.string(),
  plotData: z.object({
    address: z.string().optional(),
    url: z.string().optional(),
    price: z.string().optional(),
  }).passthrough(), // Allow additional fields
  leads: z.array(z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    customFields: z.record(z.string(), z.any()).optional(),
  })),
  useSchedule: z.boolean().optional().default(true),
  organizationId: z.string(),
});

/**
 * POST /api/smartlead/send-per-plot
 * 
 * Sends emails to realtors using a dedicated campaign per plot.
 * This ensures each realtor can receive one email per plot ID.
 * 
 * If a campaign already exists for the plot, it reuses that campaign.
 * Otherwise, it creates a new campaign.
 */
export async function POST(req: Request) {
  try {
    // Verify authentication using DAL pattern
    await verifySession();
    
    const body = await req.json();
    const data = payloadSchema.parse(body);

    const apiKey = process.env.SMARTLEAD_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing SMARTLEAD_API_KEY" },
        { status: 500 }
      );
    }

    // Check if we already have a campaign for this plot
    let campaignId: number | null = null;
    
    try {
      const existingCampaign = await db.query.plotCampaignsTable.findFirst({
        where: eq(plotCampaignsTable.plotId, data.plotId),
      });
      
      if (existingCampaign) {
        campaignId = existingCampaign.campaignId;
        console.log(`Reusing existing campaign ${campaignId} for plot ${data.plotId}`);
      }
    } catch (dbError) {
      console.error("Error checking for existing campaign:", dbError);
      // Continue without reusing - will create new campaign
    }

    // Check for test email override via environment variable
    const testEmailRecipient = process.env.TEST_EMAIL_RECIPIENT;
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const useTestEmail = testEmailRecipient && isValidEmail(testEmailRecipient);
    
    if (useTestEmail) {
      console.log(`Using test email recipient: ${testEmailRecipient}`);
    }

    // Process leads with optional test email override
    const processedLeads = data.leads.map(lead => ({
      ...lead,
      email: useTestEmail ? testEmailRecipient : lead.email,
      customFields: {
        ...lead.customFields,
        subject: lead.customFields?.subject,
        body: lead.customFields?.body,
      },
    }));

    // Process the plot outreach (verifies existing campaign in SmartLead or creates new one)
    const result = await processPlotOutreach(
      data.plotId,
      data.plotData,
      processedLeads,
      data.useSchedule ? DEFAULT_REALTOR_SCHEDULE : undefined,
      campaignId ?? undefined // Pass existing campaign ID to verify it still exists in SmartLead
    );

    // Store the campaign ID in the database for future reference
    // If campaign ID changed (new one was created because old one didn't exist), update database
    if (!campaignId || campaignId !== result.campaignId) {
      try {
        if (campaignId) {
          // Update existing record with new campaign ID
          await db
            .update(plotCampaignsTable)
            .set({
              campaignId: result.campaignId,
              updatedAt: new Date(),
            })
            .where(eq(plotCampaignsTable.plotId, data.plotId));
          console.log(`Updated campaign ID to ${result.campaignId} for plot ${data.plotId} (old campaign no longer exists in SmartLead)`);
        } else {
          // Insert new record
          await db.insert(plotCampaignsTable).values({
            plotId: data.plotId,
            campaignId: result.campaignId,
            organizationId: data.organizationId,
            campaignName: `Plot ${data.plotId} - Realtor Outreach`,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          console.log(`Stored new campaign ${result.campaignId} for plot ${data.plotId}`);
        }
      } catch (dbError) {
        console.error("Error storing campaign mapping:", dbError);
        // Non-critical error - campaign was created successfully
      }
    }

    return NextResponse.json({
      ok: true,
      campaignId: result.campaignId,
      leadsAdded: result.leadsAdded,
      plotId: data.plotId,
      message: `Successfully added ${result.leadsAdded} leads to campaign ${result.campaignId}`,
    });
  } catch (err: unknown) {
    console.error("Error in send-per-plot route:", err);
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    
    // Handle auth errors
    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
