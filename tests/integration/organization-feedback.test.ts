import 'reflect-metadata';
import { isLocalDatabase } from '../tools/seed-local';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BranchesService } from '../../apps/api/src/hotel/branches';
import { BranchLifecycleService } from '../../apps/api/src/hotel/branch-lifecycle';
import { OrganizationSummaryService } from '../../apps/api/src/hotel/organization-summary';
const db = createPrismaClient(undefined, undefined, {
  of: databaseTenant,
  appConnectionString: process.env.DATABASE_APP_URL,
});
const org = randomUUID(),
  foreignOrg = randomUUID(),
  user = randomUUID();
const branches = new BranchesService({ db } as never);
const lifecycle = new BranchLifecycleService({ db } as never);
const summary = new OrganizationSummaryService({ db } as never);
const owner = <T>(fn: () => Promise<T>) =>
  withSignedInUser({ userId: user, organizationId: org, role: 'OWNER' }, fn);
const input = (id = randomUUID()) => ({
  id,
  name: 'Вымышленный объект',
  address: 'Тестовая улица, 1',
  currency: 'KZT',
  timezone: 'Asia/Almaty',
});
let hotelA: string, hotelB: string, foreignBusiness: string;
beforeAll(async () => {
  // как в соседних наборах: любая своя петлевая база, а не один вшитый порт (гейт поднимает свой)
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated local database required');
  await db.user.create({
    data: { id: user, email: `feedback-${user}@example.invalid`, name: 'Тестовый владелец' },
  });
  await db.organization.createMany({
    data: [
      { id: org, name: 'Вымышленная организация' },
      { id: foreignOrg, name: 'Чужая тестовая организация' },
    ],
  });
  await db.membership.create({ data: { organizationId: org, userId: user, role: 'OWNER' } });
  hotelA = (
    await db.business.create({
      data: { organizationId: org, name: 'Отель A', vertical: 'HOSPITALITY' },
    })
  ).id;
  hotelB = (
    await db.business.create({
      data: { organizationId: org, name: 'Отель B', vertical: 'HOSPITALITY' },
    })
  ).id;
  foreignBusiness = (
    await db.business.create({
      data: { organizationId: foreignOrg, name: 'Чужой отель', vertical: 'HOSPITALITY' },
    })
  ).id;
});
afterAll(async () => db.$disconnect());
it('adds a branch to the selected business instead of the first hotel', async () => {
  const created = await owner(() => branches.create({ ...input(), businessId: hotelB }));
  expect(created.location.businessId).toBe(hotelB);
  expect(created.location.businessId).not.toBe(hotelA);
  await expect(
    owner(() => branches.create({ ...input(), businessId: foreignBusiness })),
  ).rejects.toThrow('недоступен');
});
it('creates another hotel brand atomically with its first object and replays safely', async () => {
  const newBusinessId = randomUUID(),
    body = { ...input(), newBusinessId, businessName: 'Новый тестовый бренд' };
  const created = await owner(() => branches.create(body));
  expect(created.location.businessId).toBe(newBusinessId);
  expect(await owner(() => branches.create(body))).toEqual(created);
  expect((await db.business.findUniqueOrThrow({ where: { id: newBusinessId } })).name).toBe(
    body.businessName,
  );
  expect(
    await db.auditLog.count({ where: { entityId: newBusinessId, action: 'business.created' } }),
  ).toBe(1);
});
it('reports received payments, preserves currency and archived history, and restores the object', async () => {
  const hotel = await owner(() => branches.create({ ...input(), businessId: hotelA }));
  const restaurant = await owner(() =>
    branches.create({
      ...input(),
      vertical: 'FOOD_SERVICE',
      newBusinessId: randomUUID(),
      businessName: 'Тестовый ресторан',
    }),
  );
  const beauty = await owner(() =>
    branches.create({
      ...input(),
      vertical: 'BEAUTY',
      newBusinessId: randomUUID(),
      businessName: 'Тестовый салон',
    }),
  );
  const date = new Date('2026-10-01T00:00:00Z');
  await db.payment.create({
    data: { propertyId: hotel.id, amount: 10000n, currency: 'KZT', method: 'CASH', paidAt: date },
  });
  await db.payment.create({
    data: {
      propertyId: hotel.id,
      amount: 90000n,
      currency: 'KZT',
      method: 'CASH',
      status: 'VOIDED',
      paidAt: date,
    },
  });
  await db.payment.create({
    data: { propertyId: hotel.id, amount: 7000n, currency: 'USD', method: 'CASH', paidAt: date },
  });
  await db.payment.create({
    data: {
      propertyId: hotel.id,
      amount: 80000n,
      currency: 'KZT',
      method: 'CASH',
      paidAt: new Date('2026-09-30T18:59:59Z'),
    },
  });
  await db.cashOperation.create({
    data: {
      propertyId: hotel.id,
      kind: 'EXPENSE',
      amount: 1100n,
      method: 'CASH',
      occurredAt: date,
    },
  });
  const order = await db.restaurantOrder.create({
    data: { locationId: restaurant.locationId, number: 1, total: 5000n, currency: 'KZT' },
  });
  for (const amount of [2000n, 1500n])
    await db.restaurantPayment.create({
      data: {
        locationId: restaurant.locationId,
        orderId: order.id,
        amount,
        currency: 'KZT',
        method: 'CASH',
        idempotencyKey: randomUUID(),
        paidAt: date,
      },
    });
  await db.restaurantCashOperation.create({
    data: {
      locationId: restaurant.locationId,
      kind: 'EXPENSE',
      amount: 400n,
      currency: 'KZT',
      method: 'CASH',
      occurredAt: date,
    },
  });
  const report = await owner(() => summary.report('2026-10-01', '2026-10-31'));
  expect(
    report.rows
      .filter((r) => [hotel.locationId, restaurant.locationId].includes(r.id))
      .every((r) => r.state === 'READY'),
  ).toBe(true);
  expect(report.currencies.find((c) => c.currency === 'KZT')).toMatchObject({
    receiptsMinor: '13500',
    expensesMinor: '1500',
    orders: 1,
    averageMinor: null,
  });
  expect(report.currencies.find((c) => c.currency === 'USD')?.receiptsMinor).toBe('7000');
  expect(report.rows.find((r) => r.id === restaurant.locationId)?.currencies[0]).toMatchObject({
    orders: 1,
    averageMinor: '3500',
  });
  expect(report.orders).toBe(1);
  expect(report.rows.find((r) => r.id === beauty.locationId)?.state).toBe('UNAVAILABLE');
  expect(report.complete).toBe(false);
  await owner(() => lifecycle.setStatus(hotel.locationId, 'ARCHIVED'));
  expect((await owner(() => branches.list())).items.some((b) => b.id === hotel.id)).toBe(false);
  expect((await owner(() => lifecycle.archived())).some((b) => b.id === hotel.locationId)).toBe(
    true,
  );
  expect(await db.property.count({ where: { id: hotel.id } })).toBe(1);
  expect(await db.payment.count({ where: { propertyId: hotel.id } })).toBe(4);
  expect((await owner(() => summary.report('2026-10-01', '2026-10-31'))).currencies).toEqual(
    report.currencies,
  );
  await owner(() => lifecycle.setStatus(hotel.locationId, 'ACTIVE'));
  expect((await owner(() => branches.list())).items.some((b) => b.id === hotel.id)).toBe(true);
  expect(
    await db.auditLog.count({
      where: {
        entityId: hotel.locationId,
        action: { in: ['location.archived', 'location.restored'] },
      },
    }),
  ).toBe(2);
});
