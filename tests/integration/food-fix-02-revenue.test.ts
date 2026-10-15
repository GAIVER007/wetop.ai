import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import { OrganizationSummaryService } from '../../apps/api/src/hotel/organization-summary';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;

/** FOOD-FIX-02 (ADR-182): выручка бара в отчёте периода и в поступлениях сводки организации. */
describe.skipIf(!url)('выручка бара в отчётах (ADR-182), настоящая PostgreSQL', () => {
  let db: Db, svc: RestaurantService, summary: OrganizationSummaryService;
  const org = randomUUID(),
    user = randomUUID(),
    business = randomUUID(),
    location1 = randomUUID(),
    location2 = randomUUID();
  const at = <T>(locationId: string, fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: user,
        organizationId: org,
        role: 'OWNER' as const,
        scope: 'LOCATION' as const,
        businessId: business,
        locationId,
        vertical: 'FOOD_SERVICE' as const,
      },
      fn,
    );
  let nextNumber = 1;
  const closedOrder = (locationId: string, total: bigint, closedAt: string) =>
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
      },
    });
  const paymentFor = (locationId: string, orderId: string, amount: bigint, paidAt: string) =>
    db.restaurantPayment.create({
      data: {
        locationId,
        orderId,
        method: 'CASH',
        amount,
        currency: 'KZT',
        status: 'COMPLETED',
        idempotencyKey: randomUUID(),
        paidAt: new Date(paidAt),
      },
    });
  const barSale = (
    locationId: string,
    revenue: bigint,
    createdAt: string,
    status: 'POSTED' | 'REVERSED' = 'POSTED',
  ) =>
    db.barSale.create({
      data: {
        locationId,
        idempotencyKey: randomUUID(),
        status,
        currency: 'KZT',
        totalRevenue: revenue,
        totalCost: 1_000n,
        createdAt: new Date(createdAt),
        ...(status === 'REVERSED' ? { reversedAt: new Date(createdAt) } : {}),
      },
    });
  const period = (locationId: string, from: string, to: string) =>
    at(locationId, () => svc.periodReport({ from, to })) as Promise<{
      revenueMinor: string;
      barRevenueMinor: string;
    }>;

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as PrismaService;
    svc = new RestaurantService(prisma, null, new StockService(prisma));
    summary = new OrganizationSummaryService(prisma);
    await db.organization.create({
      data: { id: org, name: 'ADR-182 synthetic', status: 'ACTIVE' },
    });
    await db.user.create({
      data: { id: user, name: 'Synthetic owner', email: `adr182-${user}@example.invalid` },
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
    await db.barSaleLine.deleteMany({ where: { sale: here } });
    await db.barSale.deleteMany({ where: here });
    await db.restaurantPayment.deleteMany({ where: here });
    await db.restaurantCashOperation.deleteMany({ where: here });
    await db.restaurantOrder.deleteMany({ where: here });
  });

  afterAll(async () => {
    const here = { location: { business: { organizationId: org } } };
    await db.barSale.deleteMany({ where: here });
    await db.restaurantPayment.deleteMany({ where: here });
    await db.restaurantCashOperation.deleteMany({ where: here });
    await db.restaurantOrder.deleteMany({ where: here });
    await db.location.deleteMany({ where: { businessId: business } });
    await db.business.delete({ where: { id: business } });
    await db.user.delete({ where: { id: user } });
    await db.organization.delete({ where: { id: org } });
  });

  it('отчёт периода: выручка заказов и бара раздельно, каждый филиал видит своё', async () => {
    await closedOrder(location1, 100_000n, '2026-09-05T15:00:00+05:00');
    await closedOrder(location2, 50_000n, '2026-09-05T16:00:00+05:00');
    await barSale(location1, 20_000n, '2026-09-05T18:00:00+05:00');
    await barSale(location2, 30_000n, '2026-09-06T18:00:00+05:00');
    const a = await period(location1, '2026-09-01', '2026-09-30');
    const b = await period(location2, '2026-09-01', '2026-09-30');
    expect([a.revenueMinor, a.barRevenueMinor]).toEqual(['100000', '20000']);
    expect([b.revenueMinor, b.barRevenueMinor]).toEqual(['50000', '30000']);
  });

  it('границы дня по поясу филиала: 23:59 в день 13, 00:01 в день 14', async () => {
    await barSale(location1, 1_000n, '2026-09-13T23:59:00+05:00');
    await barSale(location1, 2_000n, '2026-09-14T00:01:00+05:00');
    const day13 = await period(location1, '2026-09-13', '2026-09-13');
    const day14 = await period(location1, '2026-09-14', '2026-09-14');
    expect(day13.barRevenueMinor).toBe('1000');
    expect(day14.barRevenueMinor).toBe('2000');
  });

  it('сторно исключает продажу бара из выручки задним числом', async () => {
    await barSale(location1, 5_000n, '2026-09-10T12:00:00+05:00');
    expect((await period(location1, '2026-09-10', '2026-09-10')).barRevenueMinor).toBe('5000');
    await db.barSale.updateMany({
      where: { locationId: location1 },
      data: { status: 'REVERSED', reversedAt: new Date() },
    });
    expect((await period(location1, '2026-09-10', '2026-09-10')).barRevenueMinor).toBe('0');
  });

  it('сводка организации: поступления ресторана = оплаты заказов + бар, без ручных приходов и сторно', async () => {
    const o1 = await closedOrder(location1, 100_000n, '2026-09-05T15:00:00+05:00');
    await paymentFor(location1, o1.id, 100_000n, '2026-09-05T15:00:00+05:00');
    await barSale(location1, 20_000n, '2026-09-05T18:00:00+05:00');
    const o2 = await closedOrder(location2, 50_000n, '2026-09-05T16:00:00+05:00');
    await paymentFor(location2, o2.id, 50_000n, '2026-09-05T16:00:00+05:00');
    await barSale(location2, 30_000n, '2026-09-06T18:00:00+05:00');
    await barSale(location2, 7_000n, '2026-09-07T18:00:00+05:00', 'REVERSED');
    // ручной приход кассы (внесение размена) поступлением продаж не считается
    await db.restaurantCashOperation.create({
      data: {
        locationId: location1,
        kind: 'INCOME',
        method: 'CASH',
        amount: 999_000n,
        currency: 'KZT',
      },
    });
    const out = (await at(location1, () => summary.report('2026-09-01', '2026-09-30'))) as {
      rows: Array<{
        id: string;
        currencies: Array<{ currency: string; receiptsMinor: string; averageMinor: string | null }>;
      }>;
      currencies: Array<{ currency: string; receiptsMinor: string; averageMinor: string | null }>;
    };
    const row = (id: string) => out.rows.find((l) => l.id === id)!.currencies[0]!;
    expect(row(location1).receiptsMinor).toBe('120000');
    expect(row(location2).receiptsMinor).toBe('80000');
    // средний чек остаётся по оплатам заказов, бар его не раздувает
    expect(row(location1).averageMinor).toBe('100000');
    // итог организации: поступления с баром, средний чек без него
    expect(out.currencies[0]!.receiptsMinor).toBe('200000');
    expect(out.currencies[0]!.averageMinor).toBe('75000');
  });
});
