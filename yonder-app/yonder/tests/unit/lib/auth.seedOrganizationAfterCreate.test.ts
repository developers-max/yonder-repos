import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedOrganizationAfterCreate } from '@/lib/auth';
import type * as DBNS from '@/lib/db';
import { buildMockDb } from '../../_mocks/db';
import type { OrgStepRow, OrgUpdateSetArg } from '../../_mocks/db';

const baseOrg = { id: 'org_1', name: 'Acme', slug: 'acme', metadata: { foo: 'bar' } };

describe('seedOrganizationAfterCreate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  it('seeds organization steps and updates organization fields', async () => {
    const stepIds = ['s1', 's2'];
    const { db, capturedInsert, capturedUpdate } = buildMockDb(stepIds);

    await seedOrganizationAfterCreate(db as unknown as typeof DBNS.db, baseOrg);

    // Insert called with one value per step
    expect(capturedInsert.valuesArg).toBeDefined();
    const values = capturedInsert.valuesArg as OrgStepRow[];
    expect(Array.isArray(values)).toBe(true);
    expect(values).toHaveLength(stepIds.length);
    for (let i = 0; i < stepIds.length; i++) {
      const row = values[i];
      expect(row.organizationId).toBe(baseOrg.id);
      expect(row.processStepId).toBe(stepIds[i]);
      expect(row.status).toBe('pending');
      expect(row.createdAt).toEqual(new Date('2025-01-01T00:00:00.000Z'));
      expect(typeof row.id).toBe('string');
    }

    // Update called with merged defaults
    expect(capturedUpdate.setArg).toBeDefined();
    const setArg = capturedUpdate.setArg as OrgUpdateSetArg;
    expect(setArg).toMatchObject({
      name: baseOrg.name,
      slug: baseOrg.slug,
      metadata: baseOrg.metadata,
      status: 'active',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
  });

  it('skips insert when there are no process steps but still updates organization', async () => {
    const { db, capturedInsert, capturedUpdate } = buildMockDb([]);

    await seedOrganizationAfterCreate(db as unknown as typeof DBNS.db, baseOrg);

    // No values captured when no steps
    expect(capturedInsert.valuesArg).toBeUndefined();
    expect(capturedUpdate.setArg).toBeDefined();
    const setArg = capturedUpdate.setArg as OrgUpdateSetArg;
    expect(setArg.status).toBe('active');
  });

  it('defaults metadata to {} when not provided', async () => {
    const { db, capturedUpdate } = buildMockDb(['s1']);

    await seedOrganizationAfterCreate(db as unknown as typeof DBNS.db, { id: 'org_2' });

    expect(capturedUpdate.setArg).toBeDefined();
    const setArg = capturedUpdate.setArg as OrgUpdateSetArg;
    expect(setArg.metadata).toEqual({});
  });

  it('does not override provided name/slug with undefined', async () => {
    const { db, capturedUpdate } = buildMockDb(['s1']);

    await seedOrganizationAfterCreate(db as unknown as typeof DBNS.db, { id: 'org_3', name: 'X', slug: 'x' });

    expect(capturedUpdate.setArg).toBeDefined();
    const setArg = capturedUpdate.setArg as OrgUpdateSetArg;
    expect(setArg.name).toBe('X');
    expect(setArg.slug).toBe('x');
  });
});
