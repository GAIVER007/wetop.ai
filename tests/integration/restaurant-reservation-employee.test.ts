import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';
import { openTestShift } from '../tools/test-shift';

/**
 * Кто принял бронь стола (DATA_MODEL §33.6, миграция 142; закрывает Q-CALENDAR-2026-10-17): у стойки выбор в форме,
 * необязательно; только сотрудник того же бизнеса (проверка API и триггер базы). Вымышленные данные (ADR-010).
 */
describe('бронь стола: «Принял» (integration, §33.6)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: FoodService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    otherBusiness = randomUUID(),
    location = randomUUID();
  const ids = { period: '', me: '', foreign: '' };
  const at = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'STAFF', scope: 'LOCATION', businessId: business, locationId: location, vertical: 'FOOD_SERVICE' },
      fn,
    );
  const startsAt = (() => {
  // полдень по Алматы через 2 суток: «сейчас + N часов» в 23:00+ по Алматы выводило бронь за период 00:00–23:59
  // (CI 22.10.2026 16:38 UTC: «Бронь не помещается в период обслуживания»)
  const d = new Date(Date.now() + 2 * 86_400_000);
  return new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(d)}T12:00:00+05:00`);
})();
  const book = (extra: Record<string, unknown>) =>
    at(() =>
      svc.create(randomUUID(), {
        servicePeriodId: ids.period,
        startsAt: startsAt.toISOString(),
        partySize: 2,
        customer: { firstName: 'Гость Тестовый' },
        ...extra,
      }),
    );

  beforeAll(async () => {
    db = createPrismaClient(url);
    svc = new FoodService({ db } as unknown as PrismaService);
    await db.organization.create({ data: { id: org, name: 'Брони', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic admin', email: `resv-${user}@example.invalid` } });
    await db.business.createMany({
      data: [business, otherBusiness].map((id) => ({ id, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' as const })),
    });
    await db.location.create({ data: { id: location, businessId: business, name: 'Synthetic branch', timezone: 'Asia/Almaty', currency: 'KZT' } });
    // администратор пишет брони в открытую смену (владелец 27.10.2026, finance/shift-guard)
    await openTestShift(db, { organizationId: org, userId: user, locationId: location });
    ids.me = (await db.employee.create({ data: { businessId: business, name: 'Айгерим Официант' } })).id;
    ids.foreign = (await db.employee.create({ data: { businessId: otherBusiness, name: 'Чужой Официант' } })).id;
    const weekday = new Date(startsAt.getTime() + 5 * 3_600_000).getUTCDay();
    ids.period = (
      await db.servicePeriod.create({
        data: { locationId: location, name: 'Весь день', weekday, timeFrom: new Date('1970-01-01T00:00:00Z'), timeTo: new Date('1970-01-01T23:59:00Z'), defaultDurationMinutes: 60 },
      })
    ).id;
  });
  afterAll(async () => db?.$disconnect());

  it('стойка выбирает «Принял»: бронь и список показывают сотрудника; без выбора поле пустое', async () => {
    const r = await book({ employeeId: ids.me });
    expect(r.employee).toEqual({ id: ids.me, name: 'Айгерим Официант' });
    const plain = await book({});
    expect(plain.employee).toBeNull();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(startsAt);
    const list = await at(() => svc.reservations({ date: day }));
    expect(list.items.map((x) => x.employee?.name ?? null).sort()).toEqual(['Айгерим Официант', null].sort());
  });

  it('сотрудник другого бизнеса не принимается ни API, ни базой', async () => {
    await expect(book({ employeeId: ids.foreign })).rejects.toThrow('Сотрудник недоступен');
    const r = await book({});
    await expect(db.restaurantReservation.update({ where: { id: r.id }, data: { employeeId: ids.foreign } })).rejects.toThrow(
      /another business/,
    );
  });
});
