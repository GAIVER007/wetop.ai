import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
config({ quiet: true });

describe.skipIf(!process.env.DATABASE_URL)('новые места уходят в Channex', () => {
  it('комната в сопоставленной категории ставит в очередь остаток, в несопоставленной — нет', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST room-ari ${marker}` } });
    const user = await db.user.create({ data: { email: `room-ari-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST room-ari ${marker}`,
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
        const make = async (name: string) =>
          (
            await request(app.getHttpServer())
              .post('/inventory/categories')
              .send({
                name,
                kind: 'DORM_BED',
                capacityAdults: 1,
                newRatePlanName: `Тариф ${name}`,
              })
              .expect(201)
          ).body as { code: string };
        const mapped = await make('Сопоставленная');
        const plain = await make('Без канала');
        const category = await db.accommodationType.findFirstOrThrow({
          where: { propertyId: property.id, code: mapped.code },
        });
        await db.channelMapping.create({
          data: {
            propertyId: property.id,
            provider: 'channex',
            localAccommodationTypeId: category.id,
            providerPropertyId: `prop-${marker}`,
            providerRoomTypeId: `room-${marker}`,
          },
        });
        const room = (categoryCode: string, roomNumber: string, code: string) =>
          request(app.getHttpServer())
            .post('/inventory/rooms')
            .send({ categoryCode, building: 'Тестовый', floor: '1', roomNumber, codes: [code] })
            .expect(201);

        await room(plain.code, '201', `TEST-${marker}-P`);
        expect(
          await db.channelOutbox.count({
            where: { propertyId: property.id, kind: 'AVAILABILITY' },
          }),
        ).toBe(0);

        await room(mapped.code, '101', `TEST-${marker}-M`);
        const rows = await db.channelOutbox.findMany({
          where: { propertyId: property.id, kind: 'AVAILABILITY' },
        });
        expect(rows).toHaveLength(1);
        const values = rows[0]!.payload as Array<{
          room_type_id: string;
          availability: number;
        }>;
        expect(values.length).toBeGreaterThan(0);
        expect(values[0]).toMatchObject({ room_type_id: `room-${marker}`, availability: 1 });
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.channelOutbox.deleteMany({ where: { propertyId: property.id } });
      await db.channelMapping.deleteMany({ where: { propertyId: property.id } });
      await app.close();
      forgetPropertyRef();
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
      await deleteOrganizationChain(db, [org.id]);
      await db.user.delete({ where: { id: user.id } });
      await db.organization.delete({ where: { id: org.id } });
      await db.$disconnect();
    }
  });
});
