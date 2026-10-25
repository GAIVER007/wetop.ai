import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';

// Requires an owned loopback PostgreSQL with migrations applied. Never a shared dev database.
describe('restaurant creation request replay', () => {
  const url = process.env.DATABASE_URL;
  if (!url || !isLocalDatabase(url)) throw new Error('Owned loopback PostgreSQL required');
  let db: Db;
  let service: RestaurantService;
  const org = randomUUID(),
    business = randomUUID(),
    location = randomUUID(),
    user = randomUUID();
  let menuItemId: string;
  const at = <T>(fn: () => Promise<T>) =>
    withSignedInUser(
      {
        userId: user,
        organizationId: org,
        role: 'OWNER',
        scope: 'LOCATION',
        businessId: business,
        locationId: location,
        vertical: 'FOOD_SERVICE',
      },
      fn,
    );
  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as unknown as PrismaService;
    service = new RestaurantService(prisma, null, new StockService(prisma));
    await db.organization.create({ data: { id: org, name: 'Synthetic replay', status: 'ACTIVE' } });
    await db.user.create({
      data: { id: user, name: 'Synthetic operator', email: `replay-${user}@example.invalid` },
    });
    await db.business.create({
      data: {
        id: business,
        organizationId: org,
        name: 'Synthetic restaurant',
        vertical: 'FOOD_SERVICE',
      },
    });
    await db.location.create({
      data: {
        id: location,
        businessId: business,
        name: 'Synthetic branch',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
      },
    });
    const category = await at(() =>
      service.createCategory({ name: 'Synthetic category', station: 'KITCHEN' }),
    );
    menuItemId = (
      await db.menuItem.create({
        data: {
          businessId: business,
          categoryId: category.id,
          name: 'Synthetic soup',
          price: 1000n,
          currency: 'KZT',
        },
      })
    ).id;
  });
  afterAll(async () => db?.$disconnect());
  it('serializes simultaneous requests and replays after the response is discarded', async () => {
    const request = {
      guestCount: 1,
      creationRequestKey: randomUUID(),
      items: [{ menuItemId, qty: 1 }],
    };
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => at(() => service.createOrder(request))),
    );
    const id = responses[0]!.id;
    expect(new Set(responses.map((r) => r.id))).toEqual(new Set([id]));
    expect(
      await db.restaurantOrder.count({
        where: { locationId: location, creationRequestKey: request.creationRequestKey },
      }),
    ).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: id, action: 'food.order.created' } })).toBe(
      1,
    );
    await db.menuItem.update({ where: { id: menuItemId }, data: { active: false } });
    try {
      expect((await at(() => service.createOrder(request))).id).toBe(id);
      await expect(
        at(() => service.createOrder({ ...request, guestCount: 2 })),
      ).rejects.toMatchObject({ status: 409 });
    } finally {
      await db.menuItem.update({ where: { id: menuItemId }, data: { active: true } });
    }
  });
  it('a failed create does not consume the key', async () => {
    const request = {
      guestCount: 1,
      creationRequestKey: randomUUID(),
      items: [{ menuItemId, qty: 1 }],
    };
    await db.menuItem.update({ where: { id: menuItemId }, data: { active: false } });
    try {
      await expect(at(() => service.createOrder(request))).rejects.toThrow();
    } finally {
      await db.menuItem.update({ where: { id: menuItemId }, data: { active: true } });
    }
    expect(
      await db.restaurantOrder.count({
        where: { locationId: location, creationRequestKey: request.creationRequestKey },
      }),
    ).toBe(0);
    await at(() => service.createOrder(request));
    expect(
      await db.restaurantOrder.count({
        where: { locationId: location, creationRequestKey: request.creationRequestKey },
      }),
    ).toBe(1);
  });
  it('prepayment replay records one payment, rejects excess and closes only after serving', async () => {
    const created = await at(() =>
      service.createOrder({
        guestCount: 1,
        creationRequestKey: randomUUID(),
        items: [{ menuItemId, qty: 1 }],
      }),
    );
    const partial = { amount: 400, method: 'CASH', idempotencyKey: randomUUID() };
    const paid = await at(() => service.payOrder(created.id, partial));
    expect(paid.paidMinor).toBe('400');
    // Simulate a discarded response, then repeat the identical saved payload.
    expect((await at(() => service.payOrder(created.id, partial))).paidMinor).toBe('400');
    expect(await db.restaurantPayment.count({ where: { orderId: created.id } })).toBe(1);
    await expect(
      at(() =>
        service.payOrder(created.id, { ...partial, amount: 601, idempotencyKey: randomUUID() }),
      ),
    ).rejects.toThrow();
    expect(await db.restaurantPayment.count({ where: { orderId: created.id } })).toBe(1);
    let current = await at(() =>
      service.payOrder(created.id, { ...partial, amount: 600, idempotencyKey: randomUUID() }),
    );
    expect(current.paidMinor).toBe('1000');
    expect(current.status).toBe('NEW');
    for (const status of ['COOKING', 'READY', 'SERVED']) {
      const previous = current;
      current = await at(() =>
        service.orderStatus(previous.id, {
          expectedStatus: previous.status,
          expectedUpdatedAt: previous.updatedAt.toISOString(),
          status,
        }),
      );
    }
    expect(current.status).toBe('SERVED');
    await expect(
      at(() =>
        service.orderStatus(created.id, {
          expectedStatus: 'SERVED',
          expectedUpdatedAt: created.updatedAt.toISOString(),
          status: 'CLOSED',
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const close = {
      expectedStatus: 'SERVED',
      expectedUpdatedAt: current.updatedAt.toISOString(),
      status: 'CLOSED',
    };
    const closed = await at(() => service.orderStatus(created.id, close));
    expect(closed.status).toBe('CLOSED');
    expect(closed.paidMinor).toBe(closed.totalMinor);
    await expect(at(() => service.orderStatus(created.id, close))).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.restaurantPayment.count({ where: { orderId: created.id } })).toBe(2);
  });
  it('full payment after serving closes once and replay does not charge again', async () => {
    let current = await at(() =>
      service.createOrder({
        guestCount: 1,
        creationRequestKey: randomUUID(),
        items: [{ menuItemId, qty: 1 }],
      }),
    );
    for (const status of ['COOKING', 'READY', 'SERVED']) {
      const previous = current;
      current = await at(() =>
        service.orderStatus(previous.id, {
          expectedStatus: previous.status,
          expectedUpdatedAt: previous.updatedAt.toISOString(),
          status,
        }),
      );
    }
    const id = current.id;
    await expect(
      at(() =>
        service.orderStatus(id, {
          expectedStatus: 'SERVED',
          expectedUpdatedAt: current.updatedAt.toISOString(),
          status: 'CLOSED',
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    const payment = { amount: 1000, method: 'CASH', idempotencyKey: randomUUID() };
    expect((await at(() => service.payOrder(id, payment))).status).toBe('CLOSED');
    expect((await at(() => service.payOrder(id, payment))).status).toBe('CLOSED');
    expect(await db.restaurantPayment.count({ where: { orderId: id } })).toBe(1);
  });
  it('executes mobile payment boundaries as wetop_app and isolates foreign organizations', async () => {
    const appUrl = new URL(url!);
    appUrl.username = 'wetop_app';
    appUrl.password = '';
    const scoped = createPrismaClient(url, undefined, {
      of: databaseTenant,
      appConnectionString: appUrl.toString(),
    });
    const prisma = { db: scoped } as unknown as PrismaService;
    const restricted = new RestaurantService(prisma, null, new StockService(prisma));
    try {
      const roles = await at(
        () =>
          scoped.$queryRaw<
            Array<{ role: string; rolsuper: boolean; rolbypassrls: boolean }>
          >`SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`,
      );
      expect(roles).toEqual([{ role: 'wetop_app', rolsuper: false, rolbypassrls: false }]);
      const created = await at(() =>
        restricted.createOrder({
          guestCount: 1,
          creationRequestKey: randomUUID(),
          items: [{ menuItemId, qty: 1 }],
        }),
      );
      const employee = {
        userId: user,
        organizationId: org,
        role: 'EMPLOYEE' as const,
        scope: 'LOCATION' as const,
        businessId: business,
        locationId: location,
        vertical: 'FOOD_SERVICE' as const,
      };
      const payment = { amount: 1000, method: 'CASH', idempotencyKey: randomUUID() };
      await expect(
        withSignedInUser(employee, () => restricted.payOrder(created.id, payment)),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        withSignedInUser(employee, () =>
          restricted.orderStatus(created.id, {
            expectedStatus: 'SERVED',
            expectedUpdatedAt: created.updatedAt.toISOString(),
            status: 'CLOSED',
          }),
        ),
      ).rejects.toMatchObject({ status: 403 });
      const foreign = {
        ...employee,
        role: 'OWNER' as const,
        organizationId: randomUUID(),
        businessId: randomUUID(),
        locationId: randomUUID(),
      };
      expect(
        await withSignedInUser(foreign, () =>
          scoped.restaurantOrder.findUnique({ where: { id: created.id } }),
        ),
      ).toBeNull();
      await expect(
        withSignedInUser(foreign, () => restricted.payOrder(created.id, payment)),
      ).rejects.toThrow();
      expect(await db.restaurantPayment.count({ where: { orderId: created.id } })).toBe(0);
      const paid = await at(() => restricted.payOrder(created.id, payment));
      expect(paid.paidMinor).toBe('1000');
      expect((await at(() => restricted.payOrder(created.id, payment))).paidMinor).toBe('1000');
      expect(await db.restaurantPayment.count({ where: { orderId: created.id } })).toBe(1);
    } finally {
      await scoped.$disconnect();
    }
  });
});
