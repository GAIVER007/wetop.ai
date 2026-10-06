import 'reflect-metadata';
import { HotelModule } from '../../apps/api/src/hotel/hotel.module';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { isLocalDatabase } from '../tools/seed-local';

it('MV8 requires real branches contract to expose selected Food Location and current timezone', async () => {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Own local database required');
  const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
  const org = randomUUID();
  const user = randomUUID();
  let app: INestApplication | undefined;
  let businessId: string | undefined;
  let locationId: string | undefined;
  try {
    await db.organization.create({
      data: { id: org, name: `MV8-contract-${org}`, status: 'ACTIVE' },
    });
    await db.user.create({
      data: { id: user, email: `mv8-contract-${user}@example.invalid`, name: 'Тестовый владелец' },
    });
    const business = await db.business.create({
      data: { organizationId: org, name: 'Синтетический Food', vertical: 'FOOD_SERVICE' },
    });
    businessId = business.id;
    const location = await db.location.create({
      data: { businessId, name: 'Синтетический ресторан', timezone: 'Asia/Dubai', currency: 'KZT' },
    });
    locationId = location.id;
    const prisma = { db } as unknown as PrismaService;
    const module = await Test.createTestingModule({ imports: [HotelModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.use((req: { user?: object }, _res: unknown, next: () => void) => {
      req.user = { id: user, organizationId: org, role: 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/branches`, {
      headers: { 'x-wetop-scope': `business=${businessId};location=${locationId}` },
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { items: unknown[] };
    expect(
      result.items,
      'Real BranchesService returns no Food Location although DB has active owned FOOD_SERVICE Business/Location',
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId, vertical: 'FOOD_SERVICE', timezone: 'Asia/Dubai' }),
      ]),
    );
  } finally {
    await app?.close();
    if (locationId) await db.location.delete({ where: { id: locationId } });
    if (businessId) await db.business.delete({ where: { id: businessId } });
    await db.organization.delete({ where: { id: org } });
    await db.user.delete({ where: { id: user } });
    await db.$disconnect();
  }
});

it('real HTTP acceptance matrix preserves Hospitality/Beauty and isolates owned active Food locations', async () => {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Own local database required');
  const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
  const orgA = randomUUID(),
    orgB = randomUUID(),
    user = randomUUID();
  let app: INestApplication | undefined;
  let actorOrg: string | null = orgA;
  try {
    for (const id of [orgA, orgB])
      await db.organization.create({ data: { id, name: `MV8-matrix-${id}`, status: 'ACTIVE' } });
    await db.user.create({
      data: { id: user, email: `mv8-${user}@example.invalid`, name: 'Синтетический владелец' },
    });
    const seed = async (
      org: string,
      name: string,
      vertical: 'BEAUTY' | 'FOOD_SERVICE' | 'HOSPITALITY',
      count = 1,
      archivedBusiness = false,
      archivedLocation = false,
    ) => {
      const business = await db.business.create({
        data: {
          organizationId: org,
          name,
          vertical,
          status: archivedBusiness ? 'ARCHIVED' : 'ACTIVE',
        },
      });
      const locations = [];
      for (let i = 0; i < count; i++)
        locations.push(
          await db.location.create({
            data: {
              businessId: business.id,
              name: `${name} ${i + 1}`,
              address: `Тестовый адрес ${i + 1}`,
              timezone: 'Asia/Dubai',
              currency: 'AED',
              status: archivedLocation ? 'ARCHIVED' : 'ACTIVE',
            },
          }),
        );
      return { business, locations };
    };
    const hotel = await seed(orgA, 'Тестовый отель', 'HOSPITALITY');
    const property = await db.property.create({
      data: {
        organizationId: orgA,
        locationId: hotel.locations[0]!.id,
        name: 'Тестовый объект',
        address: 'Тестовый адрес отеля',
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    const beauty = await seed(orgA, 'Тестовый салон', 'BEAUTY');
    const foodA = await seed(orgA, 'Тестовый Food A', 'FOOD_SERVICE', 2);
    const foodB = await seed(orgA, 'Тестовый Food B', 'FOOD_SERVICE');
    const foreign = await seed(orgB, 'Чужой тестовый Food', 'FOOD_SERVICE');
    await seed(orgA, 'Архивный бизнес', 'FOOD_SERVICE', 1, true);
    await seed(orgA, 'Архивный филиал', 'FOOD_SERVICE', 1, false, true);
    const food = foodA.locations[0]!;
    await db.onboardingProgress.create({
      data: {
        locationId: food.id,
        flowVersion: 1,
        currentStep: 'business',
        draft: { timezone: 'UTC' },
      },
    });
    const prisma = { db } as unknown as PrismaService;
    const module = await Test.createTestingModule({ imports: [HotelModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication();
    app.use((req: { user?: object }, _res: unknown, next: () => void) => {
      if (actorOrg) req.user = { id: user, organizationId: actorOrg, role: 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor(prisma));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const read = async (headers: Record<string, string> = {}) => {
      const res = await fetch(`${base}/branches`, { headers });
      expect(res.status).toBe(200);
      return (await res.json()) as { items: Array<Record<string, unknown>> };
    };
    const initial = await read();
    expect(initial.items).toHaveLength(5);
    expect(initial.items.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        property.id,
        beauty.locations[0]!.id,
        ...foodA.locations.map((l) => l.id),
        foodB.locations[0]!.id,
      ]),
    );
    expect(initial.items.find((r) => r.id === property.id)).toMatchObject({
      vertical: 'HOSPITALITY',
      locationId: hotel.locations[0]!.id,
      name: property.name,
      timezone: 'Asia/Almaty',
    });
    expect(initial.items.find((r) => r.id === beauty.locations[0]!.id)).toMatchObject({
      vertical: 'BEAUTY',
      locationId: beauty.locations[0]!.id,
    });
    expect(initial.items.find((r) => r.id === food.id)).toEqual({
      id: food.id,
      name: food.name,
      address: food.address,
      currency: 'AED',
      timezone: 'Asia/Dubai',
      vertical: 'FOOD_SERVICE',
      locationId: food.id,
      location: { businessId: foodA.business.id },
      _count: { inventoryUnits: 0, accommodationTypes: 0 },
    });
    await db.location.update({ where: { id: food.id }, data: { timezone: 'Europe/Paris' } });
    expect((await read()).items.find((r) => r.id === food.id)?.timezone).toBe('Europe/Paris');
    // A foreign pointer cannot widen the actor's Organization or expose its locations.
    expect(
      (
        await read({
          'x-wetop-scope': `business=${foreign.business.id};location=${foreign.locations[0]!.id}`,
        })
      ).items,
    ).toHaveLength(5);
    actorOrg = orgB;
    expect(
      (
        await read({ 'x-wetop-scope': `business=${foodA.business.id};location=${food.id}` })
      ).items.map((r) => r.id),
    ).toEqual([foreign.locations[0]!.id]);
    actorOrg = null;
    expect((await fetch(`${base}/branches`)).status).toBe(403);
    actorOrg = orgA;
    const create = await fetch(`${base}/branches`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: randomUUID(),
        name: 'Тестовый Food',
        vertical: 'FOOD_SERVICE',
        currency: 'AED',
        timezone: 'Asia/Dubai',
      }),
    });
    expect(create.status).toBe(400);
  } finally {
    await app?.close();
    const own = { business: { organizationId: { in: [orgA, orgB] } } };
    await db.onboardingProgress.deleteMany({ where: { location: own } });
    await db.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.location.deleteMany({ where: own });
    await db.business.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: user } });
    await db.$disconnect();
  }
});
