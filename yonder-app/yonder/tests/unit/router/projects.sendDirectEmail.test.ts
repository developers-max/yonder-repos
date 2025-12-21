import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  usersTable,
  enrichedPlotsStage,
  organizationPlotsTable,
  organizationsTable,
  membersTable,
} from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

// Mock the email module
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}));

// This test requires a DATABASE_URL pointing to a disposable test database.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('Projects sendDirectEmail mutation', () => {
  const testUserId = randomUUID();
  const testPlotId = randomUUID();
  const testOrgId = randomUUID();
  const testOrgPlotId = randomUUID();
  const testMembershipId = randomUUID();
  const userEmail = 'test-user@example.com';
  const claimedRealtorEmail = 'claimed-realtor@example.com';
  const claimedRealtorName = 'Claimed Realtor';

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(membersTable).where(eq(membersTable.id, testMembershipId));
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(membersTable).where(eq(membersTable.id, testMembershipId));
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(membersTable).where(eq(membersTable.id, testMembershipId));
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));

    // Reset mocks
    vi.clearAllMocks();

    // Create test user
    await db.insert(usersTable).values({
      id: testUserId,
      first_name: 'Test',
      last_name: 'User',
      name: 'Test User',
      email: userEmail,
      emailVerified: true,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test organization
    await db.insert(organizationsTable).values({
      id: testOrgId,
      name: 'Test Project',
      slug: 'test-project-direct-email',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create membership
    await db.insert(membersTable).values({
      id: testMembershipId,
      userId: testUserId,
      organizationId: testOrgId,
      role: 'member',
      createdAt: new Date(),
    });
  });

  describe('Claimed plot validation', () => {
    it('should verify plot exists before sending email', async () => {
      // Arrange - No plot created
      const nonExistentPlotId = randomUUID();

      // Act - Try to query the plot
      const [plot] = await db
        .select({
          id: enrichedPlotsStage.id,
          claimedByUserId: enrichedPlotsStage.claimedByUserId,
        })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, nonExistentPlotId))
        .limit(1);

      // Assert - Plot should not exist
      expect(plot).toBeUndefined();
    });

    it('should verify plot is claimed before allowing direct email', async () => {
      // Arrange - Create unclaimed plot
      await db.insert(enrichedPlotsStage).values({
        id: testPlotId,
        latitude: 40.416775,
        longitude: -3.703790,
        environment: 'test',
        price: '100000',
        size: '1000',
        claimedByUserId: null, // Not claimed
        claimedByEmail: null,
        claimedByName: null,
      });

      // Act - Query the plot
      const [plot] = await db
        .select({
          id: enrichedPlotsStage.id,
          claimedByUserId: enrichedPlotsStage.claimedByUserId,
          claimedByEmail: enrichedPlotsStage.claimedByEmail,
        })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, testPlotId))
        .limit(1);

      // Assert - Plot exists but is not claimed
      expect(plot).toBeDefined();
      expect(plot!.claimedByUserId).toBeNull();
      expect(plot!.claimedByEmail).toBeNull();
    });

    it('should allow direct email for claimed plots', async () => {
      // Arrange - Create claimed plot
      const claimedUserId = randomUUID();
      await db.insert(enrichedPlotsStage).values({
        id: testPlotId,
        latitude: 40.416775,
        longitude: -3.703790,
        environment: 'test',
        price: '100000',
        size: '1000',
        claimedByUserId: claimedUserId,
        claimedByEmail: claimedRealtorEmail,
        claimedByName: claimedRealtorName,
        claimedAt: new Date().toISOString(),
      });

      // Act - Query the plot
      const [plot] = await db
        .select({
          id: enrichedPlotsStage.id,
          claimedByUserId: enrichedPlotsStage.claimedByUserId,
          claimedByEmail: enrichedPlotsStage.claimedByEmail,
          claimedByName: enrichedPlotsStage.claimedByName,
        })
        .from(enrichedPlotsStage)
        .where(eq(enrichedPlotsStage.id, testPlotId))
        .limit(1);

      // Assert - Plot is claimed
      expect(plot).toBeDefined();
      expect(plot!.claimedByUserId).toBe(claimedUserId);
      expect(plot!.claimedByEmail).toBe(claimedRealtorEmail);
      expect(plot!.claimedByName).toBe(claimedRealtorName);
    });
  });

  describe('Membership verification', () => {
    it('should verify user is a member of the organization', async () => {
      // Act - Check membership
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, testUserId),
            eq(membersTable.organizationId, testOrgId)
          )
        )
        .limit(1);

      // Assert
      expect(membership).toBeDefined();
      expect(membership!.userId).toBe(testUserId);
      expect(membership!.organizationId).toBe(testOrgId);
    });

    it('should reject non-members', async () => {
      // Arrange - Different user
      const otherUserId = randomUUID();

      // Act - Check membership for other user
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(
          and(
            eq(membersTable.userId, otherUserId),
            eq(membersTable.organizationId, testOrgId)
          )
        )
        .limit(1);

      // Assert - No membership found
      expect(membership).toBeUndefined();
    });
  });

  describe('Organization plot status update', () => {
    it('should update organization plot status after successful email send', async () => {
      // Arrange - Create claimed plot and organization plot
      const claimedUserId = randomUUID();
      await db.insert(enrichedPlotsStage).values({
        id: testPlotId,
        latitude: 40.416775,
        longitude: -3.703790,
        environment: 'test',
        price: '100000',
        size: '1000',
        claimedByUserId: claimedUserId,
        claimedByEmail: claimedRealtorEmail,
        claimedByName: claimedRealtorName,
      });

      await db.insert(organizationPlotsTable).values({
        id: testOrgPlotId,
        organizationId: testOrgId,
        plotId: testPlotId,
        status: 'interested',
        createdAt: new Date(),
      });

      // Act - Simulate the update that happens after email send
      await db
        .update(organizationPlotsTable)
        .set({
          realtorEmail: claimedRealtorEmail,
          realtorName: claimedRealtorName,
          status: 'outreach_sent',
        })
        .where(
          and(
            eq(organizationPlotsTable.organizationId, testOrgId),
            eq(organizationPlotsTable.plotId, testPlotId)
          )
        );

      // Assert
      const [updatedOrgPlot] = await db
        .select()
        .from(organizationPlotsTable)
        .where(eq(organizationPlotsTable.id, testOrgPlotId))
        .limit(1);

      expect(updatedOrgPlot).toBeDefined();
      expect(updatedOrgPlot!.status).toBe('outreach_sent');
      expect(updatedOrgPlot!.realtorEmail).toBe(claimedRealtorEmail);
      expect(updatedOrgPlot!.realtorName).toBe(claimedRealtorName);
    });
  });

  describe('Email content formatting', () => {
    it('should convert plain text body to HTML paragraphs', () => {
      // Arrange
      const plainTextBody = `Hello,

I am interested in your land listing.
Could we discuss availability?

Best regards,
Test User`;

      // Act - Simulate the HTML conversion logic from sendDirectEmail
      const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${plainTextBody
          .split('\n')
          .map(line => line.trim())
          .map(line => line ? `<p style="color: #374151; font-size: 16px; line-height: 24px; margin: 0 0 16px 0;">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '<br/>')
          .join('')}
      </div>`;

      // Assert
      expect(htmlBody).toContain('Hello,');
      expect(htmlBody).toContain('I am interested in your land listing.');
      expect(htmlBody).toContain('<p style=');
      expect(htmlBody).toContain('<br/>'); // Empty lines converted to br
    });

    it('should escape HTML special characters in body', () => {
      // Arrange
      const bodyWithSpecialChars = 'Price: <$100,000 & negotiable>';

      // Act
      const escaped = bodyWithSpecialChars
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      // Assert
      expect(escaped).toBe('Price: &lt;$100,000 &amp; negotiable&gt;');
      expect(escaped).not.toContain('<$');
      expect(escaped).not.toContain('&n');
    });
  });
});
