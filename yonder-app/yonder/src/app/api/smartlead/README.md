# SmartLead Integration

This directory contains the SmartLead API integration for realtor outreach campaigns.

## Overview

The system creates **one campaign per plot ID** to ensure that each realtor can receive exactly one email per plot. This prevents duplicate outreach and provides better campaign tracking.

## Architecture

### Files Structure

```
smartlead/
├── lib/
│   └── campaign-manager.ts     # Core campaign management functions
├── templates/
│   └── realtor-outreach.ts     # Email templates
├── send/
│   └── route.ts                # Legacy single-email endpoint
├── send-per-plot/
│   └── route.ts                # New per-plot campaign endpoint
└── README.md                   # This file
```

### Database Schema

The system uses a `plot_campaigns` table to track campaign IDs per plot:

```sql
CREATE TABLE plot_campaigns (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL UNIQUE,
  campaign_id INTEGER NOT NULL,
  organization_id TEXT NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## How It Works

### 1. Campaign Creation Per Plot

When sending outreach emails:

1. **Check for Existing Campaign**: The system first checks if a campaign already exists for the plot ID
2. **Create New Campaign**: If no campaign exists, it creates a new SmartLead campaign named "Plot {plotId} - Realtor Outreach"
3. **Configure Schedule**: Sets the sending schedule (Mon-Fri, 9 AM-5 PM EST)
4. **⚠️ CRITICAL: Add Email Sequences**: Creates email sequences with the actual email content (subject + body)
5. **Add Leads**: Adds realtors to the campaign with custom fields
6. **Store Mapping**: The campaign ID is stored in the database mapped to the plot ID
7. **Reuse Campaign**: Future outreach for the same plot reuses the existing campaign

**Important**: A campaign without email sequences is like a container without content - no emails will be sent!

### 2. Lead Management

All realtors for a plot are added to the same campaign:

```typescript
{
  plotId: "abc-123",
  leads: [
    {
      email: "realtor1@example.com",
      firstName: "John",
      lastName: "Doe",
      customFields: {
        subject: "Inquiry about your land listing",
        body: "Hi {{first_name}}...",
        plot_url: "https[colon]//app.yonder.com/plot/abc-123"
      }
    },
    // ... more realtors
  ]
}
```

### 3. Email Sequences

**What are Email Sequences?**

Email sequences are the actual email content that SmartLead will send. Each sequence represents one email in your outreach flow:
- **Sequence 1**: Initial outreach email
- **Sequence 2**: First follow-up (sent X days later if no response)
- **Sequence 3**: Second follow-up (sent Y days after sequence 2)
- And so on...

**How to Configure Sequences:**

```typescript
const sequences: EmailSequence[] = [
  {
    seq_number: 1,  // First email
    seq_variants: [  // Can have multiple variants for A/B testing
      {
        variant_label: "A",
        subject: "Inquiry about your land listing",
        email_body: "Hi {{first_name}}, I noticed your listing..."
      }
    ]
  },
  {
    seq_number: 2,  // Follow-up email
    seq_delay_details: {
      delay_in_days: 3  // Send 3 days after sequence 1
    },
    subject: "",  // Empty subject = reply in same thread
    email_body: "Just following up on my previous email..."
  }
];

await saveEmailSequences(campaignId, sequences);
```

**Best Practices:**
- Always include at least one sequence (the initial email)
- Use blank subject for follow-ups to keep them in the same email thread
- Add 2-3 day delays between follow-ups
- Keep sequences 2-4 emails total for best results

### 4. Email Variables

The email template supports the following variables:

- `{{first_name}}` - Realtor's first name
- `{{last_name}}` - Realtor's last name  
- `{{plot_url}}` - URL to the plot (formatted to avoid spam filters)
- `{{subject}}` - Email subject line
- `{{body}}` - Email body content

## API Endpoints

### POST /api/smartlead/send-per-plot

**New recommended endpoint** - Creates/reuses campaigns per plot.

**Request Body:**
```typescript
{
  plotId: string;
  organizationId: string;
  plotData: {
    url?: string;
    address?: string;
    price?: string;
    // ... other plot data
  };
  leads: Array<{
    email: string;
    firstName: string;
    lastName: string;
    customFields?: Record<string, any>;
  }>;
  useSchedule?: boolean; // Default: true
}
```

**Response:**
```typescript
{
  ok: true;
  campaignId: number;
  leadsAdded: number;
  plotId: string;
  message: string;
}
```

### POST /api/smartlead/send

**Legacy endpoint** - Sends emails to a single recipient. Still functional but doesn't create per-plot campaigns.

## Campaign Scheduling

By default, campaigns use the following schedule:

- **Days**: Monday - Friday
- **Time**: 9:00 AM - 5:00 PM EST
- **Minimum Time Between Emails**: 60 minutes
- **Max New Leads Per Day**: 50

This can be configured in `lib/campaign-manager.ts` via the `DEFAULT_REALTOR_SCHEDULE` constant.

## Anti-Spam Features

To avoid emails being flagged as spam:

1. **URL Formatting**: URLs are formatted with `[colon]` instead of `:` (e.g., `https[colon]//...`)
2. **Copy-Paste Instruction**: Template explicitly tells recipients to copy and paste the URL
3. **No Clickable Links**: URLs appear as text, not hyperlinks

## Usage Example

```typescript
import { processPlotOutreach } from '@/app/api/smartlead/lib/campaign-manager';

const result = await processPlotOutreach(
  'plot-123',
  {
    address: '123 Main St',
    url: 'https[colon]//app.yonder.com/plot/plot-123',
    price: '$500,000',
  },
  [
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@realty.com',
      customFields: {
        subject: 'Inquiry about your listing',
        body: 'Hello John...',
      },
    },
  ]
);

console.log(`Campaign ${result.campaignId} created with ${result.leadsAdded} leads`);
```

## Environment Variables

Required environment variables:

```env
SMARTLEAD_API_KEY=your_api_key_here
SMARTLEAD_BASE_URL=https://server.smartlead.ai/api/v1  # Optional, uses this default
```

## Database Setup

Run the database migration to create the `plot_campaigns` table. The table definition is in `src/server/db/schema.ts`.

## Best Practices

1. **One Campaign Per Plot**: Always use the `/send-per-plot` endpoint for new implementations
2. **Batch Processing**: The system automatically batches leads (100 per request) to avoid rate limits
3. **Error Handling**: Always handle errors gracefully - campaign creation is async and may fail
4. **Campaign Tracking**: Store campaign IDs for future reference and analytics

## Monitoring

Monitor campaigns via:

1. **Database**: Query `plot_campaigns` table for campaign mappings
2. **SmartLead Dashboard**: View campaign analytics at app.smartlead.ai
3. **Logs**: Check application logs for campaign creation/errors

## Troubleshooting

### Campaign Not Found
- Check if `SMARTLEAD_API_KEY` is set correctly
- Verify the campaign exists in SmartLead dashboard
- Check database for stored campaign ID

### Duplicate Campaigns
- The system prevents duplicates via database unique constraint on `plot_id`
- If duplicates occur, check for race conditions in concurrent requests

### Rate Limiting
- The system includes 250ms throttling between batch requests
- Adjust `sleep()` duration in `campaign-manager.ts` if needed

## Future Enhancements

- [ ] Campaign analytics tracking
- [ ] Automatic campaign archiving for old plots
- [ ] A/B testing support for email templates
- [ ] Campaign performance metrics
- [ ] Webhook integration for email events
