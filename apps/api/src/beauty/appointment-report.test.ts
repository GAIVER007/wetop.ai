import { describe, expect, it, vi } from 'vitest';
import { BeautyAppointmentsService } from './appointments';
import type { PrismaService } from '../database/prisma.provider';
vi.mock('./scope', async (original) => ({
  ...await original<typeof import('./scope')>(),
  mayBeauty: vi.fn(),
  beautyScope: vi.fn().mockResolvedValue({ organizationId: 'org', businessId: 'business',
    locationId: 'salon', locationName: 'Тестовый салон', locationCurrency: 'KZT', locationTimezone: 'Asia/Almaty' }),
}));
describe('appointment report cash projection', () => {
  it('returns exact receipt amounts by method while keeping refunds separate and location scoped', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 'record', employeeId: 'master', serviceId: 'service',
      service: { name: 'Тестовая услуга' }, employee: { name: 'Мастер' },
      customer: { id: 'fictional', firstName: 'Тест', lastName: null, phone: null },
      startsAt: new Date('2026-10-12T05:00:00Z'), endsAt: new Date('2026-10-12T06:00:00Z'),
      status: 'DONE', price: 100n, currency: 'KZT', notes: null,
      lines: [{ id: 'line', position: 0, employeeId: 'master', serviceId: 'service',
        startsAt: new Date('2026-10-12T05:00:00Z'), endsAt: new Date('2026-10-12T06:00:00Z'),
        basePriceMinor: 100n, discountMinor: 0n, surchargeMinor: 0n, priceMinor: 100n,
        currency: 'KZT', discountPercent: null, employee: { name: 'Мастер' }, service: { name: 'Тестовая услуга' } }],
      payments: [{ kind: 'INCOME', method: 'CASH', amount: 9007199254740993n },
        { kind: 'INCOME', method: 'CARD_TERMINAL', amount: 60n },
        { kind: 'INCOME', method: 'KASPI', amount: 40n },
        { kind: 'EXPENSE', method: 'CASH', amount: 20n }] }]);
    const db = { employeeServicePrice: { findMany: vi.fn().mockResolvedValue([]) },
      beautyLocationHours: { findUnique: vi.fn().mockResolvedValue(null) }, employee: { findMany: vi.fn().mockResolvedValue([]) },
      appointment: { findMany }, beautyService: { findMany: vi.fn().mockResolvedValue([]) } };
    const result = await new BeautyAppointmentsService({ db } as unknown as PrismaService).day('2026-10-12');
    expect(result.appointments[0]).toMatchObject({ paidCashMinor: '9007199254740993', paidNonCashMinor: '100',
      paidMinor: '9007199254741093', refundedMinor: '20' });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { locationId: 'salon', lines: { some: {
        startsAt: { lt: new Date('2026-10-12T19:00:00Z') },
        endsAt: { gt: new Date('2026-10-11T19:00:00Z') },
      } } },
      select: expect.objectContaining({ payments: { where: { status: 'COMPLETED' }, select: { kind: true, amount: true, method: true } } }),
    }));
  });
});
