import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../database/property-ref', () => ({
  propertyIdRef: async () => '00000000-0000-4000-8000-000000000001',
  propertyToday: async () => '2026-10-09',
}));
vi.mock('../accounts/actor', () => ({ auditUserId: () => null }));

import { PrismaBarRepository } from './bar.repository';

/**
 * Продажа бара на счёт: начисление должно получить дату услуги (RPT2.3, `docs/metrics.md` §5, Q-292). Без неё оно не
 * попадало ни в один периодный отчёт (они отбирают начисления по `service_date`), хотя входило в остаток счёта.
 */
describe('бар на счёт: дата услуги начисления', () => {
  it('начисление создаётся с сегодняшней датой объекта', async () => {
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      // валюта объекта отвечает KZT (D-CUR), сверка истории закупок и замки строк — пусто
      $queryRaw: async (strings: TemplateStringsArray) =>
        strings.join('?').includes('SELECT currency FROM properties') ? [{ currency: 'KZT' }] : [],
      barSale: {
        findFirst: async () => null,
        create: async () => ({ id: 'sale-1' }),
      },
      folio: { findFirst: async () => ({ id: 'f1', currency: 'KZT' }) },
      barProduct: { findFirst: async () => ({ id: 'p1', name: 'Вода', salePrice: 50_000n }) },
      barStockLot: {
        findMany: async () => [
          { id: 'l1', receivedAt: new Date('2026-10-01T00:00:00Z'), remainingUnits: 10n, unitCost: 20_000n },
        ],
        update: async () => ({}),
      },
      barStockMovement: { create: async () => ({}) },
      charge: {
        create: async (args: { data: Record<string, unknown> }) => {
          created.push(args.data);
          return { id: 'c1' };
        },
      },
      auditLog: { create: async () => ({}) },
    };
    const prisma = { db: { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
    const repo = new PrismaBarRepository(prisma as never);
    const result = await repo.sellToFolio({
      folioId: 'f1',
      productId: 'p1',
      quantityUnits: 2n,
      idempotencyKey: 'k-1',
    } as never);
    expect(result.kind).toBe('posted');
    expect(created).toHaveLength(1);
    expect(created[0]?.serviceDate).toEqual(new Date('2026-10-09T00:00:00Z'));
  });
});
