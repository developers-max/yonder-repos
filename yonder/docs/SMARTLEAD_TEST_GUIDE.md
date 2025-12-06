# SmartLead Integration Test Guide

## Overview

This guide explains how to run the SmartLead integration test and what to expect on the SmartLead side.

## Campaign Schedule Configuration

The system uses the following default schedule for all realtor outreach campaigns:

### Schedule Details

```typescript
{
  days: [1, 2, 3, 4, 5],           // Monday to Friday only
  start_hour: "09:00",              // 9:00 AM
  end_hour: "17:00",                // 5:00 PM
  timezone: "America/New_York",     // Eastern Time
  min_time_btw_emails: 60,          // 60 minutes (1 hour) between emails
  max_new_leads_per_day: 50         // Maximum 50 new leads contacted per day
}
```

### What This Means

- **Emails are only sent Monday through Friday**
  - No emails on weekends (Saturday/Sunday)
  
- **Sending window: 9 AM - 5 PM Eastern Time**
  - If you're in a different timezone, convert accordingly
  - Example: For PST, emails send 6 AM - 2 PM
  
- **Rate limiting:**
  - Minimum 1 hour gap between consecutive emails
  - Maximum 50 new contacts per day per campaign
  
- **Lead status progression:**
  - `STARTED` → Lead added, waiting for first email
  - `INPROGRESS` → At least one email sent
  - `COMPLETED` → All sequence emails sent
  - `STOPPED` → Reply received or manually stopped

## Running the Integration Test

### Prerequisites

1. **Set up environment variables** in `.env`:
   ```bash
   # Required
   SMARTLEAD_API_KEY=your_actual_api_key
   
   # Optional - to enable live test
   RUN_SMARTLEAD_INTEGRATION_TEST=true
   TEST_REALTOR_EMAIL=your-test-email@example.com
   ```

2. **SmartLead API access**
   - Ensure your API key is valid
   - Check that your SmartLead plan includes API access

### Running the Test

```bash
# Basic test (shows schedule info, doesn't make API calls)
npm test -- smartlead.campaign.test.ts

# Live test (creates actual campaigns and sends emails)
RUN_SMARTLEAD_INTEGRATION_TEST=true npm test -- smartlead.campaign.test.ts
```

## What Happens on SmartLead Side

When you run the live integration test, here's what occurs:

### 1. Campaign Creation
```
✓ New campaign created in SmartLead
  - Name: "Test Plot test-plot-integration-001 - Integration Test"
  - Status: ACTIVE
  - Campaign ID: (assigned by SmartLead, e.g., 1234567)
```

### 2. Schedule Configuration
```
✓ Campaign schedule set
  - Sending days: Mon, Tue, Wed, Thu, Fri
  - Sending hours: 09:00-17:00 EST
  - Email throttle: 60 min between sends
```

### 3. Lead Addition
```
✓ Test realtor added to campaign
  - Email: your-test-email@example.com
  - Name: Test Realtor
  - Status: STARTED
  - Custom fields populated:
    * plot_id
    * plot_url
    * subject
    * body
```

### 4. Email Sending
```
⏰ Email will be sent at next scheduled time
  - If current time is within schedule: ~immediately
  - If outside schedule: next business day, 9 AM EST
```

## Monitoring the Test

### View Campaign in SmartLead Dashboard

After the test runs, you'll see output like:
```
Campaign ID: 1234567
View campaign: https://app.smartlead.ai/app/email-campaign/1234567/analytics
```

### Check Email Status

1. Go to SmartLead dashboard
2. Navigate to: Email Campaigns → Your test campaign
3. Click "Analytics" tab
4. You'll see:
   - Total leads: 1
   - Lead status: STARTED
   - Scheduled send time
   - Email preview

### Verify Email Receipt

Check the test email inbox (e.g., `yfantisa@outlook.com`):
- Email will arrive during scheduled hours
- Subject: "Test - Inquiry about your land listing"
- From: Your connected SmartLead email account
- Body: Contains test plot ID and Yonder messaging

## Test Output Example

```
📊 SMARTLEAD INTEGRATION TEST SUMMARY
================================================================================

✅ Test completed successfully!

What happened on the SmartLead side:
1. ✨ New campaign(s) created with test plot IDs
2. ⏰ Campaign schedule configured:
   • Monday-Friday only
   • 9:00 AM - 5:00 PM Eastern Time
   • Minimum 60 minutes between emails
   • Maximum 50 new leads per day
3. 📧 Test realtor lead(s) added to campaigns
4. 📬 Emails will be sent according to the schedule

Next steps in SmartLead:
• Leads are now in "STARTED" status
• Emails will be sent during scheduled hours
• You can monitor sends in the SmartLead dashboard
• Replies will appear in the Master Inbox

🔗 Campaign URL: https://app.smartlead.ai/app/email-campaign/1234567/analytics

================================================================================
```

## Cleanup

After running the test:

1. **Test campaigns are real campaigns** - they won't auto-delete
2. **Manual cleanup recommended:**
   - Go to SmartLead dashboard
   - Find test campaigns (contain "Integration Test" in name)
   - Archive or delete them

3. **Or use SmartLead API to delete:**
   ```bash
   curl -X DELETE \
     "https://server.smartlead.ai/api/v1/campaigns/{campaign_id}?api_key=YOUR_API_KEY"
   ```

## Troubleshooting

### Test Shows "Skipped"
- Ensure `RUN_SMARTLEAD_INTEGRATION_TEST=true` is set
- Check that `.env` file is in the correct location

### API Error "Invalid API Key"
- Verify `SMARTLEAD_API_KEY` in `.env`
- Check API key is active in SmartLead settings

### No Email Received
- Check current time is within schedule (Mon-Fri, 9 AM-5 PM EST)
- Verify test email address is valid
- Check spam/junk folder
- Allow up to 5-10 minutes for first email in new campaign

### Campaign Created But No Lead
- Check SmartLead dashboard for error messages
- Verify email address format is correct
- Ensure SmartLead account has available email sending quota

## Production vs Test

### In Production:
- Campaigns are created once per plot ID
- Campaign IDs stored in database
- Subsequent outreach to same plot reuses campaign
- Multiple realtors per plot added to same campaign
- Real realtor emails used

### In Test:
- New campaign created each test run
- Campaign IDs logged to console (not stored)
- Single test lead per campaign
- Test email used (configurable)
- Campaigns should be manually cleaned up

## Schedule Modification

To change the default schedule, edit:
```typescript
// src/app/api/smartlead/lib/campaign-manager.ts

export const DEFAULT_REALTOR_SCHEDULE: CampaignSchedule = {
  days: [1, 2, 3, 4, 5],        // Change days (0=Sun, 6=Sat)
  start_hour: "09:00",           // Change start time
  end_hour: "17:00",             // Change end time
  timezone: "America/New_York",  // Change timezone
  min_time_btw_emails: 60,       // Change throttle (minutes)
  max_new_leads_per_day: 50,     // Change daily limit
};
```

Common timezones:
- `America/New_York` - Eastern Time
- `America/Chicago` - Central Time
- `America/Denver` - Mountain Time
- `America/Los_Angeles` - Pacific Time
- `Europe/London` - GMT/BST
- `UTC` - Coordinated Universal Time

## Questions?

- SmartLead API Docs: https://api.smartlead.ai/reference
- Campaign Manager Code: `src/app/api/smartlead/lib/campaign-manager.ts`
- Integration Test: `tests/integration/smartlead.campaign.test.ts`
