import { Test } from '@nestjs/testing';
import request from 'supertest';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { InventoryEditor } from '../../apps/api/src/inventory/inventory-editor';
import {
  PrismaInventoryRepository,
  INVENTORY_REPOSITORY,
} from '../../apps/api/src/inventory/inventory.repository';
import { InventoryService } from '../../apps/api/src/inventory/inventory.service';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
config({ quiet: true });
describe.skipIf(!process.env.DATABASE_URL)('inventory editing persistence and isolation', () => {
  it('commits categories and beds, reads without stale cache, rejects foreign category and duplicate atomically', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST inventory ${marker}` } });
    const user = await db.user.create({ data: { email: `inventory-${marker}@example.invalid` } });
    const property = await db.property.create({
      data: {
        organizationId: org.id,
        name: `TEST inventory ${marker}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      },
    });
    const provider = { db } as PrismaService;
    const module = await Test.createTestingModule({ imports: [InventoryModule] })
      .overrideProvider(PrismaService)
      .useValue(provider)
      .compile();
    const app = module.createNestApplication();
    app.use((_req: unknown, _res: unknown, next: () => void) => {
      void withSignedInUser({ userId: user.id, organizationId: org.id }, async () => next());
    });
    await app.init();
    const editor = app.get(InventoryEditor),
      service = app.get(InventoryService);
    expect(app.get(INVENTORY_REPOSITORY)).toBeDefined();
    let foreignId: string | undefined;
    try {
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        expect((await service.summary()).totalUnits).toBe(0);
        const created = await request(app.getHttpServer())
          .post('/inventory/categories')
          .send({
            name: 'Тестовая общая',
            kind: 'DORM_BED',
            capacityAdults: 1,
            newRatePlanName: 'Тестовый тариф',
          })
          .expect(201);
        const category = created.body as { code: string };
        const codes = [`TEST-${marker}-A`, `TEST-${marker}-B`];
        await request(app.getHttpServer())
          .post('/inventory/rooms')
          .send({
            categoryCode: category.code,
            building: 'Тестовый',
            floor: '1',
            roomNumber: '101',
            codes,
          })
          .expect(201);
        await request(app.getHttpServer())
          .get('/inventory/categories')
          .expect(200)
          .expect((res) => {
            expect(res.body[0].code).toBe(category.code);
            // сигнал «настроено для продаж» в списке категорий (ТЗ «Категории v2», ADR-107)
            expect(res.body[0].active).toBe(true);
            expect(res.body[0].ratePlans).toBe(1);
          });
        const linked = await db.ratePlanAccommodationType.count({
          where: { accommodationType: { propertyId: property.id } },
        });
        expect(linked).toBe(1);
        expect((await service.summary()).totalUnits).toBe(2);
        expect((await service.units()).map((u) => u.code)).toEqual(codes);
        await request(app.getHttpServer())
          .patch(`/inventory/categories/${category.code}`)
          .send({ name: 'Тестовая обновлённая' })
          .expect(200);
        await request(app.getHttpServer())
          .patch(`/inventory/rooms/${codes[0]}`)
          .send({ roomNumber: '102' })
          .expect(200);
        const independent = new InventoryService(new PrismaInventoryRepository(provider));
        expect(
          (await independent.units()).every(
            (u) => u.roomNumber === '102' && u.accommodationTypeName === 'Тестовая обновлённая',
          ),
        ).toBe(true);
        await expect(
          editor.createRoom({
            categoryCode: category.code,
            building: 'Тестовый',
            floor: '1',
            roomNumber: '103',
            codes,
          }),
        ).rejects.toThrow('уже существует');
        expect(
          await db.physicalRoom.count({
            where: { floor: { building: { propertyId: property.id } } },
          }),
        ).toBe(1);
        const foreign = await db.accommodationType.create({
          data: {
            propertyId: property.id,
            code: `foreign-${marker}`,
            name: 'Test',
            kind: 'PRIVATE_ROOM',
            capacityAdults: 1,
          },
        });
        foreignId = foreign.id;
        // A signed-in actor with a different organization cannot select the first property's category.
        await expect(
          withSignedInUser({ userId: user.id, organizationId: randomUUID() }, () =>
            editor.renameCategory(category.code, { name: 'Forbidden' }),
          ),
        ).rejects.toThrow();
        expect((await db.accommodationType.findUnique({ where: { id: foreignId } }))?.name).toBe(
          'Test',
        );
        expect(await db.auditLog.count({ where: { userId: user.id } })).toBe(4);
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.inventoryUnit.deleteMany({
        where: { accommodationType: { propertyId: property.id } },
      });
      await db.physicalRoom.deleteMany({
        where: { floor: { building: { propertyId: property.id } } },
      });
      await db.floor.deleteMany({ where: { building: { propertyId: property.id } } });
      await db.building.deleteMany({ where: { propertyId: property.id } });
      await db.ratePlanAccommodationType.deleteMany({
        where: { accommodationType: { propertyId: property.id } },
      });
      await db.ratePlan.deleteMany({ where: { propertyId: property.id } });
      await db.accommodationType.deleteMany({ where: { propertyId: property.id } });
      await db.property.delete({ where: { id: property.id } });
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      forgetPropertyRef();
      await app.close();
      await db.$disconnect();
    }
  }, 120000);
});
