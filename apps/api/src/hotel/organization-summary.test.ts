import { describe, expect, it, vi } from 'vitest';
import { OrganizationSummaryService } from './organization-summary';
import { withSignedInUser } from '../auth/request-context';
const actor = (fn: () => Promise<unknown>) =>
  withSignedInUser({ userId: 'user', organizationId: 'org', role: 'OWNER' }, fn);
const location = {
  id: 'location',
  name: 'Hotel',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
  business: { id: 'business', vertical: 'HOSPITALITY' },
  property: { id: 'property' },
};
describe('organization paid revenue', () => {
  it('uses completed payments, keeps currencies separate and counts paid orders once', async () => {
    const db = {
      location: { findMany: vi.fn().mockResolvedValue([location]) },
      payment: {
        groupBy: vi.fn().mockResolvedValue([
          { currency: 'KZT', _sum: { amount: 20000n } },
          { currency: 'USD', _sum: { amount: 1000n } },
        ]),
      },
      cashOperation: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 3000n } }) },
      $queryRaw: vi.fn().mockResolvedValue([
        { currency: 'KZT', orders: 2n, allocated: 20000n },
        { currency: 'USD', orders: 1n, allocated: 1000n },
      ]),
    };
    const result = (await actor(() =>
      new OrganizationSummaryService({ db } as never).report('2026-10-01', '2026-10-31'),
    )) as {
      currencies: Array<{
        currency: string;
        receiptsMinor: string;
        averageMinor: string | null;
        expensesMinor: string;
      }>;
    };
    expect(result.currencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          currency: 'KZT',
          receiptsMinor: '20000',
          averageMinor: '10000',
          expensesMinor: '3000',
        }),
        expect.objectContaining({
          currency: 'USD',
          receiptsMinor: '1000',
          averageMinor: '1000',
          expensesMinor: '0',
        }),
      ]),
    );
    expect(db.payment.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });
  it('поступления ресторанного филиала включают продажи бара, средний чек остаётся по оплатам (ADR-182)', async () => {
    const db = {
      location: {
        findMany: vi.fn().mockResolvedValue([
          { ...location, business: { id: 'business', vertical: 'FOOD_SERVICE' }, property: null },
        ]),
      },
      restaurantPayment: {
        groupBy: vi.fn().mockResolvedValue([{ currency: 'KZT', _sum: { amount: 50000n } }]),
      },
      barSale: {
        groupBy: vi.fn().mockResolvedValue([{ currency: 'KZT', _sum: { totalRevenue: 20000n } }]),
      },
      restaurantCashOperation: {
        groupBy: vi.fn().mockResolvedValue([{ currency: 'KZT', _sum: { amount: 3000n } }]),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ currency: 'KZT', orders: 2n, allocated: 50000n, orderIds: ['a', 'b'] }]),
    };
    const result = (await actor(() =>
      new OrganizationSummaryService({ db } as never).report('2026-10-01', '2026-10-31'),
    )) as {
      currencies: Array<{ currency: string; receiptsMinor: string; averageMinor: string | null; expensesMinor: string }>;
    };
    expect(result.currencies).toEqual([
      expect.objectContaining({
        currency: 'KZT',
        receiptsMinor: '70000',
        averageMinor: '25000',
        expensesMinor: '3000',
      }),
    ]);
    expect(db.barSale.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'POSTED' }) }),
    );
  });
  it('marks missing beauty payment data as unavailable instead of zero revenue', async () => {
    const db = {
      location: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { ...location, business: { id: 'business', vertical: 'BEAUTY' }, property: null },
          ]),
      },
    };
    const result = (await actor(() =>
      new OrganizationSummaryService({ db } as never).report('2026-10-01', '2026-10-31'),
    )) as { complete: boolean; rows: Array<{ state: string }> };
    expect(result.complete).toBe(false);
    expect(result.rows[0]?.state).toBe('UNAVAILABLE');
  });
});
