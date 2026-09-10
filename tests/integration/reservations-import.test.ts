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
  toPay = 12000,
  stayStatus: 'New' | 'Cancelled' = 'New',
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
      status: stayStatus,
      bookingStatus: stayStatus === 'Cancelled' ? 'Cancelled' : 'Confirmed',
      guestCountInfo: { adults: 1, children: 0 },
      guestsIds: [guest],
      totalPrice: { amount: 12000, toPayAmount: toPay, toRefundAmount: 0 },
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
      booking('T-3', 'S-3', 'R-9011', 'G-3', 4000), // оплачено 8 000 из 12 000
      booking('T-4', 'S-4', 'R-9010', 'G-4', 12000, 'Cancelled'), // отменена, та же комната и даты, что T-1
      booking('T-5', 'S-5', 'R-9011', 'G-5'), // активная, та же комната и даты, что T-3 → конфликт, без ячейки
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
            reservations: { created: 5, updated: 0 },
            items: { created: 5, updated: 0 },
            guests: { created: 5, updated: 0 },
            // отменённая T-4 ячейку не занимает; T-5 конфликтует по комнате Exely и пересаживается
            // на свободную ячейку той же категории — без ячейки её не видно на шахматке
            allocations: { created: 3, updated: 0 },
            unassigned: 1, // только T-2: в Exely комната не назначена вовсе
            paymentsImported: 1,
          });
          const second = await importReservations(tx, records, {
            propertyId: inv.propertyId,
            anonymizeSalt: 'test-salt',
          });
          expect(second).toMatchObject({
            reservations: { created: 0, updated: 5 },
            items: { created: 0, updated: 5 },
            guests: { created: 0, updated: 5 },
            // повтор не пересаживает заново: пересаженная ячейка остаётся за проживанием
            allocations: { created: 0, updated: 3, released: 0 },
            paymentsImported: 0, // повтор — без дубля платежа
          });
          // DATA_MODEL §6: у каждого проживания ровно один счёт с одним начислением «проживание» = цене
          const folios = await tx.folio.findMany({
            where: { reservationItem: { exelyRoomStayId: { in: ['S-1', 'S-2', 'S-3'] } } },
            include: { charges: true, allocations: true },
          });
          expect(folios).toHaveLength(3);
          for (const f of folios) {
            expect(f.currency).toBe('KZT');
            expect(f.charges.filter((c) => c.voidedAt === null)).toHaveLength(1);
            expect(f.charges[0]).toMatchObject({ kind: 'ACCOMMODATION', amount: 1200000n });
          }
          const paid = await tx.payment.findMany({
            where: { propertyId: inv.propertyId },
            include: { allocations: true },
          });
          expect(paid).toHaveLength(1);
          expect(paid[0]).toMatchObject({
            method: 'EXTERNAL',
            amount: 800000n,
            externalReference: 'exely:S-3',
            status: 'COMPLETED',
          });
          expect(paid[0]!.allocations).toHaveLength(1);
          expect(paid[0]!.allocations[0]!.amount).toBe(800000n);
          // Цена изменилась в Exely → старое начисление сторнируется, новое = новой цене; платёж не трогаем
          const changed = records.map((r) =>
            r.confirmationNumber === records[2]!.confirmationNumber
              ? { ...r, items: r.items.map((it) => ({ ...it, priceMinor: 1500000n })) }
              : r,
          );
          await importReservations(tx, changed, {
            propertyId: inv.propertyId,
            anonymizeSalt: 'test-salt',
          });
          const f3 = await tx.folio.findFirstOrThrow({
            where: { reservationItem: { exelyRoomStayId: 'S-3' } },
            include: { charges: { orderBy: { createdAt: 'asc' } } },
          });
          expect(f3.charges).toHaveLength(2);
          expect(f3.charges[0]!.voidedAt).not.toBeNull();
          expect(f3.charges[1]).toMatchObject({ amount: 1500000n, voidedAt: null });
          expect(first.conflicts).toEqual([
            {
              confirmationNumber: records[4]!.confirmationNumber,
              exelyRoomNumber: '9011',
              arrivalDate: '2026-09-20',
              departureDate: '2026-09-22',
              conflictsWith: records[2]!.confirmationNumber,
              from: '2026-09-20',
              to: '2026-09-22',
              movedTo: expect.any(String), // куда пересадили: рассадка идёт проходом после импорта
            },
          ]);
          expect(second.conflicts).toHaveLength(1);
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
          // T-2 без комнаты в Exely и отменённая T-4 ячейку не занимают
          expect(
            await tx.allocation.count({
              where: { reservationItem: { exelyRoomStayId: { in: ['S-2', 'S-4'] } } },
            }),
          ).toBe(0);
          // T-5 пересажена: ячейка есть, и это НЕ занятая комната 9011 из Exely
          const moved = await tx.allocation.findMany({
            where: { reservationItem: { exelyRoomStayId: 'S-5' } },
            include: { inventoryUnit: true },
          });
          expect(moved).toHaveLength(1);
          expect(moved[0]!.inventoryUnit.exelyRoomNumber).not.toBe('9011');
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);
});
