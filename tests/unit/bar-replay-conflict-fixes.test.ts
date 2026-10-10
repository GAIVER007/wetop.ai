import { describe, expect, it, vi } from 'vitest';
import { PrismaBarRepository } from '../../apps/api/src/bar/bar.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
vi.mock('../../apps/api/src/database/property-ref', () => ({ propertyIdRef: async () => '00000000-0000-4000-8000-000000000001' }));
const propertyId = '00000000-0000-4000-8000-000000000001';
const productId = '00000000-0000-4000-8000-000000000002';
const input = { productId, quantityUnits: 1n, method: 'CASH', idempotencyKey: 'opaque' };
const sale = { id: 'source', folioId: null, chargeId: null, cashOperationId: 'cash', status: 'REVERSED', totalRevenue: 15000n, totalCost: 10000n, lines: [{ productId, quantityUnits: 1n }], cashOperation: { method: 'CASH' } };
describe('D-KEY exact unique-conflict handling after transaction rollback', () => {
  it('rereads a committed same-key operation through a fresh scoped transaction', async () => {
    const findFirst = vi.fn().mockResolvedValue(sale);
    const transaction = vi.fn().mockRejectedValueOnce({ code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { index: 'bar_sales_property_id_idempotency_key_key' } } } } })
      .mockImplementationOnce((run: (tx: unknown) => Promise<unknown>) => run({ barSale: { findFirst } }));
    const repo = new PrismaBarRepository({ db: { $transaction: transaction } } as unknown as PrismaService);
    expect(await repo.sellRetail(input)).toMatchObject({ id: 'source', status: 'REVERSED', revenueMinor: '15000' });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { propertyId, idempotencyKey: input.idempotencyKey } }));
  });
  it.each([
    { code: 'P2002', meta: { driverAdapterError: { cause: { constraint: { index: 'bar_sales_cash_operation_id_key' } } } } },
    { code: 'P2003', meta: {} },
  ])('does not mask a different database error', async error => {
    const transaction = vi.fn().mockRejectedValue(error);
    const repo = new PrismaBarRepository({ db: { $transaction: transaction } } as unknown as PrismaService);
    await expect(repo.sellRetail(input)).rejects.toBe(error);expect(transaction).toHaveBeenCalledTimes(1);
  });
});
