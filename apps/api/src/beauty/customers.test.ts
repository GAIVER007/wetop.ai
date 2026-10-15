import { describe, expect, it, vi } from 'vitest';
import { BeautyCatalogService } from './beauty.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

describe('Последний визит клиента в поясе филиала', () => {
  it('отдаёт локальную дату последнего завершённого визита', async () => {
    const db = {
      business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
      customer: { findMany: vi.fn().mockResolvedValue([
        { id: 'customer', firstName: 'Тестовый клиент', lastName: null, phone: null, status: 'ACTIVE' },
      ]) },
      appointment: {
        groupBy: vi.fn().mockResolvedValue([
          { customerId: 'customer', currency: 'KZT', _count: { _all: 1 },
            _sum: { price: 800000n }, _max: { startsAt: new Date('2026-10-11T19:30:00Z') } },
        ]),
        findMany: vi.fn().mockResolvedValue([
          { customerId: 'customer', startsAt: new Date('2026-10-11T19:30:00Z'), location: { timezone: 'Asia/Almaty' } },
        ]),
      },
    };
    const service = new BeautyCatalogService({ db } as unknown as PrismaService);
    const result = await withSignedInUser({
      userId: 'user', organizationId: 'org', role: 'OWNER', scope: 'BUSINESS',
      businessId: 'business', vertical: 'BEAUTY',
    }, () => service.customers());
    expect(result.items[0]).toMatchObject({ lastVisitLocalDate: '2026-10-12' });
    expect(db.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'DONE', location: { businessId: 'business' } },
      distinct: ['customerId'],
    }));
  });
});
