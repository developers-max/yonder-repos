import { vi } from 'vitest';

// Explicit function types for the mocked DB API we use in tests
export type SelectFn = (
  ...args: unknown[]
) => {
  from: (...args: unknown[]) => Promise<Array<{ id: string }>>;
};

export type OrgStepRow = {
  id: string;
  organizationId: string;
  processStepId: string;
  status: string;
  createdAt: Date;
};

export type InsertFn = (
  ...args: unknown[]
) => {
  values: (arg: OrgStepRow[]) => Promise<void>;
};

export type OrgUpdateSetArg = {
  name?: string;
  slug?: string;
  metadata?: Record<string, unknown> | null;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateFn = (
  ...args: unknown[]
) => {
  set: (
    arg: OrgUpdateSetArg
  ) => {
    where: (arg: unknown) => Promise<void>;
  };
};

export interface MockDb {
  select: SelectFn;
  insert: InsertFn;
  update: UpdateFn;
}

export function createSelect(returnIds: string[]): SelectFn {
  const from = vi.fn().mockResolvedValue(returnIds.map((id) => ({ id })));
  const select: SelectFn = vi.fn().mockReturnValue({ from }) as unknown as SelectFn;
  return select;
}

export function createInsert(captured: { valuesArg?: OrgStepRow[] }): InsertFn {
  const values = vi.fn().mockImplementation((arg: OrgStepRow[]) => {
    captured.valuesArg = arg;
    return Promise.resolve();
  });
  const insert: InsertFn = vi.fn().mockReturnValue({ values }) as unknown as InsertFn;
  return insert;
}

export function createUpdate(captured: { setArg?: OrgUpdateSetArg; whereArg?: unknown }): UpdateFn {
  const where = vi.fn().mockImplementation((arg: unknown) => {
    captured.whereArg = arg;
    return Promise.resolve();
  });
  const set = vi.fn().mockImplementation((arg: OrgUpdateSetArg) => {
    captured.setArg = arg;
    return { where };
  });
  const update: UpdateFn = vi.fn().mockReturnValue({ set }) as unknown as UpdateFn;
  return update;
}

export function buildMockDb(stepIds: string[]) {
  const capturedInsert: { valuesArg?: OrgStepRow[] } = {};
  const capturedUpdate: { setArg?: OrgUpdateSetArg; whereArg?: unknown } = {};

  const db: MockDb = {
    select: createSelect(stepIds),
    insert: createInsert(capturedInsert),
    update: createUpdate(capturedUpdate),
  };

  return { db, capturedInsert, capturedUpdate } as const;
}
