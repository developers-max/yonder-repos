import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySession } from "@/lib/dal/authDal";

const payloadSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  // Any custom variables you reference in your SmartLead email copy, e.g. {{icebreaker}}
  variables: z.record(z.string(), z.any()).optional(),
  // If you want to override the default campaign
  campaignId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // Verify authentication using DAL pattern
    await verifySession();
    
    const body = await req.json();
    const data = payloadSchema.parse(body);

    const apiKey = process.env.SMARTLEAD_API_KEY!;
    const baseUrl = process.env.SMARTLEAD_BASE_URL || "https://server.smartlead.ai/api/v1";
    const campaignId = data.campaignId || process.env.SMARTLEAD_CAMPAIGN_ID!;
    if (!apiKey || !campaignId) {
      return NextResponse.json(
        { error: "Missing SMARTLEAD_API_KEY or SMARTLEAD_CAMPAIGN_ID" },
        { status: 500 }
      );
    }

    // SmartLead: Add leads to a campaign endpoint
    // POST /campaigns/{campaign_id}/leads
    // Docs: https://api.smartlead.ai/reference/add-leads-to-a-campaign-by-id
    const res = await fetch(`${baseUrl}/campaigns/${campaignId}/leads?api_key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Schema: SmartLead expects a list under `lead_list`; include optional custom variables
      body: JSON.stringify({
        lead_list: [
          {
            email: "antonis@typesystem.xyz", // Hardcoded for testing purposes
            first_name: data.firstName || "Antonis",
            last_name: data.lastName || "Antonis",
            // Custom variables used by your SmartLead sequence, e.g. {{plot_url}}, {{subject}}, {{body}}
            custom_fields: data.variables ?? {},
          },
        ],
      }),
      // You can set a timeout via AbortController if you like
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "SmartLead API error", status: res.status, detail: text },
        { status: 502 }
      );
    }

    const json = await res.json();
    return NextResponse.json({ ok: true, smartlead: json });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    
    // Handle auth errors
    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 });
    }
    
    return NextResponse.json({ error: message }, { status: 400 });
  }
}