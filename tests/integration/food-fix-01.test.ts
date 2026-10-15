import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;

/** FOOD-FIX-01 (ADR-181): зарплата принадлежит бизнесу, выручка по дате закрытия, период кассы на сервере. */
describe.skipIf(!url)('FOOD-FIX-01: деньги ресторана (ADR-181), настоящая PostgreSQL', () => {
  let db: Db, svc: RestaurantService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location1 = randomUUID(),
    location2 = randomUUID();
  const actorAt = (locationId: string) => ({
    userId: user,
    organizationId: org,
    role: 'OWNER' as const,
    scope: 'LOCATION' as const,
    businessId: business,
    locationId,
    vertical: 'FOOD_SERVICE' as const,
  });
  const at = <T>(locationId: string, fn: () => Promise<T>) =>
    withSignedInUser(actorAt(locationId), fn);
  let nextNumber = 1;
  const closedOrder = (
    locationId: string,
    total: bigint,
    closedAt: string,
    waiterId: string | null = null,
  ) =>
    db.restaurantOrder.create({
      data: {
        locationId,
        number: nextNumber++,
        guestCount: 2,
        status: 'CLOSED',
        total,
        currency: 'KZT',
        openedAt: new Date(new Date(closedAt).getTime() - 60 * 60 * 1000),
        closedAt: new Date(closedAt),
        waiterId,
      },
    });
  const income = (locationId: string, amount: bigint, occurredAt?: string) =>
    db.restaurantCashOperation.create({
      data: {
        locationId,
        kind: 'INCOME',
        method: 'CASH',
        amount,
        currency: 'KZT',
        ...(occurredAt ? { occurredAt: new Date(occurredAt) } : {}),
      },
    });
  const employeeWith = async (model: 'FIXED' | 'PERCENT', fixedMinor: bigint, percent: number) => {
    const e = await db.employee.create({
      data: { businessId: business, name: 'Синтетический официант' },
    });
    await db.employeeLocation.create({ data: { employeeId: e.id, locationId: location1 } });
    await db.employeePaySetting.create({
      data: { employeeId: e.id, model, fixedMinor, percent, currency: 'KZT' },
    });
    return e.id;
  };
  const payrollRow = async (locationId: string, month: string, employeeId: string) => {
    const out = (await at(locationId, () => svc.payroll({ month }))) as {
      rows: {
        employeeId: string;
        totalMinor: string;
        paidMinor: string;
        remainingMinor: string;
        percentMinor: string;
      }[];
    };
    return out.rows.find((r) => r.employeeId === employeeId)!;
  };

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({
      data: { id: org, name: 'FOOD-FIX-01 synthetic', status: 'ACTIVE' },
    });
    await db.user.create({
      data: { id: user, name: 'Synthetic owner', email: `food-fix-${user}@example.invalid` },
    });
    await db.business.create({
      data: { id: business, organizationId: org, name: 'Synthetic food', vertical: 'FOOD_SERVICE' },
    });
    await db.location.createMany({
      data: [location1, location2].map((id) => ({
        id,
        businessId: business,
        name: 'Synthetic branch',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      })),
    });
  });

  beforeEach(async () => {
    const here = { location: { business: { organizationId: org } } };
    await db.restaurantPayment.deleteMany({ where: here });
    await db.restaurantCashOperation.deleteMany({ where: here });
    await db.restaurantOrder.deleteMany({ where: here });
    await db.employeePayAdjustment.deleteMany({ where: { employee: { businessId: business } } });
    await db.employeePaySetting.deleteMany({ where: { employee: { businessId: business } } });
    await db.employeeLocation.deleteMany({ where: { employee: { businessId: business } } });
    await db.employee.deleteMany({ where: { businessId: business } });
  });

  afterAll(async () => {
    const here = { location: { business: { organizationId: org } } };
    await db.$transaction(async (tx) => {
      // журнал только дописывается: уборка тестовых строк идёт под audit_purge (DATA_MODEL §14)
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { organizationId: org } });
    });
    await db.restaurantPayment.deleteMany({ where: here });
    await db.restaurantCashOperation.deleteMany({ where: here });
    await db.restaurantOrder.deleteMany({ where: here });
    await db.employeePayAdjustment.deleteMany({ where: { employee: { businessId: business } } });
    await db.employeePaySetting.deleteMany({ where: { employee: { businessId: business } } });
    await db.employeeLocation.deleteMany({ where: { employee: { businessId: business } } });
    await db.employee.deleteMany({ where: { businessId: business } });
    await db.location.deleteMany({ where: { businessId: business } });
    await db.business.delete({ where: { id: business } });
    await db.user.delete({ where: { id: user } });
    await db.organization.delete({ where: { id: org } });
  });

  // ── P0.1: зарплата принадлежит бизнесу ──

  it('выплата оклада видна из второго филиала того же бизнеса', async () => {
    const e = await employeeWith('FIXED', 200_000n, 0);
    await income(location1, 300_000n);
    await at(location1, () =>
      svc.payout(e, { period: '2026-09', method: 'CASH', amount: 200_000 }),
    );
    const row = await payrollRow(location2, '2026-09', e);
    expect(row.paidMinor).toBe('200000');
    expect(row.remainingMinor).toBe('0');
  });

  it('второй филиал не может выплатить тот же оклад ещё раз', async () => {
    const e = await employeeWith('FIXED', 200_000n, 0);
    await income(location1, 300_000n);
    await income(location2, 300_000n);
    await at(location1, () =>
      svc.payout(e, { period: '2026-09', method: 'CASH', amount: 200_000 }),
    );
    await expect(
      at(location2, () => svc.payout(e, { period: '2026-09', method: 'CASH', amount: 200_000 })),
    ).rejects.toBeInstanceOf(ConflictException);
    const ops = await db.restaurantCashOperation.findMany({
      where: { location: { businessId: business }, employeeId: e, status: 'COMPLETED' },
    });
    expect(ops).toHaveLength(1);
  });

  it('процент считает закрытые заказы всех филиалов бизнеса', async () => {
    const e = await employeeWith('PERCENT', 0n, 10);
    await closedOrder(location1, 100_000n, '2026-09-05T15:00:00+05:00', e);
    await closedOrder(location2, 50_000n, '2026-09-06T15:00:00+05:00', e);
    const fromL1 = await payrollRow(location1, '2026-09', e);
    const fromL2 = await payrollRow(location2, '2026-09', e);
    expect(fromL1.percentMinor).toBe('15000');
    expect(fromL2.percentMinor).toBe('15000');
  });

  // ── P1.4: канон выручки, дата закрытия ──

  it('дневная выручка идёт в день закрытия заказа, не открытия', async () => {
    // открыт 13.10 в 23:00, закрыт 14.10 в 00:30 по поясу филиала
    await closedOrder(location1, 100_000n, '2026-10-14T00:30:00+05:00');
    const day14 = (await at(location1, () => svc.report({ date: '2026-10-14' }))) as {
      tiles: { revenueMinor: string };
    };
    const day13 = (await at(location1, () => svc.report({ date: '2026-10-13' }))) as {
      tiles: { revenueMinor: string };
    };
    expect(day14.tiles.revenueMinor).toBe('100000');
    expect(day13.tiles.revenueMinor).toBe('0');
  });

  it('вчерашняя дельта выручки тоже считается по дате закрытия', async () => {
    await closedOrder(location1, 100_000n, '2026-10-14T12:00:00+05:00');
    await closedOrder(location1, 50_000n, '2026-10-13T12:00:00+05:00');
    const day14 = (await at(location1, () => svc.report({ date: '2026-10-14' }))) as {
      tiles: { revenueMinor: string; revenueDeltaPct: number | null };
    };
    expect(day14.tiles.revenueMinor).toBe('100000');
    expect(day14.tiles.revenueDeltaPct).toBe(100);
  });

  // ── P1.3: период кассы считает сервер ──

  it('касса отдаёт период целиком, а не последние 100 строк', async () => {
    const order = await closedOrder(location1, 2_000_000n, '2026-08-10T20:00:00+05:00');
    const day = (n: number, iso: string) =>
      Array.from({ length: n }, (_, i) => ({
        locationId: location1,
        orderId: order.id,
        method: 'CASH' as const,
        amount: 100n,
        currency: 'KZT',
        status: 'COMPLETED' as const,
        idempotencyKey: randomUUID(),
        paidAt: new Date(new Date(iso).getTime() + i * 1000),
      }));
    await db.restaurantPayment.createMany({ data: day(120, '2026-08-10T10:00:00+05:00') });
    await db.restaurantPayment.createMany({ data: day(5, '2026-08-12T10:00:00+05:00') });
    const out = (await at(location1, () => svc.cash({ from: '2026-08-10', to: '2026-08-11' }))) as {
      payments: { paidAt: string | Date }[];
    };
    expect(out.payments).toHaveLength(120);
  });

  it('границы периода кассы включительны по поясу филиала', async () => {
    const order = await closedOrder(location1, 2_000_000n, '2026-08-10T20:00:00+05:00');
    const pay = (iso: string) =>
      db.restaurantPayment.create({
        data: {
          locationId: location1,
          orderId: order.id,
          method: 'CASH',
          amount: 100n,
          currency: 'KZT',
          status: 'COMPLETED',
          idempotencyKey: randomUUID(),
          paidAt: new Date(iso),
        },
      });
    await pay('2026-08-10T00:00:00+05:00'); // первая секунда from
    await pay('2026-08-11T23:59:59+05:00'); // последняя секунда to
    await pay('2026-08-12T00:00:00+05:00'); // уже вне периода
    await income(location1, 1_000n, '2026-08-12T00:00:00+05:00');
    const operationInside = await income(location1, 2_000n, '2026-08-10T12:00:00+05:00');
    const out = (await at(location1, () => svc.cash({ from: '2026-08-10', to: '2026-08-11' }))) as {
      payments: unknown[];
      operations: { id: string }[];
    };
    expect(out.payments).toHaveLength(2);
    expect(out.operations.map((o) => o.id)).toEqual([operationInside.id]);
  });
});
