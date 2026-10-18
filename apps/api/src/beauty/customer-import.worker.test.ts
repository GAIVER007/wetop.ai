import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.provider';
import { CustomerImportWorker } from './customer-import.worker';

const claim = {
  id: '00000000-0000-4000-8000-000000000021',
  organizationId: '00000000-0000-4000-8000-000000000022',
  businessId: '00000000-0000-4000-8000-000000000023',
  leaseToken: 'lease-token',
};

function fixture() {
  const db = {
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    customerImport: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    customerImportRow: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findFirst: vi.fn() },
    membership: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
    business: { findFirst: vi.fn() },
    customer: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    customerBusiness: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      createMany: vi.fn(),
      delete: vi.fn(),
    },
    appointment: { count: vi.fn().mockResolvedValue(0) },
    restaurantReservation: { count: vi.fn().mockResolvedValue(0) },
    restaurantOrder: { count: vi.fn().mockResolvedValue(0) },
    auditLog: { create: vi.fn() },
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return db;
}

function allowProcessLocks(db: ReturnType<typeof fixture>) {
  db.$queryRaw
    .mockResolvedValueOnce([{ locked: true }])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
}

describe('CustomerImportWorker', () => {
  let db: ReturnType<typeof fixture>;
  let worker: CustomerImportWorker;

  beforeEach(() => {
    db = fixture();
    worker = new CustomerImportWorker({ db } as unknown as PrismaService);
  });

  it('claims one queued job with a fresh lease token and no parent locks', async () => {
    db.$queryRaw.mockResolvedValueOnce([
      { ...claim, organization_id: claim.organizationId, business_id: claim.businessId },
    ]);
    db.$queryRaw.mockResolvedValueOnce([{ id: claim.id }]);
    await expect(worker.claim()).resolves.toMatchObject({
      id: claim.id,
      leaseToken: expect.any(String),
    });
    expect(db.$queryRaw.mock.calls.flat().join(' ')).not.toContain('organizations FOR UPDATE');
  });

  it('revalidates active owner, organization and salon for every processing batch', async () => {
    allowProcessLocks(db);
    db.user.findFirst.mockResolvedValue({ id: 'actor' });
    db.membership.findFirst.mockResolvedValue({ role: 'OWNER' });
    db.organization.findUnique.mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null });
    db.business.findFirst.mockResolvedValue({ id: claim.businessId });
    db.customerImport.findUnique.mockResolvedValue({
      ...claim,
      state: 'PROCESSING',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    await worker.process(claim);
    expect(db.user.findFirst).toHaveBeenCalled();
    expect(db.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: claim.organizationId, role: 'OWNER' }),
      }),
    );
    expect(db.organization.findUnique).toHaveBeenCalled();
    expect(db.business.findFirst).toHaveBeenCalled();
  });

  it('fences every checkpoint update by the lease token', async () => {
    allowProcessLocks(db);
    db.customerImport.findUnique.mockResolvedValue({
      ...claim,
      state: 'PROCESSING',
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    db.user.findFirst.mockResolvedValue({ id: 'actor' });
    db.membership.findFirst.mockResolvedValue({ role: 'OWNER' });
    db.organization.findUnique.mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null });
    db.business.findFirst.mockResolvedValue({ id: claim.businessId });
    await worker.process(claim);
    expect(db.customerImport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: claim.id, leaseToken: claim.leaseToken }),
      }),
    );
  });

  it('clears retained input and baselines only for expired terminal jobs', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ id: claim.id }]);
    await expect(worker.purgeExpiredContents()).resolves.toBe(1);
    expect(db.customerImportRow.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { input: expect.anything(), customerBaseline: expect.anything(), linkBaseline: null },
      }),
    );
  });

  it('runs bounded retention even while import jobs remain queued', async () => {
    vi.spyOn(worker, 'claim').mockResolvedValue(claim);
    vi.spyOn(worker, 'process').mockResolvedValue(false);
    const purge = vi.spyOn(worker, 'purgeExpiredContents').mockResolvedValue(1);
    await expect(worker.tick()).resolves.toBe(claim.id);
    expect(purge).toHaveBeenCalledTimes(1);
  });

  it('records a safe terminal audit when an abandoned upload expires', async () => {
    db.$queryRaw.mockResolvedValueOnce([
      {
        id: claim.id,
        state: 'UPLOADING',
        organizationId: claim.organizationId,
        createdBy: 'actor',
        totalRows: 2,
        uploadedRows: 1,
        processedRows: 0,
        createdCount: 0,
        linkedCount: 0,
        unchangedCount: 0,
        skippedCount: 0,
      },
    ]);
    await expect(worker.purgeExpiredContents()).resolves.toBe(1);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: claim.organizationId,
        entityId: claim.id,
        action: 'beauty.customer_import.failed',
        after: { errorCode: 'UPLOAD_EXPIRED', totalRows: 2, uploadedRows: 1, processedRows: 0 },
      }),
    });
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('phone');
  });

  it('selects and clears an expired terminal job that retains only receipt hashes', async () => {
    db.$queryRaw.mockResolvedValueOnce([
      {
        id: claim.id,
        state: 'COMPLETED',
        organizationId: claim.organizationId,
        createdBy: 'actor',
        totalRows: 1,
        uploadedRows: 1,
        processedRows: 1,
      },
    ]);
    await expect(worker.purgeExpiredContents()).resolves.toBe(1);
    const queryText = (db.$queryRaw.mock.calls[0]?.[0] as readonly string[]).join(' ');
    expect(queryText).toContain('upload_receipts');
    expect(db.customerImport.update).toHaveBeenCalledWith({
      where: { id: claim.id },
      data: { uploadReceipts: {} },
    });
  });

  it('rechecks customer status after the ordered customer lock', async () => {
    let status = 'ACTIVE';
    let rawCalls = 0;
    db.$queryRaw.mockImplementation(async () => {
      rawCalls += 1;
      if (rawCalls === 1) return [{ locked: true }];
      if (rawCalls === 5) return [{ id: 'row-1' }];
      if (rawCalls === 6) status = 'ARCHIVED';
      return [];
    });
    db.customerImport.findUnique.mockResolvedValue({
      ...claim,
      createdBy: 'actor',
      state: 'PROCESSING',
      leaseExpiresAt: new Date(Date.now() + 60_000),
      processedRows: 0,
      totalRows: 1,
      createdCount: 0,
      linkedCount: 0,
      unchangedCount: 0,
      skippedCount: 0,
      attempts: 1,
    });
    db.user.findFirst.mockResolvedValue({ id: 'actor' });
    db.membership.findFirst.mockResolvedValue({ role: 'OWNER' });
    db.organization.findUnique.mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null });
    db.business.findFirst.mockResolvedValue({ id: claim.businessId });
    db.customerImportRow.findMany.mockResolvedValue([
      {
        id: 'row-1',
        ordinal: 0,
        input: { firstName: 'Тест', lastName: null, phone: '+77010000001' },
      },
    ]);
    db.customer.findMany.mockImplementation(async () => [
      {
        id: 'customer-1',
        organizationId: claim.organizationId,
        firstName: 'Старый',
        lastName: null,
        phone: '+77010000001',
        phoneNormalized: '+77010000001',
        email: null,
        notes: null,
        status,
        isVip: false,
        birthDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    await worker.process(claim);
    expect(db.customerBusiness.createMany).not.toHaveBeenCalled();
    expect(db.customerImportRow.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: 'SKIPPED', errorCode: 'CUSTOMER_ARCHIVED' }),
      }),
    );
  });
});
