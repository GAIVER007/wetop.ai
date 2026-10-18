import { afterEach, describe, expect, it, vi } from 'vitest';
import { BeautyCatalogService } from './beauty.module';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

afterEach(() => vi.useRealTimers());
describe('Популярность услуг по решению Q-BS-7', () => {
  it('считает уникальные услуги в DONE-визитах за 30 местных дней выбранного бизнеса и филиала', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T01:00:00Z'));
    const db = {
      business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
      location: { findFirst: vi.fn().mockResolvedValue({ id: 'salon', timezone: 'Asia/Almaty', currency: 'KZT' }) },
      beautyService: { findMany: vi.fn().mockResolvedValue([
        { id: 'primary-service', name: 'Основная услуга', category: null, durationMinutes: 60, price: 800000n, currency: 'KZT', active: true, locations: [] },
        { id: 'secondary-service', name: 'Вторая услуга', category: null, durationMinutes: 30, price: 400000n, currency: 'KZT', active: true, locations: [] },
      ]) },
      // Старые writers тоже создают AppointmentLine через DB guard, поэтому legacy serviceId не источник отчёта.
      appointment: { groupBy: vi.fn().mockResolvedValue([
        { serviceId: 'primary-service', _count: { _all: 1 } },
      ]) },
      appointmentLine: { groupBy: vi.fn().mockResolvedValue([
        // В первом визите A, B, A: groupBy возвращает одну пару на услугу и визит.
        { serviceId: 'primary-service', appointmentId: 'visit-one' },
        { serviceId: 'secondary-service', appointmentId: 'visit-one' },
        // Во втором визите только A.
        { serviceId: 'primary-service', appointmentId: 'visit-two' },
      ]) },
    };
    const result = await withSignedInUser({ userId: 'user', organizationId: 'org', role: 'OWNER', scope: 'LOCATION',
      businessId: 'business', locationId: 'salon', vertical: 'BEAUTY' },
      () => new BeautyCatalogService({ db } as unknown as PrismaService).services());
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'primary-service', popularity: { completedVisits: 2, totalCompletedVisits: 2 } }),
      expect.objectContaining({ id: 'secondary-service', popularity: { completedVisits: 1, totalCompletedVisits: 2 } }),
    ]));
    expect(db.appointmentLine.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['serviceId', 'appointmentId'],
      where: { appointment: {
        locationId: 'salon',
        location: { businessId: 'business' },
        status: 'DONE',
        startsAt: {
          gte: new Date('2026-09-14T19:00:00Z'), lt: new Date('2026-10-14T19:00:00Z'),
        },
      } },
    }));
    expect(db.appointment.groupBy).not.toHaveBeenCalled();
  });
});
