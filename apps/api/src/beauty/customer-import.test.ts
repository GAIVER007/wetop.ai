import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';
import { BeautyCustomerImportService } from './customer-import';

const actor = {
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

  it('создаёт клиента без записи и сохраняет нормализованный телефон', async () => {
    const db = database();
    const service = new BeautyCustomerImportService({ db } as unknown as PrismaService);
    const result = await withSignedInUser(actor, () => service.create({ firstName: 'Тестовый', lastName: 'Клиент', phone: '8 701 234 56 78' }));
    expect(result).toMatchObject({ id: 'created', firstName: 'Тестовый', lastName: 'Клиент', phone: '+77012345678' });
    expect(db.customer.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org', phone: '+77012345678' }),
    }));
    expect(db.customerBusiness.createMany).toHaveBeenCalledWith({
      data: [{ customerId: 'created', businessId: 'business' }],
      skipDuplicates: true,
    });
  });

  it('preview ничего не пишет и различает создание, точный повтор и конфликт имени', async () => {
    const db = database([
      { id: 'same', firstName: 'Точный Клиент', lastName: null, phone: '+77011111111', status: 'ACTIVE' },
      { id: 'conflict', firstName: 'Другое Имя', lastName: null, phone: '+77012222222', status: 'ACTIVE' },
    ]);
    const service = new BeautyCustomerImportService({ db } as unknown as PrismaService);
    const csv = 'Имя;Телефон\nНовый Клиент;+77010000000\nТочный Клиент;8 701 111 11 11\nНовое Имя;+77012222222';
    const result = await withSignedInUser(actor, () => service.preview({ csv }));
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
    await expect(withSignedInUser(actor, () => service.apply({ csv }))).rejects.toBeInstanceOf(ConflictException);
    expect(db.customer.create).not.toHaveBeenCalled();
    expect(db.customerBusiness.createMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
