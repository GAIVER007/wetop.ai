import { describe, expect, it, vi } from 'vitest';
import { BeautyAppointmentsService } from './appointments';
import { withSignedInUser } from '../auth/request-context';
import type { PrismaService } from '../database/prisma.provider';

const actor = {
  userId: 'user', organizationId: 'org', role: 'OWNER' as const,
  scope: 'LOCATION' as const, businessId: 'business', locationId: 'location', vertical: 'BEAUTY' as const,
};

function fixture(opening: unknown, appointments: unknown[] = []) {
  const db = {
    organization: { findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', trialEndsAt: null }) },
    business: { findFirst: vi.fn().mockResolvedValue({ id: 'business' }) },
    location: { findFirst: vi.fn().mockResolvedValue({ id: 'location', name: 'Тестовый салон', currency: 'KZT', timezone: 'Asia/Almaty' }) },
    employee: { findMany: vi.fn().mockResolvedValue([]) },
    beautyService: { findMany: vi.fn().mockResolvedValue([]) },
    employeeServicePrice: { findMany: vi.fn().mockResolvedValue([]) },
    beautyLocationHours: { findUnique: vi.fn().mockResolvedValue(opening) },
    appointment: { findMany: vi.fn().mockResolvedValue(appointments) },
    restaurantCashOperation: { groupBy: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const service = new BeautyAppointmentsService({ db } as unknown as PrismaService);
  return { run: <T>(fn: () => Promise<T>) => withSignedInUser(actor, fn), service };
}

describe('B4 (паритет с zapis.kz): границы сетки журнала от часов салона', () => {
  // 2026-10-18 - воскресенье, weekday 0
  it('при заданном режиме дня сетка идёт по нему, а не по жёстким 08-20', async () => {
    const f = fixture({ intervals: [{ weekday: 0, timeFrom: '10:00', timeTo: '22:00' }] });
    const day = await f.run(() => f.service.day('2026-10-18'));
    expect(day.bounds).toEqual({ fromMinutes: 600, toMinutes: 1320 });
  });
  it('без настроенного режима остаются прежние 08-20', async () => {
    const f = fixture(null);
    const day = await f.run(() => f.service.day('2026-10-18'));
    expect(day.bounds).toEqual({ fromMinutes: 480, toMinutes: 1200 });
  });
  it('запись за пределами режима расширяет сетку, чтобы её было видно', async () => {
    const row = {
      id: '00000000-0000-4000-8000-000000000002', employeeId: 'employee', serviceId: 'service',
      startsAt: new Date('2026-10-18T03:00:00Z'), endsAt: new Date('2026-10-18T04:00:00Z'),
      status: 'BOOKED', price: 1000n, currency: 'KZT', notes: null,
      service: { name: 'Услуга' }, employee: { name: 'Мастер' },
      customer: { id: 'customer', firstName: 'Тест', lastName: null, phone: null },
      payments: [], lines: [], source: 'DESK', createdBy: null,
    };
    // 03:00Z = 08:00 в Алматы, раньше открытия в 10:00
    const f = fixture({ intervals: [{ weekday: 0, timeFrom: '10:00', timeTo: '22:00' }] }, [row]);
    const day = await f.run(() => f.service.day('2026-10-18'));
    expect(day.bounds.fromMinutes).toBe(480);
    expect(day.bounds.toMinutes).toBe(1320);
  });
});
