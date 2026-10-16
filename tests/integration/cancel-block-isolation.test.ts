import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db, type DbTx } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import {
  withSignedInUser,
  withOrganizationScope,
  withIntegrationPropertyScope,
} from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;
const date = (s: string) => new Date(`${s}T00:00:00Z`);
const number = 'SYN-SAME-NUMBER';

describe.skipIf(!url)(
  'cancellation releases only scoped stay-extra blocks on local PostgreSQL',
  () => {
    let db: Db;
    beforeAll(async () => {
      if (
        !url ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname) ||
        process.env.DATABASE_SCHEMA !== 'pms_test'
      )
        throw new Error('Isolated local pms_test required');
      db = createPrismaClient(url, 'pms_test');
      expect(await db.$queryRaw`SELECT current_schema() AS schema`).toEqual([
        { schema: 'pms_test' },
      ]);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });
    async function hotel(tx: DbTx, organizationId: string, label: string) {
      const property = await createPropertyInChain(tx, organizationId, {
        name: `Synthetic cancellation ${label}`,
        timezone: 'UTC',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
      const location = await tx.location.findUniqueOrThrow({ where: { id: property.locationId } });
      const category = await tx.accommodationType.create({
        data: {
          propertyId: property.id,
          code: 'SYN',
          name: 'Synthetic',
          kind: 'PRIVATE_ROOM',
          capacityAdults: 1,
          capacityChildren: 0,
        },
      });
      const building = await tx.building.create({
        data: { propertyId: property.id, name: 'Synthetic' },
      });
      const floor = await tx.floor.create({ data: { buildingId: building.id, name: 'Synthetic' } });
      const room = await tx.physicalRoom.create({
        data: { floorId: floor.id, roomNumber: 'Synthetic', capacity: 1 },
      });
      const unit = await tx.inventoryUnit.create({
        data: {
          propertyId: property.id,
          physicalRoomId: room.id,
          accommodationTypeId: category.id,
          kind: 'ROOM',
          code: 'SYN',
          active: true,
        },
      });
      const reservation = await tx.reservation.create({
        data: {
          propertyId: property.id,
          confirmationNumber: number,
          source: 'WALK_IN',
          status: 'CONFIRMED',
          arrivalDate: date('2032-11-10'),
          departureDate: date('2032-11-13'),
          adults: 1,
          currency: 'KZT',
          totalAmount: 0n,
          bookedAt: new Date(),
          items: {
            create: {
              accommodationTypeId: category.id,
              arrivalDate: date('2032-11-10'),
              departureDate: date('2032-11-13'),
              status: 'CONFIRMED',
              adults: 1,
              price: 0n,
            },
          },
        },
      });
      const early = await tx.inventoryBlock.create({
        data: {
          inventoryUnitId: unit.id,
          dateFrom: date('2032-11-09'),
          dateTo: date('2032-11-10'),
          type: 'OTHER',
          reason: `Ранний заезд, бронь ${number}`,
        },
      });
      const late = await tx.inventoryBlock.create({
        data: {
          inventoryUnitId: unit.id,
          dateFrom: date('2032-11-13'),
          dateTo: date('2032-11-14'),
          type: 'OTHER',
          reason: `Поздний выезд, бронь ${number}`,
        },
      });
      return { property, location, unit, reservation, early, late };
    }
    it.each(['staff', 'integration'] as const)(
      '%s cancellation preserves equal numbers in another branch and another organization',
      async (kind) => {
        const rollback = new Error('rollback synthetic cancellation fixture');
        try {
          await db.$transaction(
            async (tx) => {
              const org = await tx.organization.create({
                data: { name: 'Synthetic cancellation A' },
              });
              const other = await tx.organization.create({
                data: { name: 'Synthetic cancellation B' },
              });
              const a = await hotel(tx, org.id, 'A');
              const b = await hotel(tx, org.id, 'B');
              const c = await hotel(tx, other.id, 'C');
              const preserved = [b.early.id, b.late.id, c.early.id, c.late.id];
              for (const [type, reason] of [
                ['OTHER', `Обслуживание, бронь ${number}`],
                ['MAINTENANCE', `Ранний заезд, бронь ${number}`],
                ['OTHER', `Поздний выезд, бронь ${number}-OTHER`],
                ['OTHER', null],
              ] as const) {
                const row = await tx.inventoryBlock.create({
                  data: {
                    inventoryUnitId: a.unit.id,
                    dateFrom: date('2032-11-09'),
                    dateTo: date('2032-11-10'),
                    type,
                    reason,
                  },
                });
                preserved.push(row.id);
              }
              const original = await tx.inventoryBlock.findMany({
                where: { id: { in: preserved } },
                orderBy: { id: 'asc' },
              });
              const repo = new PrismaReservationsRepository(tx);
              const service = new ReservationsService(
                { run: (fn) => fn(repo), read: (fn) => fn(repo) },
                new NoopAriPublisher(),
              );
              const run = async () => {
                expect((await service.cancel(number)).status).toBe('CANCELLED');
                expect(
                  await tx.inventoryBlock.count({ where: { id: { in: [a.early.id, a.late.id] } } }),
                ).toBe(0);
                expect(
                  await tx.inventoryBlock.findMany({
                    where: { id: { in: preserved } },
                    orderBy: { id: 'asc' },
                  }),
                ).toEqual(original);
                expect(await repo.releaseStayExtraBlocks(number)).toEqual([]);
                expect(
                  (await tx.reservation.findUniqueOrThrow({ where: { id: b.reservation.id } }))
                    .status,
                ).toBe('CONFIRMED');
                expect(
                  (await tx.reservation.findUniqueOrThrow({ where: { id: c.reservation.id } }))
                    .status,
                ).toBe('CONFIRMED');
              };
              if (kind === 'staff') {
                const user = await tx.user.create({
                  data: {
                    email: `synthetic-${randomUUID()}@example.invalid`,
                    passwordHash: 'synthetic-unused',
                  },
                });
                await withSignedInUser(
                  {
                    userId: user.id,
                    organizationId: org.id,
                    role: 'OWNER',
                    scope: 'LOCATION',
                    businessId: a.location.businessId,
                    locationId: a.location.id,
                    vertical: 'HOSPITALITY',
                  },
                  run,
                );
              } else {
                await withOrganizationScope(org.id, () =>
                  withIntegrationPropertyScope(a.property.id, run),
                );
              }
              throw rollback;
            },
            { timeout: 20000 },
          );
        } catch (error) {
          if (error !== rollback) throw error;
        }
      },
    );
  },
);
