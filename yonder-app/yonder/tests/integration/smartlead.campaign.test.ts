/// <reference types="vitest/globals" />

/**
 * Integration test for SmartLead Campaign Management
 * 
 * This test verifies the end-to-end flow of creating a campaign per plot
 * and sending emails to test realtors through the SmartLead API.
 * 
 * To run this test:
 * 1. Ensure SMARTLEAD_API_KEY is set in your .env file
 * 2. Run: npm test -- smartlead.campaign.test.ts
 * 
 * Note: This test makes real API calls to SmartLead and creates actual campaigns.
 * Use with caution and clean up test campaigns manually if needed.
 */

import { 
  createPlotCampaign, 
  setCampaignSchedule, 
  addLeadsToCampaign,
  processPlotOutreach,
  getCampaignById,
  DEFAULT_REALTOR_SCHEDULE,
  type SmartLeadLead
} from '@/app/api/smartlead/lib/campaign-manager';

// Set to true to actually run the test (it will create real campaigns)
const RUN_LIVE_TEST = process.env.RUN_SMARTLEAD_INTEGRATION_TEST === 'true';

describe('SmartLead Campaign Integration Test', () => {
  // Test configuration
  const TEST_PLOT_ID = 'test-plot-integration-001';
  const TEST_REALTOR_EMAIL = process.env.TEST_REALTOR_EMAIL || 'antonis@typesystem.xyz';
  
  let createdCampaignId: number | null = null;

  beforeAll(() => {
    if (!RUN_LIVE_TEST) {
      console.log('\n⚠️  Skipping live SmartLead integration test');
      console.log('To run this test, set RUN_SMARTLEAD_INTEGRATION_TEST=true in your .env\n');
    } else {
      console.log('\n✅ Running live SmartLead integration test');
      console.log(`📧 Test emails will be sent to: ${TEST_REALTOR_EMAIL}\n`);
    }
  });

  afterAll(() => {
    if (createdCampaignId && RUN_LIVE_TEST) {
      console.log('\n📝 Campaign created during test:');
      console.log(`   Campaign ID: ${createdCampaignId}`);
      console.log(`   Plot ID: ${TEST_PLOT_ID}`);
      console.log(`   View in SmartLead: https://app.smartlead.ai/app/email-campaign/${createdCampaignId}/analytics`);
      console.log('\n⚠️  Remember to manually clean up this test campaign in SmartLead if needed\n');
    }
  });

  describe('Campaign Schedule Configuration', () => {
    it('should have correct default schedule settings', () => {
      console.log('\n📅 Default Campaign Schedule:');
      console.log('   Days: Monday-Friday (1-5)');
      console.log(`   Time: ${DEFAULT_REALTOR_SCHEDULE.start_hour} - ${DEFAULT_REALTOR_SCHEDULE.end_hour}`);
      console.log(`   Timezone: ${DEFAULT_REALTOR_SCHEDULE.timezone}`);
      console.log(`   Min time between emails: ${DEFAULT_REALTOR_SCHEDULE.min_time_btw_emails} minutes`);
      console.log(`   Max new leads per day: ${DEFAULT_REALTOR_SCHEDULE.max_new_leads_per_day}`);

      expect(DEFAULT_REALTOR_SCHEDULE.days_of_the_week).toEqual([1, 2, 3, 4, 5]);
      expect(DEFAULT_REALTOR_SCHEDULE.start_hour).toBe('09:00');
      expect(DEFAULT_REALTOR_SCHEDULE.end_hour).toBe('17:00');
      expect(DEFAULT_REALTOR_SCHEDULE.timezone).toBe('America/New_York');
      expect(DEFAULT_REALTOR_SCHEDULE.min_time_btw_emails).toBe(60);
      expect(DEFAULT_REALTOR_SCHEDULE.max_new_leads_per_day).toBe(50);
    });
  });

  describe('Campaign Creation', () => {
    it('should create a new campaign for a plot', async () => {
      if (!RUN_LIVE_TEST) {
        console.log('   ⏭️  Skipped (set RUN_SMARTLEAD_INTEGRATION_TEST=true to run)');
        return;
      }

      console.log(`\n🚀 Creating campaign for plot: ${TEST_PLOT_ID}`);
      
      const campaignId = await createPlotCampaign(
        TEST_PLOT_ID,
        `Test Plot ${TEST_PLOT_ID} - Integration Test`
      );

      createdCampaignId = campaignId;

      console.log(`   ✅ Campaign created successfully`);
      console.log(`   Campaign ID: ${campaignId}`);

      expect(campaignId).toBeDefined();
      expect(typeof campaignId).toBe('number');
      expect(campaignId).toBeGreaterThan(0);
    }, 30000); // 30 second timeout

    it('should set the campaign schedule', async () => {
      if (!RUN_LIVE_TEST || !createdCampaignId) {
        console.log('   ⏭️  Skipped');
        return;
      }

      console.log(`\n⏰ Setting schedule for campaign ${createdCampaignId}`);
      console.log(`   Schedule: Mon-Fri, 9 AM - 5 PM EST`);

      await setCampaignSchedule(createdCampaignId, DEFAULT_REALTOR_SCHEDULE);

      console.log(`   ✅ Schedule set successfully`);
    }, 15000);

    it('should retrieve campaign details', async () => {
      if (!RUN_LIVE_TEST || !createdCampaignId) {
        console.log('   ⏭️  Skipped');
        return;
      }

      console.log(`\n🔍 Retrieving campaign details for ID: ${createdCampaignId}`);

      const campaign = await getCampaignById(createdCampaignId);

      console.log(`   ✅ Campaign retrieved successfully`);
      console.log(`   Name: ${campaign.name}`);
      console.log(`   Status: ${campaign.status || 'N/A'}`);

      expect(campaign).toBeDefined();
      expect(campaign.id).toBe(createdCampaignId);
      expect(campaign.name).toContain(TEST_PLOT_ID);
    }, 15000);
  });

  describe('Lead Management', () => {
    it('should add a test realtor lead to the campaign', async () => {
      if (!RUN_LIVE_TEST || !createdCampaignId) {
        console.log('   ⏭️  Skipped');
        return;
      }

      const testLead: SmartLeadLead = {
        first_name: 'Test',
        last_name: 'Realtor',
        email: TEST_REALTOR_EMAIL,
        custom_fields: {
          plot_id: TEST_PLOT_ID,
          plot_url: `https[colon]//app.yonder.com/plot/${TEST_PLOT_ID}`,
          // Note: subject and body are NOT included here - they should only be used
          // for sequence creation in processPlotOutreach, not as lead custom fields
        },
      };

      console.log(`\n📧 Adding test lead to campaign ${createdCampaignId}`);
      console.log(`   Email: ${testLead.email}`);
      console.log(`   Name: ${testLead.first_name} ${testLead.last_name}`);

      await addLeadsToCampaign(createdCampaignId, [testLead]);

      console.log(`   ✅ Lead added successfully`);
      console.log(`   📬 Email will be sent according to campaign schedule`);
    }, 15000);
  });

  describe('End-to-End Workflow', () => {
    it('should process complete plot outreach workflow', async () => {
      if (!RUN_LIVE_TEST) {
        console.log('   ⏭️  Skipped');
        return;
      }

      const e2ePlotId = 'test-plot-e2e-001';
      
      console.log(`\n🎯 Running end-to-end plot outreach for: ${e2ePlotId}`);

      const result = await processPlotOutreach(
        e2ePlotId,
        {
          address: '123 Test Street, Test City, CA',
          url: `https[colon]//app.yonder.com/plot/${e2ePlotId}`,
          price: '$500,000',
        },
        [
          {
            firstName: 'Integration',
            lastName: 'Test',
            email: TEST_REALTOR_EMAIL,
            customFields: {
              subject: 'E2E Test - Inquiry about your land listing',
              body: 'This is an end-to-end integration test.',
            },
          },
        ],
        DEFAULT_REALTOR_SCHEDULE
      );

      console.log(`   ✅ Workflow completed successfully`);
      console.log(`   Campaign ID: ${result.campaignId}`);
      console.log(`   Leads added: ${result.leadsAdded}`);
      console.log(`   View campaign: https://app.smartlead.ai/app/email-campaign/${result.campaignId}/analytics`);

      expect(result).toBeDefined();
      expect(result.campaignId).toBeGreaterThan(0);
      expect(result.leadsAdded).toBe(1);

      // Store for cleanup notice
      if (!createdCampaignId) {
        createdCampaignId = result.campaignId;
      }
    }, 45000); // 45 second timeout for full workflow
  });

  describe('Campaign Information Summary', () => {
    it('should display test results summary', () => {
      console.log('\n' + '='.repeat(80));
      console.log('📊 SMARTLEAD INTEGRATION TEST SUMMARY');
      console.log('='.repeat(80));
      
      if (RUN_LIVE_TEST) {
        console.log('\n✅ Test completed successfully!\n');
        console.log('What happened on the SmartLead side:');
        console.log('1. ✨ New campaign(s) created with test plot IDs');
        console.log('2. ⏰ Campaign schedule configured:');
        console.log('   • Monday-Friday only');
        console.log('   • 9:00 AM - 5:00 PM Eastern Time');
        console.log('   • Minimum 60 minutes between emails');
        console.log('   • Maximum 50 new leads per day');
        console.log('3. 📧 Test realtor lead(s) added to campaigns');
        console.log('4. 📬 Emails will be sent according to the schedule');
        console.log('\nNext steps in SmartLead:');
        console.log('• Leads are now in "STARTED" status');
        console.log('• Emails will be sent during scheduled hours');
        console.log('• You can monitor sends in the SmartLead dashboard');
        console.log('• Replies will appear in the Master Inbox');
        
        if (createdCampaignId) {
          console.log(`\n🔗 Campaign URL: https://app.smartlead.ai/app/email-campaign/${createdCampaignId}/analytics`);
        }
      } else {
        console.log('\n⚠️  Live test was not run');
        console.log('\nTo run live tests that interact with SmartLead API:');
        console.log('1. Add to your .env file:');
        console.log('   RUN_SMARTLEAD_INTEGRATION_TEST=true');
        console.log('   TEST_REALTOR_EMAIL=your-test-email@example.com');
        console.log('2. Ensure SMARTLEAD_API_KEY is set');
        console.log('3. Run the test again');
      }
      
      console.log('\n' + '='.repeat(80) + '\n');
    });
  });
});

/**
 * Example manual test run:
 * 
 * 1. Set environment variables in .env:
 *    RUN_SMARTLEAD_INTEGRATION_TEST=true
 *    TEST_REALTOR_EMAIL=your-test-email@example.com
 *    SMARTLEAD_API_KEY=your_api_key
 * 
 * 2. Run the test:
 *    npm test -- smartlead.campaign.test.ts
 * 
 * 3. Check SmartLead dashboard:
 *    https://app.smartlead.ai/app/email-campaigns
 * 
 * 4. Expected results:
 *    - New campaign created with test plot ID in the name
 *    - Campaign has schedule: Mon-Fri, 9 AM - 5 PM EST
 *    - Test lead added with status "STARTED"
 *    - Email will be sent during next scheduled time window
 * 
 * 5. Clean up:
 *    - Manually archive or delete test campaigns in SmartLead
 *    - Or use SmartLead API to programmatically delete test campaigns
 */
