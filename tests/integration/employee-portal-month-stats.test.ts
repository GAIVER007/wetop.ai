import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';

/**
 * S2 «Мой месяц» (владелец 21.10.2026): итоги сотрудника за месяц по выбранному филиалу. Салон: записи, услуги,
 * выручка (оплачено − возвраты), смены, выходные, бонусы. Ресторан: заказы, столы, гости, выручка, процент.
 * Чужие записи, заказы и деньги в итоги не попадают. Вымышленные данные.
 */
const db = createPrismaClient(assertPortalDatabase(), 'pms_test');
const portal = new EmployeePortalService({ db } as PrismaService, null);
const month = '2026-09';
const period = new Date(`${month}-01T00:00:00Z`);
// 15 сентября 10:00 Алматы = 05:00 UTC
const at = (day: number, hour = 5) => new Date(Date.UTC(2026, 8, day, hour));

describe('«Мой месяц» мастера салона', () => {
  let f: Awaited<ReturnType<typeof seedPortalFixture>>;
  const as = <T>(actor: 'staffA' | 'staffB' | 'ownerA', locationId: string | null, run: () => Promise<T>) =>
    withSignedInUser({ ...f.actors[actor], ...(locationId ? { scope: 'LOCATION' as const, locationId } : {}) }, run);
  beforeAll(async () => {
    f = await seedPortalFixture(db, 'BEAUTY');
    const owner = f.actors.ownerA.id, service = f.serviceId!;
    const customer = await db.customer.create({ data: { organizationId: f.organizationA, firstName: 'Synthetic month client' } });
    const visit = async (employeeId: string, day: number, status: 'DONE' | 'BOOKED', locationId = f.locationA, price = 10000n) =>
      db.appointment.create({ data: { locationId, customerId: customer.id, employeeId, serviceId: service, startsAt: at(day), endsAt: at(day, 6), status, price, currency: 'KZT', createdById: owner } });
    const a1 = await visit(f.employeeA, 1, 'DONE');
    const a2 = await visit(f.employeeA, 2, 'DONE');
    await visit(f.employeeA, 3, 'BOOKED');
    await visit(f.employeeA, 4, 'DONE', f.locationB); // другой филиал
    await db.appointment.create({ data: { locationId: f.locationA, customerId: customer.id, employeeId: f.employeeA, serviceId: service, startsAt: new Date('2026-08-31T18:30:00Z'), endsAt: new Date('2026-08-31T19:30:00Z'), status: 'DONE', price: 10000n, currency: 'KZT' } }); // 31 авг. по Алматы
    const b1 = await visit(f.employeeB, 5, 'DONE', f.locationA, 50000n);
    // многострочная запись: две услуги мастера A и одна мастера B
    const multi = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('wetop.appointment_lines_write','on',true)`;
      const m = await tx.appointment.create({ data: { locationId: f.locationA, customerId: customer.id, employeeId: f.employeeA, serviceId: service, startsAt: at(7), endsAt: at(7, 8), status: 'DONE', price: 30000n, currency: 'KZT' } });
      await tx.appointmentLine.deleteMany({ where: { appointmentId: m.id } });
      await tx.appointmentLine.createMany({ data: [
        { appointmentId: m.id, position: 0, employeeId: f.employeeA, serviceId: service, startsAt: at(7), endsAt: at(7, 6), basePriceMinor: 10000n, priceMinor: 10000n, currency: 'KZT' },
        { appointmentId: m.id, position: 1, employeeId: f.employeeA, serviceId: service, startsAt: at(7, 6), endsAt: at(7, 7), basePriceMinor: 10000n, priceMinor: 10000n, currency: 'KZT' },
        { appointmentId: m.id, position: 2, employeeId: f.employeeB, serviceId: service, startsAt: at(7, 7), endsAt: at(7, 8), basePriceMinor: 10000n, priceMinor: 10000n, currency: 'KZT' },
      ] });
      return m;
    });
    const cash = (appointmentId: string, kind: 'INCOME' | 'EXPENSE', amount: bigint, day: number) =>
      db.restaurantCashOperation.create({ data: { locationId: f.locationA, appointmentId, kind, method: 'CASH', amount, currency: 'KZT', occurredAt: at(day, 9), createdById: owner } });
    await cash(a1.id, 'INCOME', 10000n, 1);
    await cash(a2.id, 'INCOME', 10000n, 2);
    await cash(a2.id, 'EXPENSE', 4000n, 3); // возврат
    await cash(b1.id, 'INCOME', 50000n, 5); // чужая
    await cash(multi.id, 'INCOME', 30000n, 7); // мне 2/3
    // график: пн-пт в филиале A; отсутствие 14-15 сентября (пн, вт) и выходные 19-20 (сб, вс)
    await db.workingHours.createMany({ data: [1, 2, 3, 4, 5].map((weekday) => ({ employeeId: f.employeeA, locationId: f.locationA, weekday, timeFrom: new Date('1970-01-01T10:00:00Z'), timeTo: new Date('1970-01-01T18:00:00Z') })) });
    await db.timeOff.createMany({ data: [
      { employeeId: f.employeeA, dateFrom: new Date('2026-09-14T00:00:00Z'), dateTo: new Date('2026-09-15T00:00:00Z'), reason: 'Synthetic leave' },
      { employeeId: f.employeeA, dateFrom: new Date('2026-09-19T00:00:00Z'), dateTo: new Date('2026-09-20T00:00:00Z'), reason: null },
      { employeeId: f.employeeB, dateFrom: new Date('2026-09-01T00:00:00Z'), dateTo: new Date('2026-09-30T00:00:00Z'), reason: 'Other master leave' },
    ] });
    await db.employeePayAdjustment.createMany({ data: [
      { employeeId: f.employeeA, period, amountMinor: 10000n, reason: 'Synthetic bonus', createdById: owner },
      { employeeId: f.employeeA, period, amountMinor: 2500n, reason: 'Synthetic bonus 2', createdById: owner },
      { employeeId: f.employeeA, period, amountMinor: -3000n, reason: 'Synthetic penalty', createdById: owner },
      { employeeId: f.employeeB, period, amountMinor: 99000n, reason: 'Other bonus', createdById: owner },
    ] });
  });

  it('считает свои записи, услуги, выручку, смены, выходные и бонусы за месяц филиала', async () => {
    const dto = await as('staffA', f.locationA, () => portal.get(null, { month }));
    // сентябрь 2026: 22 будних дня, 2 из них в отсутствии
    expect(dto.monthStats).toEqual({
      month, status: 'AVAILABLE', currency: 'KZT',
      shifts: 20, daysOff: 10, absenceDays: 2,
      appointmentsDone: 3, servicesDone: 4,
      ordersClosed: null, tablesServed: null, guests: null,
      revenueMinor: String(10000 + 10000 - 4000 + 20000), bonusMinor: '12500', percent: null,
    });
  });

  it('не показывает чужое: второй мастер видит только свои итоги', async () => {
    const dto = await as('staffB', f.locationA, () => portal.get(null, { month }));
    expect(dto.monthStats).toMatchObject({ appointmentsDone: 2, servicesDone: 2, revenueMinor: String(50000 + 10000), bonusMinor: '99000', shifts: 0 });
  });

  it('по умолчанию берёт текущий месяц; без филиала просит выбрать филиал', async () => {
    const current = await as('staffA', f.locationA, () => portal.get(null, {}));
    expect(current.monthStats.month).toBe(current.pay.month);
    const branchless = await as('staffA', null, () => portal.get(null, { month }));
    expect(branchless.monthStats).toMatchObject({ status: 'SELECT_LOCATION', shifts: null, revenueMinor: null, appointmentsDone: null });
  });

  it('список «Месяц»: свои записи филиала за месяц по дате, с датой по часам филиала; «День» по-прежнему один день', async () => {
    const dto = await as('staffA', f.locationA, () => portal.get(null, { month, range: 'month' }));
    expect(dto.workRange).toBe('MONTH');
    expect(dto.workTruncated).toBe(false);
    // 1, 2, 3 (записана), 7 (две строки) сентября; 31 августа, филиал B и чужие не попадают
    expect(dto.appointments.map((a) => a.date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-07', '2026-09-07']);
    expect(dto.appointments.map((a) => a.startsAt)).toEqual([...dto.appointments.map((a) => a.startsAt)].sort());
    const day = await as('staffA', f.locationA, () => portal.get(null, { date: '2026-09-02' }));
    expect(day.workRange).toBe('DAY');
    expect(day.appointments.map((a) => a.date)).toEqual(['2026-09-02']);
    await expect(as('staffA', f.locationA, () => portal.get(null, { range: 'year' }))).rejects.toThrow();
  });

  // кабинет мастера (владелец 28.10.2026): имена клиентов мастер не получает вовсе, руководитель видит
  it('мастер не получает имён клиентов в своих записях; руководитель получает', async () => {
    const own = await as('staffA', f.locationA, () => portal.get(null, { month, range: 'month' }));
    expect(own.access).toBe('SELF');
    expect(own.appointments.length).toBeGreaterThan(0);
    expect(new Set(own.appointments.map((a) => a.customerName))).toEqual(new Set(['']));
    expect(JSON.stringify(own.appointments)).not.toContain('Synthetic month client');
    const managed = await as('ownerA', f.locationA, () => portal.get(f.employeeA, { month, range: 'month' }));
    expect(managed.access).toBe('MANAGER');
    expect(managed.appointments.every((a) => a.customerName.length > 0)).toBe(true);
  });
});

describe('«Мой месяц» официанта', () => {
  let f: Awaited<ReturnType<typeof seedPortalFixture>>;
  const as = <T>(actor: 'staffA' | 'staffB', run: () => Promise<T>) =>
    withSignedInUser({ ...f.actors[actor], scope: 'LOCATION' as const, locationId: f.locationA }, run);
  beforeAll(async () => {
    f = await seedPortalFixture(db, 'FOOD_SERVICE');
    const owner = f.actors.ownerA.id;
    const area = await db.diningArea.create({ data: { locationId: f.locationA, name: 'Synthetic hall' } });
    const [t1, t2] = await Promise.all(['T1', 'T2'].map((name) => db.diningTable.create({ data: { areaId: area.id, name, capacity: 4 } })));
    let n = 500;
    const order = async (waiterId: string | null, status: 'CLOSED' | 'SERVED', tableId: string | null, guestCount: number, total: bigint, day: number, locationId = f.locationA) => {
      const o = await db.restaurantOrder.create({ data: { locationId, number: n++, waiterId, status, tableId, guestCount, total, currency: 'KZT', openedAt: at(day), closedAt: status === 'CLOSED' ? at(day, 7) : null, createdById: owner } });
      if (status === 'CLOSED') await db.restaurantPayment.create({ data: { locationId, orderId: o.id, method: 'CASH', amount: total, currency: 'KZT', idempotencyKey: randomUUID(), paidAt: at(day, 7), createdById: owner } });
      return o;
    };
    const o1 = await order(f.employeeA, 'CLOSED', t1!.id, 3, 20000n, 2);
    await order(f.employeeA, 'CLOSED', t1!.id, 2, 15000n, 3); // тот же стол другим днём
    await order(f.employeeA, 'CLOSED', t2!.id, 4, 30000n, 4);
    await order(f.employeeA, 'CLOSED', null, 1, 5000n, 5); // навынос
    await order(f.employeeA, 'SERVED', t2!.id, 6, 99000n, 6); // не закрыт
    await order(f.employeeA, 'CLOSED', null, 9, 77000n, 6, f.locationB); // другой филиал
    await order(f.employeeB, 'CLOSED', t2!.id, 8, 88000n, 7); // чужой
    await db.restaurantCashOperation.create({ data: { locationId: f.locationA, orderId: o1.id, kind: 'EXPENSE', method: 'CASH', amount: 2000n, currency: 'KZT', occurredAt: at(8), createdById: owner } });
    await db.employeePayAdjustment.create({ data: { employeeId: f.employeeA, period, amountMinor: 7000n, reason: 'Synthetic tips bonus', createdById: owner } });
  });

  it('считает закрытые заказы, столы, гостей, свою выручку и процент', async () => {
    const dto = await as('staffA', () => portal.get(null, { month }));
    expect(dto.monthStats).toMatchObject({
      month, status: 'AVAILABLE', currency: 'KZT',
      ordersClosed: 4, tablesServed: 3, guests: 10,
      appointmentsDone: null, servicesDone: null,
      revenueMinor: String(20000 + 15000 + 30000 + 5000 - 2000), bonusMinor: '7000', percent: 15,
      shifts: 0, daysOff: 30,
    });
  });

  it('список «Месяц»: свои заказы филиала за месяц по дате открытия, с датой', async () => {
    const dto = await as('staffA', () => portal.get(null, { month, range: 'month' }));
    expect(dto.workRange).toBe('MONTH');
    expect(dto.orders.map((o) => o.date)).toEqual(['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
    expect(dto.orders.map((o) => o.totalMinor)).not.toContain('88000');
    expect(dto.orders.map((o) => o.totalMinor)).not.toContain('77000');
  });

  it('чужие заказы не попадают в итоги официанта', async () => {
    const dto = await as('staffB', () => portal.get(null, { month }));
    expect(dto.monthStats).toMatchObject({ ordersClosed: 1, tablesServed: 1, guests: 8, revenueMinor: '88000', bonusMinor: '0', percent: null });
  });
});

afterAll(async () => { await db.$disconnect(); });
