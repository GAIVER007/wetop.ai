import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { describe, it, expect } from 'vitest';
import { createPrismaClient, createPropertyInChain } from '@pms/database';
import { todayAt } from '@pms/domain';
import { InventoryModule } from '../../apps/api/src/inventory/inventory.module';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { purgeAuditRows } from '../tools/audit-purge';
import { deleteOrganizationChain } from '../tools/property-owner';
config({ quiet: true });

const day = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * day).toISOString().slice(0, 10);

/**
 * «Категории v2» C4 (ТЗ §17): «Эту категорию используют» — брони в истории (разные брони, а не проживания),
 * брони впереди (не отменённые и не закрытые, выезд сегодня или позже) и сопоставление с Channex.
 */
describe.skipIf(!process.env.DATABASE_URL)('category usage for safe editing', () => {
  it('counts distinct reservations in history and ahead, and the Channex mapping, per category', async () => {
    const db = createPrismaClient(),
      marker = randomUUID();
    const org = await db.organization.create({ data: { name: `TEST c4 ${marker}` } });
    const user = await db.user.create({ data: { email: `c4-${marker}@example.invalid` } });
    const property = await createPropertyInChain(db, org.id, {
      name: `TEST c4 ${marker}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
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
    const today = todayAt('Asia/Almaty');
    try {
      await withSignedInUser({ userId: user.id, organizationId: org.id }, async () => {
        const http = () => request(app.getHttpServer());
        const create = async (name: string) =>
          (
            (
              await http()
                .post('/inventory/categories')
                .send({ name, kind: 'PRIVATE_ROOM', capacityAdults: 2, ratePlanLater: true })
                .expect(201)
            ).body as { code: string }
          ).code;
        const used = await create('Используемая C4');
        const unused = await create('Пустая C4');
        const usedId = (
          await db.accommodationType.findFirstOrThrow({ where: { propertyId: property.id, code: used } })
        ).id;

        type Status = 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
        let n = 0;
        const book = async (from: number, to: number, statuses: Status[]) => {
          n += 1;
          const arrival = new Date(`${shift(today, from)}T00:00:00Z`),
            departure = new Date(`${shift(today, to)}T00:00:00Z`);
          await db.reservation.create({
            data: {
              propertyId: property.id,
              confirmationNumber: `C4-${marker.slice(0, 8)}-${n}`,
              source: 'DESK',
              status: statuses[0]!,
              arrivalDate: arrival,
              departureDate: departure,
              adults: statuses.length,
              currency: 'KZT',
              totalAmount: 0n,
              items: {
                create: statuses.map((status) => ({
                  accommodationTypeId: usedId,
                  arrivalDate: arrival,
                  departureDate: departure,
                  price: 0n,
                  status,
                })),
              },
            },
          });
        };
        await book(-10, -7, ['CHECKED_OUT']); // история
        await book(-5, -3, ['NO_SHOW']); // история
        await book(3, 6, ['CANCELLED']); // отменённая будущая — история, не «впереди»
        await book(-1, 0, ['CHECKED_IN']); // выезд сегодня — ещё впереди
        await book(5, 8, ['CONFIRMED', 'CONFIRMED']); // два проживания одной брони — одна бронь
        await db.channelMapping.create({
          data: {
            propertyId: property.id,
            provider: 'channex',
            localAccommodationTypeId: usedId,
            providerPropertyId: `test-${marker}`,
            providerRoomTypeId: `test-room-${marker}`,
          },
        });

        await http()
          .get('/inventory/categories')
          .expect(200)
          .expect((res) => {
            const rows = res.body as {
              code: string;
              reservations: number;
              upcomingReservations: number;
              channexMapped: boolean;
            }[];
            expect(rows.find((c) => c.code === used)).toMatchObject({
              reservations: 5,
              upcomingReservations: 2,
              channexMapped: true,
            });
            expect(rows.find((c) => c.code === unused)).toMatchObject({
              reservations: 0,
              upcomingReservations: 0,
              channexMapped: false,
            });
          });
      });
    } finally {
      await purgeAuditRows(db, { userId: user.id });
      await db.channelMapping.deleteMany({ where: { propertyId: property.id } });
      await db.reservationItem.deleteMany({ where: { reservation: { propertyId: property.id } } });
      await db.reservation.deleteMany({ where: { propertyId: property.id } });
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
