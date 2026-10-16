import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { categoryAvailability } from '@pms/domain';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withIntegrationPropertyScope } from '../../apps/api/src/auth/request-context';

// Fail closed: this regression suite may only mutate its dedicated synthetic local fixture.
const url = process.env.DATABASE_URL;
let db: Db;
const day = (d: string) => `2030-01-${d}`;
const date = (d: string) => new Date(`${day(d)}T00:00:00Z`);
const cases = [
  {
    name: 'inactive blocks do not consume active inventory; active overlaps count once',
    rows: [
      [2, '01', '05'],
      [0, '02', '04'],
      [0, '03', '05'],
    ],
    inactive: [2],
    free: [2, 1, 1, 1],
  },
  {
    name: 'identical blocks on one unit',
    rows: [
      [0, '01', '04'],
      [0, '01', '04'],
    ],
    free: [2, 2, 2, 3],
  },
  {
    name: 'partially overlapping blocks on one unit',
    rows: [
      [0, '01', '03'],
      [0, '02', '04'],
    ],
    free: [2, 2, 2, 3],
  },
  {
    name: 'overlapping blocks on different units',
    rows: [
      [0, '01', '03'],
      [1, '02', '04'],
    ],
    free: [2, 1, 2, 3],
  },
  {
    name: 'independent blocks on one unit',
    rows: [
      [0, '01', '02'],
      [0, '03', '04'],
    ],
    free: [2, 3, 2, 3],
  },
  {
    name: 'touching blocks on one unit',
    rows: [
      [0, '01', '02'],
      [0, '02', '03'],
    ],
    free: [2, 2, 3, 3],
  },
] as const;

describe.skipIf(!url)('real PostgreSQL overlapping inventory blocks', () => {
  beforeAll(() => {
    const target = new URL(url!);
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
      process.env.DATABASE_SCHEMA !== 'pms_test'
    ) {
      throw new Error('Availability blocks tests require a loopback database and pms_test schema');
    }
    db = createPrismaClient(url!, 'pms_test');
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  for (const c of cases)
    it(c.name, async () => {
      const rollback = new Error('rollback synthetic availability fixture');
      try {
        await db.$transaction(
          async (tx) => {
            const org = await tx.organization.create({
              data: { name: 'Synthetic availability blocks' },
            });
            const property = await createPropertyInChain(tx, org.id, {
              name: 'Synthetic availability blocks',
              address: 'Synthetic local test',
              timezone: 'Asia/Almaty',
              currency: 'KZT',
              checkInTime: '14:00',
              checkOutTime: '12:00',
            });
            const category = await tx.accommodationType.create({
              data: {
                propertyId: property.id,
                code: 'BLOCK-TEST',
                name: 'Synthetic room',
                kind: 'PRIVATE_ROOM',
                capacityAdults: 2,
                capacityChildren: 0,
              },
            });
            const building = await tx.building.create({
              data: { propertyId: property.id, name: 'Synthetic B' },
            });
            const floor = await tx.floor.create({
              data: { buildingId: building.id, name: 'Synthetic F' },
            });
            const room = await tx.physicalRoom.create({
              data: { floorId: floor.id, roomNumber: 'Synthetic 1', capacity: 3 },
            });
            const units: Array<{ id: string }> = [];
            for (let n = 0; n < 3; n++)
              units.push(
                await tx.inventoryUnit.create({
                  data: {
                    propertyId: property.id,
                    physicalRoomId: room.id,
                    accommodationTypeId: category.id,
                    code: `TEST-${n}`,
                    kind: 'ROOM',
                    active: !('inactive' in c && c.inactive.some((index) => index === n)),
                  },
                }),
              );
            await tx.inventoryBlock.createMany({
              data: c.rows.map(([n, from, to]) => ({
                inventoryUnitId: units[n]!.id,
                dateFrom: date(from),
                dateTo: date(to),
                type: 'MAINTENANCE',
                reason: 'Synthetic local regression',
              })),
            });
            const booking = new PrismaReservationsRepository(tx);
            const channels = new PrismaChannelsRepository({ db: tx } as unknown as PrismaService);
            await withIntegrationPropertyScope(property.id, async () => {
              const [channelUnits, blocks, items] = await Promise.all([
                channels.categoryUnits(),
                channels.categoryBlocks(day('01'), day('05')),
                channels.soldItems(day('01'), day('05')),
              ]);
              const perNight = categoryAvailability({
                from: day('01'),
                to: day('04'),
                units: channelUnits,
                blocks,
                items,
              });
              const bookingNights = [];
              for (const [i, d] of ['01', '02', '03', '04'].entries())
                bookingNights.push(
                  await booking.categoryAvailability(
                    category.id,
                    day(d),
                    day(String(i + 2).padStart(2, '0')),
                  ),
                );
              // Assert each path independently, not merely equality between two possibly wrong paths.
              expect.soft(bookingNights).toEqual(c.free);
              expect.soft([...perNight.get(category.code)!.values()]).toEqual(c.free);
              expect(await booking.categoryAvailability(category.id, day('01'), day('05'))).toBe(
                Math.min(...c.free),
              );
            });
            throw rollback;
          },
          { timeout: 15_000 },
        );
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
});
