import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeautyCatalogService } from './beauty.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

afterEach(() => vi.useRealTimers());
describe('Популярность услуг по решению Q-BS-7', () => {
  it('считает только DONE за 30 местных дней выбранного филиала', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T01:00:00Z'));
    const db = {
      business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
      location: { findFirst: vi.fn().mockResolvedValue({ id: 'salon', timezone: 'Asia/Almaty', currency: 'KZT' }) },
      beautyService: { findMany: vi.fn().mockResolvedValue([
        { id: 'service', name: 'Тестовая услуга', category: null, durationMinutes: 60, price: 800000n, currency: 'KZT', active: true, locations: [] },
      ]) },
      appointment: { groupBy: vi.fn().mockResolvedValue([
        { serviceId: 'service', _count: { _all: 3 } },
        { serviceId: 'other-service', _count: { _all: 1 } },
      ]) },
    };
    const result = await withSignedInUser({ userId: 'user', organizationId: 'org', role: 'OWNER', scope: 'LOCATION',
      businessId: 'business', locationId: 'salon', vertical: 'BEAUTY' },
      () => new BeautyCatalogService({ db } as unknown as PrismaService).services());
    expect(result.items[0]).toMatchObject({ popularity: { completedVisits: 3, totalCompletedVisits: 4 } });
    expect(db.appointment.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['serviceId'],
      where: { locationId: 'salon', status: 'DONE', startsAt: {
        gte: new Date('2026-09-14T19:00:00Z'), lt: new Date('2026-10-14T19:00:00Z'),
      } },
    }));
  });
});
