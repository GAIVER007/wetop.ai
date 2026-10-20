import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import type { StockService } from '../../apps/api/src/food-service/stock.service';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * «Сколько принёс сотрудник» салона и ресторана на настоящей базе (docs/decisions/2026-10-20-personnel-revenue.md):
 * оплачено минус возвраты, окно периода, деление записи по цене услуг мастеров, заказ без официанта отдельно.
 */
describe.skipIf(!process.env.DATABASE_URL)('Staff revenue: salon and restaurant', () => {
  let db: Db;
  let svc: RestaurantService;
  const org = randomUUID();
  const user = randomUUID();
  const salon = { business: randomUUID(), location: randomUUID() };
  const food = { business: randomUUID(), location: randomUUID() };
  const as = <T>(v: 'BEAUTY' | 'FOOD_SERVICE', fn: () => Promise<T>) =>
    withSignedInUser(
      { userId: user, organizationId: org, role: 'OWNER', scope: 'LOCATION', vertical: v,
        businessId: v === 'BEAUTY' ? salon.business : food.business,
        locationId: v === 'BEAUTY' ? salon.location : food.location },
      fn,
    );
  type Rev = { period: string; items: Array<{ employeeId: string | null; paidMinor: string; refundedMinor: string; netMinor: string; currency: string }> };
  let anna: string, bota: string, waiter: string;
  // сейчас: вторник 20.10.2026 12:00 по Алматы
  const now = new Date('2026-10-20T07:00:00Z');

  beforeAll(async () => {
    if (!isLocalDatabase(process.env.DATABASE_URL!)) throw new Error('Own localhost DB required');
    db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
    svc = new RestaurantService({ db } as PrismaService, null, {} as StockService);
    await db.organization.create({ data: { id: org, name: 'Revenue synthetic', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `revenue-${user}@example.invalid`, name: 'Тестовый владелец' } });
    await db.business.create({ data: { id: salon.business, organizationId: org, name: 'Салон', vertical: 'BEAUTY' } });
    await db.business.create({ data: { id: food.business, organizationId: org, name: 'Ресторан', vertical: 'FOOD_SERVICE' } });
    for (const x of [salon, food])
      await db.location.create({ data: { id: x.location, businessId: x.business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    anna = (await db.employee.create({ data: { businessId: salon.business, name: 'Анна' } })).id;
    bota = (await db.employee.create({ data: { businessId: salon.business, name: 'Бота' } })).id;
    waiter = (await db.employee.create({ data: { businessId: food.business, name: 'Официант' } })).id;
    const customer = await db.customer.create({ data: { organizationId: org, firstName: 'Тестовая' } });
    const s1 = await db.beautyService.create({ data: { businessId: salon.business, name: 'Стрижка', durationMinutes: 60, price: 300000n, currency: 'KZT' } });
    const s2 = await db.beautyService.create({ data: { businessId: salon.business, name: 'Укладка', durationMinutes: 30, price: 700000n, currency: 'KZT' } });
    for (const [emp, svcId] of [[anna, s1.id], [bota, s2.id]] as const) {
      await db.employeeLocation.create({ data: { employeeId: emp, locationId: salon.location } });
      await db.employeeService.create({ data: { employeeId: emp, serviceId: svcId } });
      await db.locationService.create({ data: { locationId: salon.location, serviceId: svcId, enabled: true } });
    }
    // запись на двух мастеров: 3 000 и 7 000 тенге, оплачено 10 000, возврат 1 000 (вчера и сегодня)
    const visit = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      const a = await tx.appointment.create({ data: {
        locationId: salon.location, customerId: customer.id, employeeId: anna, serviceId: s1.id,
        startsAt: new Date('2026-10-20T04:00:00Z'), endsAt: new Date('2026-10-20T05:30:00Z'), status: 'DONE', price: 1000000n, currency: 'KZT',
      } });
      await tx.appointmentLine.createMany({ data: [
        { appointmentId: a.id, position: 0, employeeId: anna, serviceId: s1.id, startsAt: new Date('2026-10-20T04:00:00Z'), endsAt: new Date('2026-10-20T05:00:00Z'), basePriceMinor: 300000n, priceMinor: 300000n, currency: 'KZT' },
        { appointmentId: a.id, position: 1, employeeId: bota, serviceId: s2.id, startsAt: new Date('2026-10-20T05:00:00Z'), endsAt: new Date('2026-10-20T05:30:00Z'), basePriceMinor: 700000n, priceMinor: 700000n, currency: 'KZT' },
      ] });
      return a;
    });
    const cash = { locationId: salon.location, method: 'CASH' as const, currency: 'KZT', appointmentId: visit.id };
    await db.restaurantCashOperation.create({ data: { ...cash, kind: 'INCOME', amount: 1000000n, occurredAt: new Date('2026-10-20T06:00:00Z') } });
    await db.restaurantCashOperation.create({ data: { ...cash, kind: 'EXPENSE', amount: 100000n, occurredAt: new Date('2026-10-20T06:30:00Z') } });
    // аннулированная оплата не считается
    await db.restaurantCashOperation.create({ data: { ...cash, kind: 'INCOME', amount: 999n, status: 'VOIDED', voidedAt: new Date('2026-10-20T06:20:00Z'), occurredAt: new Date('2026-10-20T06:10:00Z') } });
    // прошлая неделя (пн 12.10): только в «месяце»
    await db.restaurantCashOperation.create({ data: { ...cash, kind: 'INCOME', amount: 50000n, occurredAt: new Date('2026-10-12T06:00:00Z') } });
    // ресторан: заказ официанта и заказ без официанта
    const order = async (waiterId: string | null, number: number) => db.restaurantOrder.create({ data: {
      locationId: food.location, number, waiterId, guestCount: 1, status: 'CLOSED', currency: 'KZT', total: 500000n,
    } });
    const o1 = await order(waiter, 1);
    const o2 = await order(null, 2);
    const pay = (orderId: string, amount: bigint, key: string) => db.restaurantPayment.create({ data: {
      locationId: food.location, orderId, method: 'CASH', amount, currency: 'KZT', idempotencyKey: key, paidAt: new Date('2026-10-20T06:00:00Z'),
    } });
    await pay(o1.id, 500000n, 'k1');
    await pay(o2.id, 200000n, 'k2');
    await db.restaurantCashOperation.create({ data: { locationId: food.location, method: 'CASH', currency: 'KZT', kind: 'EXPENSE', amount: 50000n, orderId: o1.id, occurredAt: new Date('2026-10-20T06:30:00Z') } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge','on',true)`;
      await tx.$executeRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
      await tx.restaurantCashOperation.deleteMany({ where: { locationId: { in: [salon.location, food.location] } } });
      await tx.restaurantPayment.deleteMany({ where: { locationId: food.location } });
      await tx.restaurantOrder.deleteMany({ where: { locationId: food.location } });
      await tx.appointmentLine.deleteMany({ where: { appointment: { locationId: salon.location } } });
      await tx.appointment.deleteMany({ where: { locationId: salon.location } });
    }).catch(() => undefined);
    await db.$disconnect();
  });

  it('салон: оплата записи делится по цене услуг мастеров, возврат так же, аннулированное не считается', async () => {
    const day = (await as('BEAUTY', () => svc.staffRevenue({ period: 'day' }, now))) as Rev;
    expect(day.items).toEqual([
      { employeeId: bota, currency: 'KZT', paidMinor: '700000', refundedMinor: '70000', netMinor: '630000' },
      { employeeId: anna, currency: 'KZT', paidMinor: '300000', refundedMinor: '30000', netMinor: '270000' },
    ]);
    const month = (await as('BEAUTY', () => svc.staffRevenue({ period: 'month' }, now))) as Rev;
    expect(month.items.find((r) => r.employeeId === anna)!.paidMinor).toBe('315000');
    const week = (await as('BEAUTY', () => svc.staffRevenue({ period: 'week' }, now))) as Rev;
    expect(week.items.find((r) => r.employeeId === anna)!.paidMinor).toBe('300000');
  });

  it('ресторан: оплаты заказа официанту минус возврат, заказ без официанта отдельной строкой', async () => {
    const day = (await as('FOOD_SERVICE', () => svc.staffRevenue({ period: 'day' }, now))) as Rev;
    expect(day.items).toEqual([
      { employeeId: waiter, currency: 'KZT', paidMinor: '500000', refundedMinor: '50000', netMinor: '450000' },
      { employeeId: null, currency: 'KZT', paidMinor: '200000', refundedMinor: '0', netMinor: '200000' },
    ]);
  });

  it('неверный период: понятная ошибка', async () => {
    await expect(as('FOOD_SERVICE', () => svc.staffRevenue({ period: 'year' }, now))).rejects.toThrow('Период');
  });
});
