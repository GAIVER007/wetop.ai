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
  let master = '', masterB = '', serviceB = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: org, name: 'Зарплата салона', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, name: 'Synthetic owner', email: `payroll-${user}@example.invalid` } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Салон', vertical: 'BEAUTY' } });
    await db.location.create({ data: { id: location, businessId: business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT' } });
    master = (await db.employee.create({ data: { businessId: business, name: 'Мастер Дина' } })).id;
    masterB = (await db.employee.create({ data: { businessId: business, name: 'Мастер Лея' } })).id;
    const customer = await db.customer.create({ data: { organizationId: org, firstName: 'Айгуль' } });
    const service = await db.beautyService.create({ data: { businessId: business, name: 'Окрашивание', durationMinutes: 60, price: 800000n, currency: 'KZT' } });
    serviceB = (await db.beautyService.create({ data: { businessId: business, name: 'Укладка', durationMinutes: 30, price: 500000n, currency: 'KZT' } })).id;
    await db.employeeLocation.create({ data: { employeeId: master, locationId: location } });
    await db.employeeLocation.create({ data: { employeeId: masterB, locationId: location } });
    await db.employeeService.create({ data: { employeeId: master, serviceId: service.id } });
    await db.employeeService.create({ data: { employeeId: masterB, serviceId: serviceB } });
    await db.locationService.create({ data: { locationId: location, serviceId: service.id, enabled: true } });
    await db.locationService.create({ data: { locationId: location, serviceId: serviceB, enabled: true } });
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
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      const multi = await tx.appointment.create({
        data: {
          locationId: location, customerId: customer.id, employeeId: master, serviceId: service.id,
          startsAt: new Date('2026-11-15T05:00:00Z'), endsAt: new Date('2026-11-15T06:30:00Z'),
          status: 'DONE', price: 800000n, currency: 'KZT',
        },
      });
      await tx.appointmentLine.createMany({ data: [
        {
          appointmentId: multi.id, position: 0, employeeId: master, serviceId: service.id,
          startsAt: new Date('2026-11-15T05:00:00Z'), endsAt: new Date('2026-11-15T06:00:00Z'),
          basePriceMinor: 300000n, priceMinor: 300000n, currency: 'KZT',
        },
        {
          appointmentId: multi.id, position: 1, employeeId: masterB, serviceId: serviceB,
          startsAt: new Date('2026-11-15T06:00:00Z'), endsAt: new Date('2026-11-15T06:30:00Z'),
          basePriceMinor: 500000n, priceMinor: 500000n, currency: 'KZT',
        },
      ] });
    });
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

  it('распределяет выручку многострочного визита только по строкам каждого мастера', async () => {
    await at(() => svc.setPaySettings(master, { model: 'PERCENT', fixedMinor: 0, percent: 10 }));
    await at(() => svc.setPaySettings(masterB, { model: 'PERCENT', fixedMinor: 0, percent: 10 }));
    const out = (await at(() => svc.payroll({ month: '2026-11' }))) as {
      rows: Array<{ employeeId: string; salesMinor: string; percentMinor: string; totalMinor: string }>;
    };
    expect(out.rows.find((row) => row.employeeId === master)).toMatchObject({
      salesMinor: '300000', percentMinor: '30000', totalMinor: '30000',
    });
    expect(out.rows.find((row) => row.employeeId === masterB)).toMatchObject({
      salesMinor: '500000', percentMinor: '50000', totalMinor: '50000',
    });
  });
});
