import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { BeautyCustomerImportService, CustomerImportService } from './customer-import';

const previewActor = {
  userId: 'user',
  organizationId: 'org',
  role: 'OWNER' as const,
  scope: 'BUSINESS' as const,
  businessId: 'business',
  vertical: 'BEAUTY' as const,
};

function database(existing: Array<{ id: string; firstName: string; lastName: string | null; phone: string; status: 'ACTIVE' | 'ARCHIVED' }> = []) {
  const db = {
    organization: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }) },
    business: { findFirst: vi.fn().mockResolvedValue({ id: 'business', name: 'Тестовый салон' }) },
    customer: {
      findMany: vi.fn().mockResolvedValue(existing),
      findFirst: vi.fn().mockImplementation(({ where }: { where: { phone: string } }) => Promise.resolve(existing.find((row) => row.phone === where.phone) ?? null)),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'created', status: 'ACTIVE', ...data })),
    },
    customerBusiness: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return {
    ...db,
    $transaction: vi.fn(async (fn: (tx: typeof db) => unknown) => fn(db)),
  };
}

describe('D1/D2: клиент без записи и безопасный импорт', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preview ничего не пишет и различает создание, точный повтор и конфликт имени', async () => {
    const db = database([
      { id: 'same', firstName: 'Точный Клиент', lastName: null, phone: '+77011111111', status: 'ACTIVE' },
      { id: 'conflict', firstName: 'Другое Имя', lastName: null, phone: '+77012222222', status: 'ACTIVE' },
    ]);
    const service = new BeautyCustomerImportService({ db } as unknown as PrismaService);
    const csv = 'Имя;Телефон\nНовый Клиент;+77010000000\nТочный Клиент;8 701 111 11 11\nНовое Имя;+77012222222';
    const result = await withSignedInUser(previewActor, () => service.preview({ csv }));
    expect(result.rows.map((row) => ({ line: row.line, status: row.status }))).toEqual([
      { line: 2, status: 'CREATE' },
      { line: 3, status: 'ALREADY_EXISTS' },
      { line: 4, status: 'CONFLICT' },
    ]);
    expect(result.totals).toEqual({ create: 1, alreadyExists: 1, conflicts: 1, duplicatesInFile: 0 });
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.customerBusiness.createMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('apply повторно сверяет CSV и при конфликте не пишет частичный импорт', async () => {
    const db = database([
      { id: 'conflict', firstName: 'Другое Имя', lastName: null, phone: '+77012222222', status: 'ACTIVE' },
    ]);
    const service = new BeautyCustomerImportService({ db } as unknown as PrismaService);
    const csv = 'Имя;Телефон\nНовый Клиент;+77010000000\nНовое Имя;+77012222222';
    await expect(withSignedInUser(previewActor, () => service.apply({ csv }))).rejects.toBeInstanceOf(ConflictException);
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.customerBusiness.createMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

const actor = {
  userId: '00000000-0000-4000-8000-000000000011',
  organizationId: '00000000-0000-4000-8000-000000000012',
  role: 'OWNER' as 'OWNER' | 'STAFF',
  scope: 'BUSINESS' as const,
  businessId: '00000000-0000-4000-8000-000000000013',
  vertical: 'BEAUTY' as const,
};

const requestId = '00000000-0000-4000-8000-000000000014';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000015',
    organizationId: actor.organizationId,
    businessId: actor.businessId,
    createdBy: actor.userId,
    clientRequestId: requestId,
    requestDigest: createHash('sha256')
      .update(JSON.stringify({ totalRows: 2 }))
      .digest('hex'),
    state: 'UPLOADING',
    totalRows: 2,
    uploadedRows: 0,
    processedRows: 0,
    createdCount: 0,
    linkedCount: 0,
    unchangedCount: 0,
    skippedCount: 0,
    uploadReceipts: {},
    leaseToken: null,
    leaseExpiresAt: null,
    attempts: 0,
    nextAttemptAt: null,
    errorCode: null,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
    updatedAt: new Date('2026-10-18T12:00:00.000Z'),
    completedAt: null,
    undoDeadline: null,
    contentsExpireAt: new Date('2026-11-17T12:00:00.000Z'),
    ...overrides,
  };
}

function fixture() {
  const saved = row();
  const db = {
    organization: {
      findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }),
    },
    business: { findFirst: vi.fn().mockResolvedValue({ id: actor.businessId }) },
    customerImport: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(saved),
      findMany: vi.fn().mockResolvedValue([saved]),
      create: vi.fn().mockResolvedValue(saved),
      update: vi.fn().mockImplementation(async ({ data }) => ({ ...saved, ...data })),
    },
    customerImportRow: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: { findFirst: vi.fn().mockResolvedValue({ id: actor.userId }) },
    membership: { findFirst: vi.fn().mockResolvedValue({ userId: actor.userId }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  return db;
}

describe('CustomerImportService', () => {
  let db: ReturnType<typeof fixture>;
  let service: CustomerImportService;

  beforeEach(() => {
    actor.role = 'OWNER';
    db = fixture();
    service = new CustomerImportService({ db } as unknown as PrismaService);
  });
  afterEach(() => vi.useRealTimers());

  const asActor = <T>(fn: () => Promise<T>) => withSignedInUser(actor, fn);

  it('starts an owner import in the server-derived organization and business', async () => {
    const result = await asActor(() =>
      service.start({
        clientRequestId: requestId,
        totalRows: 2,
        organizationId: '00000000-0000-4000-8000-000000000099',
        businessId: '00000000-0000-4000-8000-000000000098',
      }),
    );
    expect(result).toMatchObject({ state: 'UPLOADING', totalRows: 2, uploadedRows: 0 });
    expect(db.customerImport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: actor.organizationId,
        businessId: actor.businessId,
        createdBy: actor.userId,
        clientRequestId: requestId,
        state: 'UPLOADING',
      }),
    });
  });

  it('returns the same job for the same start request and rejects a changed request', async () => {
    db.customerImport.findUnique.mockResolvedValue(row());
    const same = await asActor(() => service.start({ clientRequestId: requestId, totalRows: 2 }));
    expect(same.id).toBe(row().id);
    db.customerImport.findUnique.mockResolvedValue(row({ requestDigest: 'another' }));
    await expect(
      asActor(() => service.start({ clientRequestId: requestId, totalRows: 2 })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechecks idempotency inside the locked transaction before create', async () => {
    db.customerImport.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(row());
    const result = await asActor(() => service.start({ clientRequestId: requestId, totalRows: 2 }));
    expect(result).toMatchObject({ id: row().id, state: 'UPLOADING' });
    expect(db.customerImport.create).not.toHaveBeenCalled();
  });

  it('stores one ordered chunk and repeats the same digest as a no-op', async () => {
    const body = {
      offset: 0,
      rows: [
        { sourceLine: 2, firstName: 'Тест', lastName: null, phone: '+77000000001' },
        { sourceLine: 3, firstName: '', lastName: '', phone: '+77000000002' },
      ],
    };
    const first = await asActor(() => service.uploadRows(row().id, body));
    expect(first.uploadedRows).toBe(2);
    expect(db.customerImportRow.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ ordinal: 0, sourceLine: 2 }),
        expect.objectContaining({ ordinal: 1, sourceLine: 3 }),
      ],
    });
    db.customerImport.findFirst.mockResolvedValue(
      row({
        uploadedRows: 2,
        uploadReceipts: { '0': createHash('sha256').update(JSON.stringify(body)).digest('hex') },
      }),
    );
    await asActor(() => service.uploadRows(row().id, body));
    expect(db.customerImportRow.createMany).toHaveBeenCalledTimes(1);
  });

  it('returns the same receipt after the import has completed', async () => {
    const body = {
      offset: 0,
      rows: [{ sourceLine: 2, firstName: 'Тест', lastName: null, phone: '+77000000001' }],
    };
    db.customerImport.findFirst.mockResolvedValue(
      row({
        state: 'COMPLETED',
        uploadedRows: 1,
        processedRows: 1,
        totalRows: 1,
        uploadReceipts: { '0': createHash('sha256').update(JSON.stringify(body)).digest('hex') },
      }),
    );
    await expect(asActor(() => service.uploadRows(row().id, body))).resolves.toMatchObject({
      state: 'COMPLETED',
      uploadedRows: 1,
    });
    expect(db.customerImportRow.createMany).not.toHaveBeenCalled();
  });

  it('rejects a changed repeat chunk without changing rows', async () => {
    db.customerImport.findFirst.mockResolvedValue(
      row({ uploadedRows: 2, uploadReceipts: { '0': 'other-digest' } }),
    );
    await expect(
      asActor(() =>
        service.uploadRows(row().id, {
          offset: 0,
          rows: [{ sourceLine: 2, firstName: 'Другое', lastName: null, phone: '+77000000001' }],
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.customerImportRow.createMany).not.toHaveBeenCalled();
  });

  it('submits only a complete upload and keeps aggregate DTO free of row PII', async () => {
    db.customerImport.findFirst.mockResolvedValue(row({ uploadedRows: 2 }));
    const result = await asActor(() => service.submit(row().id));
    expect(result.state).toBe('QUEUED');
    expect(JSON.stringify(result)).not.toContain('+7700');
  });

  it('keeps every management and report endpoint owner-only', async () => {
    actor.role = 'STAFF';
    await expect(asActor(() => service.get(row().id))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(asActor(() => service.rows(row().id, '0'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      asActor(() => service.start({ clientRequestId: requestId, totalRows: 2 })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('checks the undo deadline with fresh time after database locks', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-18T12:00:00.000Z'));
    db.customerImport.findFirst.mockResolvedValue(
      row({
        state: 'COMPLETED',
        processedRows: 1,
        createdCount: 1,
        completedAt: new Date('2026-10-18T11:00:00.000Z'),
        undoDeadline: new Date('2026-10-18T12:00:01.000Z'),
      }),
    );
    let lockCalls = 0;
    db.$queryRaw.mockImplementation(async () => {
      lockCalls += 1;
      if (lockCalls === 1) return [{ locked: true }];
      if (lockCalls === 4) vi.setSystemTime(new Date('2026-10-18T12:00:02.000Z'));
      return [];
    });
    await expect(asActor(() => service.undo(row().id))).rejects.toBeInstanceOf(ConflictException);
    expect(db.customerImport.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { state: 'UNDOING' } }),
    );
  });
});
