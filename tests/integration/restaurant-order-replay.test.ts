import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import { StockService } from '../../apps/api/src/food-service/stock.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
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
});
