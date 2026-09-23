/**
 * Правила досинхронизации Exely → PMS на переходный период (ADR-064, решения владельца 23.09.2026):
 * Q-162 — статус, изменённый стойкой в PMS, повторный импорт не трогает; Q-164 — ручная посадка следует за
 * новыми датами из Exely. Всё внутри откатываемой транзакции, гости вымышленные.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db, type DbTx } from '@pms/database';
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
  from: string,
  to: string,
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
      checkInDateTime: `${from}T14:00`,
      checkOutDateTime: `${to}T12:00`,
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
const ctx = {
  roomMap: new Map([
    ['R-9010', '9010'],
    ['R-9011', '9011'],
  ]),
  typeMap: new Map([['900003', 'exely-900003']]),
};
const norm = (b: exely.UniBooking) => normalizeExelyReservation(adaptUniBooking(b), ctx);
const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe.skipIf(!url)('досинхронизация Exely → PMS: правила переходного периода (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  /** Тестовый объект из фикстур внутри транзакции, которая в конце откатывается */
  const withProperty = (fn: (tx: DbTx, propertyId: string) => Promise<void>) =>
    expect(
      db.$transaction(
        async (tx) => {
          const plan = buildInventoryImportPlan(
            parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
            parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
          );
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          await fn(tx, inv.propertyId);
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);

  it('Q-162: незаезд, поставленный стойкой в PMS, повторный импорт не возвращает в «ждём» и койку не занимает', async () => {
    await withProperty(async (tx, propertyId) => {
      const opts = { propertyId, anonymizeSalt: 'test-salt' };
      const card = booking('Q162-1', 'S-162', 'R-9010', 'G-162', '2026-11-01', '2026-11-03');
      await importReservations(tx, [norm(card)], opts);
      const item = await tx.reservationItem.findUniqueOrThrow({
        where: { exelyRoomStayId: 'S-162' },
        select: { id: true, reservationId: true },
      });
      // Стойка поставила незаезд так, как это делает API: проживание и бронь NO_SHOW, ячейка снята, запись
      // в журнале от человека
      const desk = await tx.user.create({
        data: { email: 'desk-q162@example.invalid', name: 'Смена (тест)' },
        select: { id: true },
      });
      await tx.reservationItem.update({ where: { id: item.id }, data: { status: 'NO_SHOW' } });
      await tx.reservation.update({ where: { id: item.reservationId }, data: { status: 'NO_SHOW' } });
      await tx.allocation.deleteMany({ where: { reservationItemId: item.id } });
      await tx.auditLog.create({
        data: {
          userId: desk.id,
          entityType: 'Reservation',
          entityId: item.reservationId,
          action: 'reservation.noShow',
          after: { status: 'NO_SHOW' },
        },
      });
      // В Exely незаезда нет — карточка по-прежнему «новая»
      const again = await importReservations(tx, [norm(card)], opts);
      const after = await tx.reservationItem.findUniqueOrThrow({
        where: { id: item.id },
        select: { status: true, reservation: { select: { status: true } } },
      });
      expect(after.status).toBe('NO_SHOW');
      expect(after.reservation.status).toBe('NO_SHOW');
      expect(await tx.allocation.count({ where: { reservationItemId: item.id } })).toBe(0);
      expect(again.statusKept).toEqual([
        { confirmationNumber: 'Q162-1', exelyRoomStayId: null, pmsStatus: 'NO_SHOW', exelyStatus: 'CONFIRMED' },
        { confirmationNumber: 'Q162-1', exelyRoomStayId: 'S-162', pmsStatus: 'NO_SHOW', exelyStatus: 'CONFIRMED' },
      ]);
    });
  }, 180_000);

  it('Q-162: статус, изменённый не стойкой (записи человека в журнале нет), импорт по-прежнему приводит к Exely', async () => {
    await withProperty(async (tx, propertyId) => {
      const opts = { propertyId, anonymizeSalt: 'test-salt' };
      const card = booking('Q162-2', 'S-163', 'R-9011', 'G-163', '2026-11-01', '2026-11-03');
      await importReservations(tx, [norm(card)], opts);
      await tx.reservationItem.update({
        where: { exelyRoomStayId: 'S-163' },
        data: { status: 'TENTATIVE' },
      });
      const again = await importReservations(tx, [norm(card)], opts);
      const after = await tx.reservationItem.findUniqueOrThrow({
        where: { exelyRoomStayId: 'S-163' },
        select: { status: true },
      });
      expect(after.status).toBe('CONFIRMED');
      expect(again.statusKept).toEqual([]);
    });
  }, 180_000);

  it('Q-164: ручная посадка следует за новыми датами из Exely, а если на новые ночи ячейка занята — снимается', async () => {
    await withProperty(async (tx, propertyId) => {
      const opts = { propertyId, anonymizeSalt: 'test-salt' };
      // Exely комнату не назначил — стойка посадила гостя на 9010 руками
      await importReservations(
        tx,
        [norm(booking('Q164-1', 'S-164', null, 'G-164', '2026-11-01', '2026-11-03'))],
        opts,
      );
      const item = await tx.reservationItem.findUniqueOrThrow({
        where: { exelyRoomStayId: 'S-164' },
        select: { id: true },
      });
      const u9010 = await tx.inventoryUnit.findFirstOrThrow({
        where: { exelyRoomNumber: '9010', accommodationType: { propertyId } },
        select: { id: true },
      });
      await tx.allocation.create({
        data: {
          reservationItemId: item.id,
          inventoryUnitId: u9010.id,
          startDate: day('2026-11-01'),
          endDate: day('2026-11-03'),
        },
      });
      // В Exely бронь сдвинули на ночь позже — посадка переехала на новые ночи той же ячейки
      const moved = await importReservations(
        tx,
        [norm(booking('Q164-1', 'S-164', null, 'G-164', '2026-11-02', '2026-11-04'))],
        opts,
      );
      expect(
        await tx.allocation.findMany({
          where: { reservationItemId: item.id },
          select: { inventoryUnitId: true, startDate: true, endDate: true },
        }),
      ).toEqual([{ inventoryUnitId: u9010.id, startDate: day('2026-11-02'), endDate: day('2026-11-04') }]);
      expect(moved.reseated).toEqual([
        expect.objectContaining({ confirmationNumber: 'Q164-1', exelyRoomStayId: 'S-164' }),
      ]);
      // Ночь 04→05 на 9010 занял другой гость из Exely, а бронь Q164-1 продлили до 05: посадка снимается
      await importReservations(
        tx,
        [norm(booking('Q164-2', 'S-165', 'R-9010', 'G-165', '2026-11-04', '2026-11-05'))],
        opts,
      );
      const longer = await importReservations(
        tx,
        [norm(booking('Q164-1', 'S-164', null, 'G-164', '2026-11-02', '2026-11-05'))],
        opts,
      );
      expect(await tx.allocation.count({ where: { reservationItemId: item.id } })).toBe(0);
      expect(longer.unseated).toEqual([
        expect.objectContaining({
          confirmationNumber: 'Q164-1',
          exelyRoomStayId: 'S-164',
          arrivalDate: '2026-11-02',
          departureDate: '2026-11-05',
        }),
      ]);
    });
  }, 180_000);
});
