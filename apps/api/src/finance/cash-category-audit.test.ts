import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { PrismaFinanceRepository } from './finance.repository';
import type { PrismaService } from '../database/prisma.provider';

it('переименование статьи сохраняет старое и новое значение под блокировкой', async () => {
  const create = vi.fn();
  const current = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Старая статья',
    active: true,
  };
  const query = vi.fn().mockResolvedValue([current]);
  const tx = {
    $queryRaw: query,
    cashCategory: { update: vi.fn().mockResolvedValue({ ...current, name: 'Новая статья' }) },
    auditLog: { create },
  };
  const db = {
    property: { findFirst: async () => ({ id: '22222222-2222-4222-8222-222222222222' }) },
    cashCategory: { findFirst: async () => current },
    $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx),
  };
  await new PrismaFinanceRepository({ db } as unknown as PrismaService).updateCashCategory(
    current.id,
    { name: 'Новая статья' },
    {
      entityType: 'CashCategory',
      entityId: current.id,
      action: 'finance.cash.category.updated',
      after: { name: 'Новая статья' },
    },
  );
  expect(query).toHaveBeenCalled();
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        before: { name: 'Старая статья', active: true },
        after: { name: 'Новая статья', active: true },
      }),
    }),
  );
});
