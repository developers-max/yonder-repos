/**
 * SmartLead Campaign Manager
 * 
 * This module handles creating and managing SmartLead campaigns per plot ID.
 * Each plot gets its own campaign to ensure realtors can receive one email per plot.
 */

import { z } from "zod";

// Helper functions to get environment variables at runtime
function getApiKey(): string {
  const key = process.env.SMARTLEAD_API_KEY;
  if (!key) {
    throw new Error('SMARTLEAD_API_KEY environment variable is not set');
  }
  return key;
}

function getBaseUrl(): string {
  return process.env.SMARTLEAD_BASE_URL || "https://server.smartlead.ai/api/v1";
}

// Campaign creation response schema
const campaignResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  // Add other fields as needed based on SmartLead response
});

// Campaign schedule configuration
interface CampaignSchedule {
  days_of_the_week: number[]; // 0-6, where 0 is Sunday
  start_hour: string; // Format: "09:00"
  end_hour: string; // Format: "17:00"
  timezone: string; // e.g., "America/New_York"
  min_time_btw_emails: number; // Minutes between emails
  max_new_leads_per_day?: number;
}

// Custom field value type for SmartLead
type CustomFieldValue = string | number | boolean | null | undefined;

// Email sequence variant structure
export interface SequenceVariant {
  id?: number; // Only for updates
  subject: string;
  email_body: string;
  variant_label: string; // "A", "B", "C", etc.
}

// Email sequence structure
export interface EmailSequence {
  id?: number; // Only for updates
  seq_number: number; // 1, 2, 3, etc.
  seq_delay_details: {
    delay_in_days: number; // 0 for first email, 2-3 for follow-ups
  };
  subject?: string; // Blank makes follow-up in same thread
  email_body?: string; // For single variant sequences
  seq_variants?: SequenceVariant[]; // For A/B testing
}

// Lead structure for SmartLead
export interface SmartLeadLead {
  first_name: string;
  last_name: string;
  email: string;
  custom_fields: Record<string, CustomFieldValue>;
}

/**
 * Creates a new SmartLead campaign for a specific plot
 * @param plotId - The unique identifier for the plot
 * @param campaignName - Optional custom name for the campaign
 * @returns Campaign ID
 */
export async function createPlotCampaign(
  plotId: string,
  campaignName?: string
): Promise<number> {
  const name = campaignName || `Plot ${plotId} - Realtor Outreach`;
  
  try {
    const response = await fetch(
      `${getBaseUrl()}/campaigns/create?api_key=${getApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          client_id: null, // Set to null unless you have specific client management
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create campaign: ${response.status} - ${text}`);
    }

    const data = await response.json();
    const result = campaignResponseSchema.parse(data);
    
    return result.id;
  } catch (error) {
    console.error(`Error creating campaign for plot ${plotId}:`, error);
    throw error;
  }
}

/**
 * Gets an existing campaign ID for a plot or creates a new one
 * Checks if the campaign exists in SmartLead before creating
 * @param plotId - The unique identifier for the plot
 * @param existingCampaignId - Optional campaign ID from database to verify
 * @returns Campaign ID
 */
export async function getOrCreatePlotCampaign(
  plotId: string,
  existingCampaignId?: number
): Promise<number> {
  // If we have an existing campaign ID, verify it still exists in SmartLead
  if (existingCampaignId) {
    try {
      await getCampaignById(existingCampaignId);
      console.log(`Campaign ${existingCampaignId} verified in SmartLead, reusing for plot ${plotId}`);
      return existingCampaignId;
    } catch (error) {
      console.log(`Campaign ${existingCampaignId} no longer exists in SmartLead, creating new one for plot ${plotId}`);
      // Campaign doesn't exist in SmartLead anymore, create a new one
    }
  }
  
  // Create new campaign
  return await createPlotCampaign(plotId);
}

/**
 * Sets the schedule for a campaign
 * @param campaignId - The SmartLead campaign ID
 * @param schedule - Schedule configuration
 */
export async function setCampaignSchedule(
  campaignId: number,
  schedule: CampaignSchedule
): Promise<void> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/campaigns/${campaignId}/schedule?api_key=${getApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to set campaign schedule: ${response.status} - ${text}`);
    }
  } catch (error) {
    console.error(`Error setting schedule for campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Email account structure from SmartLead
 */
export interface EmailAccount {
  id: number;
  from_name: string;
  from_email: string;
  username: string;
  smtp_host: string;
  smtp_port: number;
  warmup_enabled: boolean;
  total_warmup_per_day: number;
  daily_max_sending_limit: number;
  email_provider: string;
  created_at: string;
}

/**
 * Fetches all email accounts (sender accounts) for the user
 * @returns Array of email accounts
 */
export async function getAllEmailAccounts(): Promise<EmailAccount[]> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/email-accounts?api_key=${getApiKey()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch email accounts: ${response.status} - ${text}`);
    }

    const data = await response.json();
    console.log('SmartLead email accounts response:', JSON.stringify(data).substring(0, 500));
    
    // Try different possible response formats
    const accounts = data.emailAccounts || data.email_accounts || data.accounts || data.data || data;
    
    // If it's an array, return it; otherwise try to extract array from object
    if (Array.isArray(accounts)) {
      console.log(`Found ${accounts.length} email accounts`);
      return accounts;
    }
    
    console.log('Email accounts response is not an array:', typeof accounts);
    return [];
  } catch (error) {
    console.error("Error fetching email accounts:", error);
    throw error;
  }
}

/**
 * Adds email accounts (sender accounts) to a campaign
 * @param campaignId - The SmartLead campaign ID
 * @param emailAccountIds - Array of email account IDs to add (if empty, adds all available accounts)
 */
export async function addEmailAccountsToCampaign(
  campaignId: number,
  emailAccountIds?: number[]
): Promise<void> {
  try {
    // If no specific IDs provided, fetch all available accounts
    let accountIds = emailAccountIds;
    if (!accountIds || accountIds.length === 0) {
      const allAccounts = await getAllEmailAccounts();
      
      // Try to use warmed-up accounts first, but fallback to all accounts if none are warmed up
      let warmedAccounts = allAccounts.filter(account => account.warmup_enabled === true);
      
      // If no warmed accounts, use all available accounts
      if (warmedAccounts.length === 0) {
        console.log('No warmed-up accounts found, using all available accounts');
        warmedAccounts = allAccounts;
      } else {
        console.log(`Using ${warmedAccounts.length} warmed-up accounts out of ${allAccounts.length} total`);
      }
      
      accountIds = warmedAccounts.map(account => account.id);
      
      if (accountIds.length === 0) {
        throw new Error("No email accounts available. Please connect email accounts in SmartLead first.");
      }
      
      console.log(`Using ${accountIds.length} sender account(s) for campaign`);
    }

    // Add each account to the campaign
    for (const accountId of accountIds) {
      try {
        const response = await fetch(
          `${getBaseUrl()}/campaigns/${campaignId}/email-accounts?api_key=${getApiKey()}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email_account_ids: [accountId], // API expects array
            }),
          }
        );

        if (!response.ok) {
          const text = await response.text();
          console.warn(`Failed to add email account ${accountId}: ${text}`);
          // Continue with other accounts even if one fails
        } else {
          console.log(`Added email account ${accountId} to campaign ${campaignId}`);
        }
      } catch (error) {
        console.warn(`Error adding email account ${accountId}:`, error);
        // Continue with other accounts
      }
    }
    
    console.log(`Successfully configured ${accountIds.length} sender account(s) for campaign ${campaignId}`);
  } catch (error) {
    console.error(`Error adding email accounts to campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Saves email sequences to a campaign
 * @param campaignId - The SmartLead campaign ID
 * @param sequences - Array of email sequences to add
 */
export async function saveEmailSequences(
  campaignId: number,
  sequences: EmailSequence[]
): Promise<void> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/campaigns/${campaignId}/sequences?api_key=${getApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequences }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to save email sequences: ${response.status} - ${text}`);
    }
    
    console.log(`Saved ${sequences.length} email sequence(s) to campaign ${campaignId}`);
  } catch (error) {
    console.error(`Error saving sequences for campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Adds leads to a campaign in batches
 * @param campaignId - The SmartLead campaign ID
 * @param leads - Array of leads to add
 * @param batchSize - Number of leads per batch (default: 100)
 */
export async function addLeadsToCampaign(
  campaignId: number,
  leads: SmartLeadLead[],
  batchSize: number = 100
): Promise<void> {
  const chunks = chunkArray(leads, batchSize);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    try {
      const response = await fetch(
        `${getBaseUrl()}/campaigns/${campaignId}/leads?api_key=${getApiKey()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_list: chunk,
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to add leads to campaign: ${response.status} - ${text}`);
      }

      // Throttle requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await sleep(250);
      }
    } catch (error) {
      console.error(`Error adding leads batch ${i + 1} to campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

// Campaign response type from SmartLead API
interface CampaignDetails {
  id: number;
  name: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Gets campaign details by ID
 * @param campaignId - The SmartLead campaign ID
 */
export async function getCampaignById(campaignId: number): Promise<CampaignDetails> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/campaigns/${campaignId}?api_key=${getApiKey()}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to get campaign: ${response.status} - ${text}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error getting campaign ${campaignId}:`, error);
    throw error;
  }
}

/**
 * Updates campaign status (START, PAUSED, STOPPED)
 * @param campaignId - The SmartLead campaign ID
 * @param status - New status (START to activate, PAUSED to pause, STOPPED to stop)
 */
export async function updateCampaignStatus(
  campaignId: number,
  status: 'START' | 'PAUSED' | 'STOPPED'
): Promise<void> {
  try {
    const response = await fetch(
      `${getBaseUrl()}/campaigns/${campaignId}/status?api_key=${getApiKey()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to update campaign status: ${response.status} - ${text}`);
    }
    
    console.log(`Campaign ${campaignId} status updated to ${status}`);
  } catch (error) {
    console.error(`Error updating campaign ${campaignId} status:`, error);
    throw error;
  }
}

/**
 * Process a plot listing: creates campaign and adds leads
 * This is the main workflow function
 * @param plotId - The plot identifier
 * @param plotData - Plot information for custom fields
 * @param leads - Array of leads (realtors) to contact
 * @param schedule - Optional schedule configuration
 * @param existingCampaignId - Optional existing campaign ID from database to verify and reuse
 */
export async function processPlotOutreach(
  plotId: string,
  plotData: {
    address?: string;
    url?: string;
    price?: string;
  } & Record<string, unknown>,
  leads: Array<{
    firstName: string;
    lastName: string;
    email: string;
    customFields?: Record<string, CustomFieldValue>;
  }>,
  schedule?: CampaignSchedule,
  existingCampaignId?: number
): Promise<{ campaignId: number; leadsAdded: number }> {
  try {
    // Create or get campaign for this plot (verifies campaign exists in SmartLead if ID provided)
    const campaignId = await getOrCreatePlotCampaign(plotId, existingCampaignId);
    const isNewCampaign = campaignId !== existingCampaignId;
    
    // Only configure campaign settings if this is a NEW campaign
    // Existing campaigns already have schedule, sequences, and sender accounts configured
    if (isNewCampaign) {
      console.log(`Configuring new campaign ${campaignId}`);
      
      // Set schedule if provided
      if (schedule) {
        await setCampaignSchedule(campaignId, schedule);
      }
      
      // Create default email sequence if leads have email content
      const firstLead = leads[0];
      if (firstLead?.customFields?.subject && firstLead?.customFields?.body) {
        const emailSequences: EmailSequence[] = [
          {
            seq_number: 1,
            seq_delay_details: {
              delay_in_days: 0  // No delay for first email
            },
            seq_variants: [
              {
                variant_label: "A",
                subject: String(firstLead.customFields.subject || ""),
                email_body: String(firstLead.customFields.body || ""),
              },
            ],
          },
        ];
        
        await saveEmailSequences(campaignId, emailSequences);
        console.log(`Added initial email sequence to campaign ${campaignId}`);
      }
      
      // Add all available sender accounts to the campaign
      await addEmailAccountsToCampaign(campaignId);
    } else {
      console.log(`Reusing existing campaign ${campaignId} - skipping schedule, sequences, and sender account configuration`);
    }
    
    // Prepare leads with plot-specific custom fields
    const smartLeadLeads: SmartLeadLead[] = leads.map(lead => {
      // Convert plotData to custom field values
      const plotCustomFields = Object.entries(plotData).reduce<Record<string, CustomFieldValue>>((acc, [key, value]) => {
        // Only include values that are valid custom field types
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      // Filter out subject and body from customFields - they're only for sequence creation
      const leadCustomFields = lead.customFields ? 
        Object.entries(lead.customFields).reduce<Record<string, CustomFieldValue>>((acc, [key, value]) => {
          if (key !== 'subject' && key !== 'body') {
            acc[key] = value;
          }
          return acc;
        }, {}) : {};

      return {
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        custom_fields: {
          plot_id: plotId,
          plot_address: plotData.address,
          plot_url: plotData.url,
          plot_price: plotData.price,
          ...plotCustomFields, // Include all other plot data (filtered)
          ...leadCustomFields, // Include lead-specific custom fields (excluding subject/body)
        },
      };
    });
    
    // Add leads to campaign
    await addLeadsToCampaign(campaignId, smartLeadLeads);
    
    // Only start NEW campaigns - existing campaigns are already running
    if (isNewCampaign) {
      await updateCampaignStatus(campaignId, 'START');
      console.log(`Campaign ${campaignId} started and ready to send during scheduled hours`);
    } else {
      console.log(`Added ${smartLeadLeads.length} new lead(s) to existing active campaign ${campaignId}`);
    }
    
    return {
      campaignId,
      leadsAdded: smartLeadLeads.length,
    };
  } catch (error) {
    console.error(`Error processing plot outreach for plot ${plotId}:`, error);
    throw error;
  }
}

/**
 * Utility function to chunk an array into smaller arrays
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Utility function to sleep/delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default schedule configuration for realtor outreach
 * Sends emails Monday-Friday, 9 AM - 5 PM EST
 */
export const DEFAULT_REALTOR_SCHEDULE: CampaignSchedule = {
  days_of_the_week: [1, 2, 3, 4, 5], // Monday to Friday
  start_hour: "09:00",
  end_hour: "17:00",
  timezone: "America/New_York",
  min_time_btw_emails: 60, // 1 hour between emails
  max_new_leads_per_day: 50,
};
