import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { exely } from '@pms/integrations';
import {
  adaptUniBooking,
  buildInventoryImportPlan,
  importInventoryPlan,
  importReservations,
  normalizeExelyReservation,
  parseExelyAccommodationTypes,
  parseExelyInventory,
} from '@pms/imports';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
const FIXTURES = resolve(import.meta.dirname, '../../scripts/imports/src/exely/__fixtures__');
const TEST_PROPERTY = {
  name: 'Тестовый хостел (integration)',
  legalName: 'ИП «Тест»',
  bin: '000000000000',
  address: 'нигде',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
};
class Rollback extends Error {}

const booking = (
  n: string,
  stayId: string,
  room: string | null,
  guest: string,
): exely.UniBooking => ({
  id: n,
  number: n,
  currencyId: 'KZT',
  customerComment: null,
  customer: {
    id: guest,
    lastName: 'Тестов',
    firstName: 'Гость',
    middleName: null,
    birthDate: '1990-01-01',
    citizenshipCode: 'KAZ',
    emails: [`${guest}@example.invalid`],
    phones: ['+70000000000'],
    gender: 'Unknown',
  },
  source: { key: '2', value: 'Из канала продаж' },
  sourceChannelName: 'booking.com',
  roomStays: [
    {
      id: stayId,
      bookingId: n,
      roomId: room,
      roomTypeId: '900003',
      checkInDateTime: '2026-09-20T14:00',
      checkOutDateTime: '2026-09-22T12:00',
      actualCheckInDateTime: null,
      actualCheckOutDateTime: null,
      status: 'New',
      bookingStatus: 'Confirmed',
      guestCountInfo: { adults: 1, children: 0 },
      guestsIds: [guest],
      totalPrice: { amount: 12000, toPayAmount: 12000, toRefundAmount: 0 },
    },
  ],
});

describe.skipIf(!url)('importReservations (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  it('imports bookings idempotently with anonymized guests and allocations on real units; rolled back', async () => {
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    const ctx = {
      roomMap: new Map([
        ['R-9010', '9010'],
        ['R-9011', '9011'],
      ]),
      typeMap: new Map([['900003', 'exely-900003']]),
    };
    const records = [
      booking('T-1', 'S-1', 'R-9010', 'G-1'),
      booking('T-2', 'S-2', null, 'G-2'),
    ].map((b) => normalizeExelyReservation(adaptUniBooking(b), ctx));
    await expect(
      db.$transaction(
        async (tx) => {
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          const first = await importReservations(tx, records, {
            propertyId: inv.propertyId,
            anonymizeSalt: 'test-salt',
          });
          expect(first).toMatchObject({
            reservations: { created: 2, updated: 0 },
            items: { created: 2, updated: 0 },
            guests: { created: 2, updated: 0 },
            allocations: { created: 1, updated: 0 },
          });
          const second = await importReservations(tx, records, {
            propertyId: inv.propertyId,
            anonymizeSalt: 'test-salt',
          });
          expect(second).toMatchObject({
            reservations: { created: 0, updated: 2 },
            items: { created: 0, updated: 2 },
            guests: { created: 0, updated: 2 },
            allocations: { created: 0, updated: 1 },
          });
          const g = await tx.guest.findUniqueOrThrow({ where: { exelyPersonId: 'G-1' } });
          expect(g.firstName).toBe('Гость');
          expect(g.lastName).toMatch(/^Тест-/);
          expect(g.email).not.toContain('G-1@');
          const alloc = await tx.allocation.findMany({
            where: { reservationItem: { exelyRoomStayId: 'S-1' } },
            include: { inventoryUnit: true },
          });
          expect(alloc).toHaveLength(1);
          expect(alloc[0]!.inventoryUnit.exelyRoomNumber).toBe('9010');
          expect(
            await tx.allocation.count({ where: { reservationItem: { exelyRoomStayId: 'S-2' } } }),
          ).toBe(0);
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);
});
