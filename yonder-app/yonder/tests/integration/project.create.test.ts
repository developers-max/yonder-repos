import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import {
  organizationsTable,
  organizationStepsTable,
  processStepsTable,
} from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { seedOrganizationAfterCreate } from '@/lib/auth';

// This test requires a DATABASE_URL pointing to a disposable test database.
// It performs real inserts/updates and cleans up after itself.

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('Project creation integration', () => {
  const testOrgId = randomUUID();
  const stepIds = [randomUUID(), randomUUID()];

  beforeAll(async () => {
    // Ensure clean slate for the specific org and steps we will create
    await db.delete(organizationStepsTable).where(eq(organizationStepsTable.organizationId, testOrgId));
    await db.delete(processStepsTable).where(inArray(processStepsTable.id, stepIds));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
  });

  afterAll(async () => {
    // Cleanup artifacts
    await db.delete(organizationStepsTable).where(eq(organizationStepsTable.organizationId, testOrgId));
    await db.delete(processStepsTable).where(inArray(processStepsTable.id, stepIds));
    await db.delete(organizationsTable).where(eq(organizationsTable.id, testOrgId));
  });

  beforeEach(() => {
    // Freeze time for deterministic timestamp assertions
    const fixed = new Date('2025-01-01T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fixed);
  });

  it('creates organization steps and updates organization fields (E2E-ish with DB)', async () => {
    // Arrange: seed master process steps
    await db.insert(processStepsTable).values([
      {
        id: stepIds[0],
        orderIndex: 1,
        name: 'step-a',
        title: 'Step A',
        detailedDescription: 'Do step A',
        category: 'general',
        estimatedTime: '1d',
        createdAt: new Date(),
      },
      {
        id: stepIds[1],
        orderIndex: 2,
        name: 'step-b',
        title: 'Step B',
        detailedDescription: 'Do step B',
        category: 'general',
        estimatedTime: '1d',
        createdAt: new Date(),
      },
    ]);

    // Create bare organization row (as would exist right after create, before our hook finalizes)
    const name = 'Acme';
    const slug = 'acme';
    const metadata = { website: 'https://acme.test' } as Record<string, unknown>;
    await db.insert(organizationsTable).values({
      id: testOrgId,
      name,
      slug,
      metadata, // initial metadata
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Act: run the same logic our organization.create.after hook executes
    await seedOrganizationAfterCreate(db, { id: testOrgId, name, slug, metadata });

    // Assert: organization_steps created for each process step
    const orgSteps = await db
      .select({ processStepId: organizationStepsTable.processStepId, status: organizationStepsTable.status, organizationId: organizationStepsTable.organizationId, createdAt: organizationStepsTable.createdAt })
      .from(organizationStepsTable)
      .where(eq(organizationStepsTable.organizationId, testOrgId));

    const filtered = orgSteps.filter((r) => (stepIds as unknown as string[]).includes(r.processStepId as unknown as string));
    expect(filtered).toHaveLength(stepIds.length);
    const stepIdsCreated = filtered.map((r) => r.processStepId as unknown as string).sort();
    expect(stepIdsCreated).toEqual(([...stepIds] as unknown as string[]).sort());
    filtered.forEach((r) => {
      expect(r.organizationId).toBe(testOrgId);
      expect(r.status).toBe('pending');
      expect(r.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));
    });

    // Assert: organization fields were updated to active and timestamps set
    const [org] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, testOrgId));

    expect(org).toBeTruthy();
    expect(org!.name).toBe(name);
    expect(org!.slug).toBe(slug);
    expect(org!.metadata).toEqual(metadata);
    expect(org!.status).toBe('active');
    expect(org!.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));
    expect(org!.updatedAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));
  });
});
