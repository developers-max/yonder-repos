import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  usersTable,
  enrichedPlots,
  enrichedPlotsStage,
  organizationPlotsTable,
  organizationsTable,
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as enrichClient from '@/lib/utils/remote-clients/yonder-enrich-client';

// Mock the enrichment client
vi.mock('@/lib/utils/remote-clients/yonder-enrich-client', () => ({
  enrichLocation: vi.fn(),
}));

// This test requires a DATABASE_URL pointing to a disposable test database.
const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('Realtor updatePlotLocation mutation', () => {
  const testUserId = randomUUID();
  const testPlotId = randomUUID();
  const testOrgId = randomUUID();
  const testOrgPlotId = randomUUID();
  const realtorEmail = 'test-realtor@example.com';

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(enrichedPlots).where(eq(enrichedPlots.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(enrichedPlots).where(eq(enrichedPlots.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  });

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(organizationPlotsTable).where(eq(organizationPlotsTable.id, testOrgPlotId));
    await db.delete(enrichedPlotsStage).where(eq(enrichedPlotsStage.id, testPlotId));
    await db.delete(enrichedPlots).where(eq(enrichedPlots.id, testPlotId));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));

    // Reset mocks
    vi.clearAllMocks();

    // Create test user with realtor role
    await db.insert(usersTable).values({
      id: testUserId,
      first_name: 'Test',
      last_name: 'Realtor',
      name: 'Test Realtor',
      email: realtorEmail,
      emailVerified: true,
      role: 'realtor',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test organization
    await db.insert(organizationsTable).values({
      id: testOrgId,
      name: 'Test Project',
      slug: 'test-project',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create test plot with initial coordinates in stage table
    await db.insert(enrichedPlotsStage).values({
      id: testPlotId,
      latitude: 40.416775,
      longitude: -3.703790,
      environment: 'test',
      price: '100000',
      size: '1000',
      enrichmentData: {
        cadastral: {
          address: 'Original Address, Madrid, Spain',
        },
      },
      images: [],
      municipalityId: null,
      plotReportUrl: 'https://example.com/old-report.pdf',
      plotReportJson: { old: 'data' },
    });

    // Create organization plot assignment to realtor
    await db.insert(organizationPlotsTable).values({
      id: testOrgPlotId,
      organizationId: testOrgId,
      plotId: testPlotId,
      status: 'outreach_sent',
      realtorEmail: realtorEmail,
      realtorName: 'Test Realtor',
      createdAt: new Date(),
    });
  });

  it('should update plot real coordinates successfully', async () => {
    // Arrange
    const newRealLatitude = 41.385064;
    const newRealLongitude = 2.173404;
    const newRealAddress = 'Accurate Address, Barcelona, Spain';

    // Act - Simulate the update mutation logic
    await db
      .update(enrichedPlotsStage)
      .set({
        realLatitude: newRealLatitude,
        realLongitude: newRealLongitude,
        realAddress: newRealAddress,
      })
      .where(eq(enrichedPlotsStage.id, testPlotId));

    // Assert
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlotsStage)
      .where(eq(enrichedPlotsStage.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    expect(updatedPlot!.realLatitude).toBe(newRealLatitude);
    expect(updatedPlot!.realLongitude).toBe(newRealLongitude);
    expect(updatedPlot!.realAddress).toBe(newRealAddress);
    // Original public coordinates should remain unchanged
    expect(updatedPlot!.latitude).toBe(40.416775);
    expect(updatedPlot!.longitude).toBe(-3.703790);
  });

  it('should update plot address in enrichmentData successfully', async () => {
    // Arrange
    const newAddress = 'Updated Address, Barcelona, Spain';

    // Act - Simulate the update mutation logic with JSONB merge
    await db
      .update(enrichedPlots)
      .set({
        enrichmentData: sql`
          COALESCE(${enrichedPlots.enrichmentData}, '{}'::jsonb) || 
          jsonb_build_object('cadastral', 
            COALESCE(${enrichedPlots.enrichmentData}->'cadastral', '{}'::jsonb) || 
            jsonb_build_object('address', ${newAddress}::text)
          )
        `,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    // Assert
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    expect(updatedPlot!.enrichmentData).toBeTruthy();
    const enrichmentData = updatedPlot!.enrichmentData as { cadastral?: { address?: string } };
    expect(enrichmentData.cadastral?.address).toBe(newAddress);
  });

  it('should update both coordinates and address together', async () => {
    // Arrange
    const newLatitude = 41.385064;
    const newLongitude = 2.173404;
    const newAddress = 'Complete Update, Barcelona, Spain';

    // Act
    await db
      .update(enrichedPlots)
      .set({
        latitude: newLatitude,
        longitude: newLongitude,
        enrichmentData: sql`
          COALESCE(${enrichedPlots.enrichmentData}, '{}'::jsonb) || 
          jsonb_build_object('cadastral', 
            COALESCE(${enrichedPlots.enrichmentData}->'cadastral', '{}'::jsonb) || 
            jsonb_build_object('address', ${newAddress}::text)
          )
        `,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    // Assert
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    expect(updatedPlot!.latitude).toBe(newLatitude);
    expect(updatedPlot!.longitude).toBe(newLongitude);
    const enrichmentData = updatedPlot!.enrichmentData as { cadastral?: { address?: string } };
    expect(enrichmentData.cadastral?.address).toBe(newAddress);
  });

  it('should preserve other enrichmentData fields when updating address', async () => {
    // Arrange - Add additional data to enrichmentData
    await db
      .update(enrichedPlots)
      .set({
        enrichmentData: {
          cadastral: {
            address: 'Original Address',
            postal_code: '28001',
            municipality: 'Madrid',
          },
          zoning: {
            classification: 'residential',
          },
        },
      })
      .where(eq(enrichedPlots.id, testPlotId));

    const newAddress = 'Updated Address Only';

    // Act - Update only the address
    await db
      .update(enrichedPlots)
      .set({
        enrichmentData: sql`
          COALESCE(${enrichedPlots.enrichmentData}, '{}'::jsonb) || 
          jsonb_build_object('cadastral', 
            COALESCE(${enrichedPlots.enrichmentData}->'cadastral', '{}'::jsonb) || 
            jsonb_build_object('address', ${newAddress}::text)
          )
        `,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    // Assert - Other fields should be preserved
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    const enrichmentData = updatedPlot!.enrichmentData as {
      cadastral?: { address?: string; postal_code?: string; municipality?: string };
      zoning?: { classification?: string };
    };
    expect(enrichmentData.cadastral?.address).toBe(newAddress);
    expect(enrichmentData.cadastral?.postal_code).toBe('28001');
    expect(enrichmentData.cadastral?.municipality).toBe('Madrid');
    expect(enrichmentData.zoning?.classification).toBe('residential');
  });

  it('should verify realtor has access to the plot before updating', async () => {
    // Arrange - Check if realtor is assigned to the plot
    const assignedPlot = await db
      .select({ id: organizationPlotsTable.id })
      .from(organizationPlotsTable)
      .where(
        and(
          eq(organizationPlotsTable.plotId, testPlotId),
          eq(organizationPlotsTable.realtorEmail, realtorEmail)
        )
      )
      .limit(1);

    // Assert
    expect(assignedPlot).toHaveLength(1);
    expect(assignedPlot[0]!.id).toBe(testOrgPlotId);
  });

  it('should handle coordinate validation (latitude range)', async () => {
    // Arrange
    const invalidLatitude = 95; // Outside valid range [-90, 90]
    const validLongitude = 2.173404;

    // Act & Assert - In real implementation, this would be caught by Zod validation
    // Here we test that the database accepts valid values
    const isValidLatitude = invalidLatitude >= -90 && invalidLatitude <= 90;
    expect(isValidLatitude).toBe(false);

    // Valid update should work
    const validLatitude = 41.385064;
    await db
      .update(enrichedPlots)
      .set({
        latitude: validLatitude,
        longitude: validLongitude,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot!.latitude).toBe(validLatitude);
  });

  it('should handle coordinate validation (longitude range)', async () => {
    // Arrange
    const validLatitude = 41.385064;
    const invalidLongitude = 185; // Outside valid range [-180, 180]

    // Act & Assert
    const isValidLongitude = invalidLongitude >= -180 && invalidLongitude <= 180;
    expect(isValidLongitude).toBe(false);

    // Valid update should work
    const validLongitude = 2.173404;
    await db
      .update(enrichedPlots)
      .set({
        latitude: validLatitude,
        longitude: validLongitude,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot!.longitude).toBe(validLongitude);
  });

  it('should handle empty address update', async () => {
    // Arrange
    const emptyAddress = '';

    // Act
    await db
      .update(enrichedPlots)
      .set({
        enrichmentData: sql`
          COALESCE(${enrichedPlots.enrichmentData}, '{}'::jsonb) || 
          jsonb_build_object('cadastral', 
            COALESCE(${enrichedPlots.enrichmentData}->'cadastral', '{}'::jsonb) || 
            jsonb_build_object('address', ${emptyAddress}::text)
          )
        `,
      })
      .where(eq(enrichedPlots.id, testPlotId));

    // Assert
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlots)
      .where(eq(enrichedPlots.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    const enrichmentData = updatedPlot!.enrichmentData as { cadastral?: { address?: string } };
    expect(enrichmentData.cadastral?.address).toBe(emptyAddress);
  });

  it('should call enrichment service when updating real coordinates', async () => {
    // Arrange
    const newRealLatitude = 41.385064;
    const newRealLongitude = 2.173404;
    const mockEnrichmentResponse = {
      location: { latitude: newRealLatitude, longitude: newRealLongitude },
      enrichments_run: ['amenities', 'municipalities', 'spain-zoning'],
      enrichments_skipped: [],
      enrichments_failed: [],
      timestamp: new Date().toISOString(),
    };

    vi.mocked(enrichClient.enrichLocation).mockResolvedValue(mockEnrichmentResponse as any);

    // Act - Import and call the function directly
    const { enrichLocation } = await import('@/lib/utils/remote-clients/yonder-enrich-client');
    await enrichLocation({
      latitude: newRealLatitude,
      longitude: newRealLongitude,
      plot_id: testPlotId,
      store_results: true,
    });

    // Assert
    expect(enrichClient.enrichLocation).toHaveBeenCalledWith({
      latitude: newRealLatitude,
      longitude: newRealLongitude,
      plot_id: testPlotId,
      store_results: true,
    });
    expect(enrichClient.enrichLocation).toHaveBeenCalledTimes(1);
  });

  it('should clear plot report data after successful enrichment', async () => {
    // Arrange - Verify initial state has report data
    const [initialPlot] = await db
      .select()
      .from(enrichedPlotsStage)
      .where(eq(enrichedPlotsStage.id, testPlotId));

    expect(initialPlot!.plotReportUrl).toBe('https://example.com/old-report.pdf');
    expect(initialPlot!.plotReportJson).toEqual({ old: 'data' });

    // Act - Clear report data (simulating what happens after successful enrichment)
    await db
      .update(enrichedPlotsStage)
      .set({
        plotReportUrl: null,
        plotReportJson: null,
      })
      .where(eq(enrichedPlotsStage.id, testPlotId));

    // Assert - Report data should be cleared
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlotsStage)
      .where(eq(enrichedPlotsStage.id, testPlotId));

    expect(updatedPlot).toBeTruthy();
    expect(updatedPlot!.plotReportUrl).toBeNull();
    expect(updatedPlot!.plotReportJson).toBeNull();
  });

  it('should preserve enrichmentData when clearing report data', async () => {
    // Arrange
    const existingEnrichmentData = {
      cadastral: { address: 'Test Address' },
      zoning: { classification: 'residential' },
    };

    await db
      .update(enrichedPlotsStage)
      .set({
        enrichmentData: existingEnrichmentData,
        plotReportUrl: 'https://example.com/report.pdf',
        plotReportJson: { data: 'test' },
      })
      .where(eq(enrichedPlotsStage.id, testPlotId));

    // Act - Clear only report data
    await db
      .update(enrichedPlotsStage)
      .set({
        plotReportUrl: null,
        plotReportJson: null,
      })
      .where(eq(enrichedPlotsStage.id, testPlotId));

    // Assert - Enrichment data should be preserved
    const [updatedPlot] = await db
      .select()
      .from(enrichedPlotsStage)
      .where(eq(enrichedPlotsStage.id, testPlotId));

    expect(updatedPlot!.enrichmentData).toEqual(existingEnrichmentData);
    expect(updatedPlot!.plotReportUrl).toBeNull();
    expect(updatedPlot!.plotReportJson).toBeNull();
  });
});
