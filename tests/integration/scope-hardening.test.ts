import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPrismaClient,
  createPropertyInChain,
  NEW_PROPERTY_DEFAULTS,
  type Db,
  type DbTx,
} from '@pms/database';
import { HotelModule } from '../../apps/api/src/hotel/hotel.module';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { StayOffersService } from '../../apps/api/src/reservations/stay-offers';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * SCOPE-HARDENING (план согласован владельцем 06.10.2026). Две проверки на настоящей схеме:
 *
 * 1. В организации с двумя гостиницами брони, котировка, поиск брони и «свободные места» идут в объект выбранного
 *    филиала, а не в первый объект организации. Филиал без объекта (Beauty) не получает чужой объект.
 * 2. `GET /branches/overview` в смешанной организации (две гостиницы, салон, ресторан) отвечает 200 и считает только
 *    гостиничные филиалы (решение владельца: вариант A, метрики Beauty и Food относятся к MV9).
 */
type RequestActor = Exclude<Parameters<typeof withSignedInUser>[0], string | null>;
const url = process.env.DATABASE_URL;
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
class Rollback extends Error {}

/** Гостиница с одной категорией, одним номером, одним тарифом и ценами на окно дат; цена своя у каждой. */
async function seedHotel(
  tx: DbTx,
  organizationId: string,
  name: string,
  price: bigint,
  createdAt: Date,
) {
  const property = await createPropertyInChain(tx, organizationId, {
    ...NEW_PROPERTY_DEFAULTS,
    name,
    address: `Тестовый адрес ${name}`,
    createdAt,
  });
  await tx.location.update({ where: { id: property.locationId }, data: { createdAt } });
  const type = await tx.accommodationType.create({
    data: {
      propertyId: property.id,
      code: 'SH-DBL',
      name: 'Двухместный',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 2,
      capacityChildren: 0,
    },
  });
  const building = await tx.building.create({ data: { propertyId: property.id, name: 'Корпус' } });
  const floor = await tx.floor.create({ data: { buildingId: building.id, name: '1' } });
  const room = await tx.physicalRoom.create({
    data: { floorId: floor.id, roomNumber: '1', capacity: 2 },
  });
  await tx.inventoryUnit.create({
    data: {
      propertyId: property.id,
      physicalRoomId: room.id,
      accommodationTypeId: type.id,
      code: 'SH1',
      kind: 'ROOM',
      active: true,
    },
  });
  const plan = await tx.ratePlan.create({
    data: {
      propertyId: property.id,
      code: 'SH-BASE',
      name: 'Базовый',
      currency: 'KZT',
      active: true,
    },
  });
  await tx.ratePlanAccommodationType.create({
    data: { ratePlanId: plan.id, accommodationTypeId: type.id },
  });
  const rows = [];
  for (let i = 0; i < 60; i++)
    for (const occupancy of [1, 2])
      rows.push({
        date: new Date(day(i)),
        accommodationTypeId: type.id,
        ratePlanId: plan.id,
        occupancy,
        price: price * BigInt(occupancy),
      });
  await tx.dailyRate.createMany({ data: rows });
  return property;
}

describe.skipIf(!url)('SCOPE-HARDENING: Hospitality property follows the selected branch', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url, 'pms_test');
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('two Hospitality properties in one Organization: Location B books, quotes, finds and offers in B only', async () => {
    const seen: Record<string, unknown> = {};
    await expect(
      db.$transaction(
        async (tx) => {
          forgetPropertyRef();
          const org = randomUUID();
          const user = randomUUID();
          await tx.organization.create({ data: { id: org, name: `SH-${org}`, status: 'ACTIVE' } });
          await tx.user.create({
            data: { id: user, email: `sh-${user}@example.invalid`, name: 'Тестовый владелец' },
          });
          await tx.membership.create({
            data: { userId: user, organizationId: org, role: 'OWNER' },
          });
          const a = await seedHotel(
            tx,
            org,
            'SH Гостиница A',
            1_000_000n,
            new Date(Date.now() - 2 * 86_400_000),
          );
          const b = await seedHotel(
            tx,
            org,
            'SH Гостиница B',
            2_000_000n,
            new Date(Date.now() - 86_400_000),
          );
          const salon = await tx.business.create({
            data: { organizationId: org, name: 'SH Салон', vertical: 'BEAUTY' },
          });
          const salonLocation = await tx.location.create({
            data: {
              businessId: salon.id,
              name: 'SH Салон 1',
              timezone: 'Asia/Almaty',
              currency: 'KZT',
            },
          });
          const locationB = await tx.location.findUniqueOrThrow({ where: { id: b.locationId } });

          const repo = () => new PrismaReservationsRepository(tx);
          const uow = {
            run: <T>(fn: (r: PrismaReservationsRepository) => Promise<T>) => fn(repo()),
            read: <T>(fn: (r: PrismaReservationsRepository) => Promise<T>) => fn(repo()),
          };
          const service = new ReservationsService(uow, new NoopAriPublisher());
          const offers = new StayOffersService(uow);
          const actor = (extra: Partial<RequestActor>): RequestActor => ({
            userId: user,
            organizationId: org,
            role: 'OWNER',
            ...extra,
          });
          const inB = actor({
            scope: 'LOCATION',
            businessId: locationB.businessId,
            locationId: b.locationId,
            vertical: 'HOSPITALITY',
          });
          const dto = {
            source: 'WALK_IN' as const,
            arrivalDate: day(10),
            departureDate: day(12),
            guest: { firstName: 'Гость', lastName: 'Тест-SH' },
            items: [
              {
                accommodationTypeCode: 'SH-DBL',
                ratePlanCode: 'SH-BASE',
                adults: 1,
                unitCode: null,
              },
            ],
          };

          await withSignedInUser(inB, async () => {
            seen['property'] = (await uow.read((r) => r.property())).id;
            seen['quote'] = (await service.create(dto, { preview: true })).totalMinor;
            const card = await service.create(dto);
            const stored = await tx.reservation.findFirstOrThrow({
              where: { confirmationNumber: card.confirmationNumber },
              select: { propertyId: true },
            });
            seen['created'] = stored.propertyId;
            // Зависимые записи брони (категория размещения, гость) тоже принадлежат объекту B и его организации
            const items = await tx.reservationItem.findMany({
              where: { reservation: { confirmationNumber: card.confirmationNumber } },
              select: { accommodationType: { select: { propertyId: true } } },
            });
            seen['itemProperties'] = [...new Set(items.map((i) => i.accommodationType.propertyId))];
            seen['number'] = card.confirmationNumber;
            seen['lookup'] =
              (await uow.read((r) => r.card(card.confirmationNumber)))?.confirmationNumber ?? null;
            const found = await offers.offers(day(20), day(22), '1');
            seen['offer'] = found.byCategory['SH-DBL'];
          });
          // Тот же номер брони из соседнего гостиничного филиала не открывается: брони B живут только в B
          const inA = actor({
            scope: 'LOCATION',
            businessId: locationB.businessId,
            locationId: a.locationId,
            vertical: 'HOSPITALITY',
          });
          seen['lookupFromA'] = await withSignedInUser(
            inA,
            async () =>
              (await uow.read((r) => r.card(String(seen['number']))))?.confirmationNumber ?? null,
          );
          // Без выбора филиала (scope организации) объект самый ранний, детерминированно
          seen['organization'] = await withSignedInUser(
            actor({ scope: 'ORGANIZATION' }),
            async () => (await uow.read((r) => r.property())).id,
          );
          // Филиал без объекта (Beauty) не получает объект гостиницы
          seen['beauty'] = await withSignedInUser(
            actor({
              scope: 'LOCATION',
              businessId: salon.id,
              locationId: salonLocation.id,
              vertical: 'BEAUTY',
            }),
            async () =>
              uow
                .read((r) => r.property())
                .then(
                  (p) => `fallback:${p.id}`,
                  (e: unknown) => (e instanceof NotFoundException ? 'not-found' : String(e)),
                ),
          );
          seen['a'] = a.id;
          seen['b'] = b.id;
          throw new Rollback();
        },
        { timeout: 60_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
    forgetPropertyRef();

    expect(seen['property'], 'repository property for Location B').toBe(seen['b']);
    expect(seen['quote'], 'two nights at B price (20 000 ₸ a night)').toBe('4000000');
    expect(seen['created'], 'reservation stored in property B').toBe(seen['b']);
    expect(seen['itemProperties'], 'reservation items use B categories').toEqual([seen['b']]);
    expect(seen['lookup']).toBe(seen['number']);
    expect(seen['offer'], 'availability offer priced by B').toMatchObject({
      totalMinor: '4000000',
      perNightMinor: '2000000',
    });
    expect(seen['lookupFromA'], 'B reservation is not visible from Location A').toBeNull();
    expect(seen['organization']).toBe(seen['a']);
    expect(seen['beauty']).toBe('not-found');
  });
});

describe.skipIf(!url)('SCOPE-HARDENING: /branches/overview is a Hospitality-only summary', () => {
  it('mixed Organization: 200, rows and totals only for Hospitality branches', async () => {
    if (!isLocalDatabase(url ?? '')) throw new Error('Own local database required');
    const db = createPrismaClient(url, 'pms_test');
    const org = randomUUID();
    const user = randomUUID();
    let app: INestApplication | undefined;
    const created: { properties: string[]; locations: string[]; businesses: string[] } = {
      properties: [],
      locations: [],
      businesses: [],
    };
    try {
      forgetPropertyRef();
      await db.organization.create({
        data: { id: org, name: `SH-overview-${org}`, status: 'ACTIVE' },
      });
      await db.user.create({
        data: { id: user, email: `sh-overview-${user}@example.invalid`, name: 'Тестовый владелец' },
      });
      for (const [name, createdAt] of [
        ['SH Отель A', new Date(Date.now() - 2 * 86_400_000)],
        ['SH Отель B', new Date(Date.now() - 86_400_000)],
      ] as const) {
        const property = await db.$transaction((tx) =>
          createPropertyInChain(tx, org, { ...NEW_PROPERTY_DEFAULTS, name, createdAt }),
        );
        created.properties.push(property.id);
        created.locations.push(property.locationId);
      }
      for (const vertical of ['BEAUTY', 'FOOD_SERVICE'] as const) {
        const business = await db.business.create({
          data: { organizationId: org, name: `SH ${vertical}`, vertical },
        });
        created.businesses.push(business.id);
        const location = await db.location.create({
          data: {
            businessId: business.id,
            name: `SH ${vertical} 1`,
            timezone: 'Asia/Almaty',
            currency: 'KZT',
          },
        });
        created.locations.push(location.id);
      }
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
      const response = await fetch(
        `${await app.getUrl()}/branches/overview?from=${day(0)}&to=${day(6)}`,
      );
      expect(response.status, await response.clone().text()).toBe(200);
      const body = (await response.json()) as {
        rows: Array<{ branch: { name: string; vertical?: string } }>;
      };
      expect(body.rows.map((row) => row.branch.name)).toEqual(['SH Отель A', 'SH Отель B']);
      expect(
        body.rows.every((row) => (row.branch.vertical ?? 'HOSPITALITY') === 'HOSPITALITY'),
      ).toBe(true);
    } finally {
      await app?.close();
      forgetPropertyRef();
      const hospitality = await db.business.findMany({
        where: { organizationId: org },
        select: { id: true },
      });
      await db.property.deleteMany({ where: { id: { in: created.properties } } });
      await db.location.deleteMany({ where: { id: { in: created.locations } } });
      await db.business.deleteMany({ where: { id: { in: hospitality.map((b) => b.id) } } });
      await db.organization.delete({ where: { id: org } });
      await db.user.delete({ where: { id: user } });
      await db.$disconnect();
    }
  });
});
