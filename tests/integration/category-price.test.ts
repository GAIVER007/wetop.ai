import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
config({ quiet: true });

/**
 * План categories-price-2026-10-06: цена категории — одна на все дни года вперёд и все вместимости, ставится из
 * «Категорий номеров» через массовую правку цен; «Удалить» — пустую насовсем, с местами в архив.
 */
describe.skipIf(!process.env.DATABASE_URL)('category price and removal', () => {
  it('sets one price for a year and every occupancy, shows it, deletes empty and archives used', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST price ${marker}` } });
    const user = await db.user.create({ data: { email: `price-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST price ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const module = await Test.createTestingModule({ imports: [InventoryModule] })
      .overrideProvider(PrismaService)
      .useValue({ db } as PrismaService)
      .compile();
    const app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      void withSignedInUser({ userId: user.id, organizationId: org.id }, async () => next());
    });
    await app.init();
    try {
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const http = () => request(app.getHttpServer());
        // создание с ценой: тариф выбирать не нужно, «Базовый тариф» заводится сам
        const created = await http()
          .post('/inventory/categories')
          .send({ name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, price: '15000' })
          .expect(201);
        const code = (created.body as { code: string }).code;
        const plans = await db.ratePlan.findMany({ where: { propertyId: property.id } });
        expect(plans.map((p) => p.name)).toEqual(['Базовый тариф']);
        const rates = await db.dailyRate.findMany({ where: { ratePlanId: plans[0]!.id } });
        // 366 дней × 2 вместимости, одна цена за номер
        expect(rates).toHaveLength(732);
        expect(new Set(rates.map((r) => r.price.toString()))).toEqual(new Set(['1500000']));

        // правка цены: +1000 ₸ на все те же дни
        await http().patch(`/inventory/categories/${code}`).send({ price: '16000' }).expect(200);
        const after = await db.dailyRate.findMany({ where: { ratePlanId: plans[0]!.id } });
        expect(after).toHaveLength(732);
        expect(new Set(after.map((r) => r.price.toString()))).toEqual(new Set(['1600000']));
        await http()
          .get('/inventory/categories')
          .expect(200)
          .expect((res) => {
            const row = (res.body as { code: string; priceMinor: string | null }[]).find(
              (c) => c.code === code,
            );
            expect(row).toMatchObject({ priceMinor: '1600000', currency: 'KZT' });
          });
        await http().patch(`/inventory/categories/${code}`).send({ price: '0' }).expect(400);
        await http().patch(`/inventory/categories/${code}`).send({}).expect(400);

        // вторая категория использует тот же основной тариф, а не заводит новый
        const bed = (
          (
            await http()
              .post('/inventory/categories')
              .send({ name: 'Койка', kind: 'DORM_BED', capacityAdults: 1, price: '6000' })
              .expect(201)
          ).body as { code: string }
        ).code;
        expect(await db.ratePlan.count({ where: { propertyId: property.id } })).toBe(1);

        // пустая категория удаляется насовсем вместе с ценами
        await http()
          .delete(`/inventory/categories/${bed}`)
          .expect(200)
          .expect((res) => expect(res.body).toMatchObject({ result: 'deleted' }));
        expect(await db.accommodationType.count({ where: { propertyId: property.id, code: bed } })).toBe(0);

        // категория с местом уходит в архив вместе с местом
        const room = await http()
          .post('/inventory/rooms')
          .send({ categoryCode: code, building: 'Основной', floor: '1', roomNumber: '101', codes: ['101'] })
          .expect(201);
        expect(room.status).toBe(201);
        await http()
          .delete(`/inventory/categories/${code}`)
          .expect(200)
          .expect((res) => expect(res.body).toMatchObject({ result: 'archived' }));
        const archived = await db.accommodationType.findFirstOrThrow({
          where: { propertyId: property.id, code },
          include: { units: true },
        });
        expect(archived.active).toBe(false);
        expect(archived.units.every((u) => !u.active)).toBe(true);
        await http().patch(`/inventory/categories/${code}`).send({ price: '17000' }).expect(409);
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.channelOutbox.deleteMany({ where: { propertyId: property.id } }).catch(() => {});
      await db.inventoryUnit.deleteMany({ where: { propertyId: property.id } });
      await db.physicalRoom.deleteMany({ where: { floor: { building: { propertyId: property.id } } } });
      await db.floor.deleteMany({ where: { building: { propertyId: property.id } } });
      await db.building.deleteMany({ where: { propertyId: property.id } });
      await db.dailyRate.deleteMany({ where: { ratePlan: { propertyId: property.id } } });
      await db.ratePlanAccommodationType.deleteMany({
        where: { accommodationType: { propertyId: property.id } },
      });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.accommodationType.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      forgetPropertyRef();
      await app.close();
      await db.$disconnect();
    }
  }, 120000);
});
