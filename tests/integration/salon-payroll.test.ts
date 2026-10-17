import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * Зарплата мастеров салона (DATA_MODEL §19.2, ADR-SALON-PAYROLL-20261016): таблицы ресторана §33.4, процент от
 * выполненных записей мастера за месяц, выплата расходом кассы филиала салона. Вымышленные данные (ADR-010).
 */
describe('зарплата мастеров салона (integration, §19.2)', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Проверяется только на локальной PostgreSQL');
  let db: Db, svc: RestaurantService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location = randomUUID();
  const at = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', businessId: business, locationId: location, vertical: 'BEAUTY' },
      fn,
    );
  // середина месяца по Алматы: 15 октября 2026, 10:00 местного это 05:00 UTC
  const month = '2026-10';
  let master = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: org, name: 'Зарплата салона', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `payroll-${user}@example.invalid` } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Салон', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: location, businessId: business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    master = (await db.employee.create({ data: { businessId: business, name: 'Мастер Дина' } })).id;
    const customer = await db.customer.create({ data: { organizationId: org, firstName: 'Айгуль' } });
    const service = await db.beautyService.create({ data: { businessId: business, name: 'Окрашивание', durationMinutes: 60, price: 800000n, currency: 'KZT' } });
    await db.employeeLocation.create({ data: { employeeId: master, locationId: location } });
    await db.employeeService.create({ data: { employeeId: master, serviceId: service.id } });
    await db.locationService.create({ data: { locationId: location, serviceId: service.id, enabled: true } });
    const visit = (startsAt: string, status: 'DONE' | 'BOOKED') =>
      db.appointment.create({
        data: {
          locationId: location, customerId: customer.id, employeeId: master, serviceId: service.id,
          startsAt: new Date(startsAt), endsAt: new Date(new Date(startsAt).getTime() + 3_600_000), status, price: 800000n, currency: 'KZT',
        },
      });
    await visit('2026-10-15T05:00:00Z', 'DONE');
    await visit('2026-10-16T05:00:00Z', 'BOOKED');
    // выполненная, но в прошлом месяце по Алматы: 30 сентября 23:30 местного
    await visit('2026-09-30T18:30:00Z', 'DONE');
  });
  afterAll(async () => db?.$disconnect());

  const row = async () => {
    const out = (await at(() => svc.payroll({ month }))) as { rows: Array<{ employeeId: string; salesMinor: string; percentMinor: string; totalMinor: string; remainingMinor: string }> };
    return out.rows.find((r) => r.employeeId === master)!;
  };

  it('процент от выполненных записей месяца, выплата из кассы салона не больше остатка и наличия', async () => {
    await at(() => svc.setPaySettings(master, { model: 'PERCENT', fixedMinor: 0, percent: 10 }));
    expect(await row()).toMatchObject({ salesMinor: '800000', percentMinor: '80000', totalMinor: '80000', remainingMinor: '80000' });
    // в кассе филиала пусто: выплатить нельзя
    await expect(at(() => svc.payout(master, { period: month, method: 'CASH', amount: 50000 }))).rejects.toThrow('В кассе по этому способу меньше этой суммы');
    await at(() => svc.cashOperation({ kind: 'INCOME', method: 'CASH', amount: 100000, note: 'Синтетика' }));
    await expect(at(() => svc.payout(master, { period: month, method: 'CASH', amount: 80001 }))).rejects.toThrow('Сумма больше остатка к выплате');
    await at(() => svc.payout(master, { period: month, method: 'CASH', amount: 80000 }));
    expect(await row()).toMatchObject({ remainingMinor: '0' });
    const op = await db.restaurantCashOperation.findFirstOrThrow({ where: { locationId: location, employeeId: master } });
    expect([op.kind, op.amount, op.period?.toISOString().slice(0, 10)]).toEqual(['EXPENSE', 80000n, '2026-10-01']);
  });
});
