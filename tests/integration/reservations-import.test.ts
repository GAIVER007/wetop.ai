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
  it('проживание сменило категорию в Exely — прежняя пересадка в старой категории не сохраняется', async () => {
    // 13.09.2026: бронь Trip.com категории «женская общая» стояла на мужской койке 35 — ночной импорт 12.09 пересадил
    // её туда, пока она была «мужской», а после смены категории импорт сохранял ту же пересадку («ячейка ещё
    // свободна»). Стойка считала койку занятой, канал — нет: сверка T6 «PMS 5, Channex 6».
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    const ctx = {
      roomMap: new Map([
        ['R-9001', '9001'],
        ['R-9003', '9003'],
        ['R-9010', '9010'],
      ]),
      typeMap: new Map([
        ['900001', 'exely-900001'],
        ['900003', 'exely-900003'],
      ]),
    };
    const ofType = (b: exely.UniBooking, roomTypeId: string) => ({
      ...b,
      roomStays: b.roomStays.map((s) => ({ ...s, roomTypeId })),
    });
    const norm = (b: exely.UniBooking) => normalizeExelyReservation(adaptUniBooking(b), ctx);
    await expect(
      db.$transaction(
        async (tx) => {
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          const opts = { propertyId: inv.propertyId, anonymizeSalt: 'test-salt' };
          // A и B — dorm, Exely дал обоим койку 9010: B пересаживается на свободную койку dorm
          // C и D занимают оба одиночных номера на те же даты
          await importReservations(
            tx,
            [
              norm(booking('T-30', 'S-30', 'R-9010', 'G-30')),
              norm(booking('T-31', 'S-31', 'R-9010', 'G-31')),
              norm(ofType(booking('T-32', 'S-32', 'R-9001', 'G-32'), '900001')),
              norm(ofType(booking('T-33', 'S-33', 'R-9003', 'G-33'), '900001')),
            ],
            opts,
          );
          const seatedB = await tx.allocation.findFirstOrThrow({
            where: { reservationItem: { exelyRoomStayId: 'S-31' } },
            include: { inventoryUnit: { include: { accommodationType: true } } },
          });
          expect(seatedB.inventoryUnit.accommodationType.code).toBe('exely-900003');

          // В Exely B стал одиночным номером 9001 (занят C): прежняя койка dorm свободна, но это чужая категория
          await importReservations(tx, [norm(ofType(booking('T-31', 'S-31', 'R-9001', 'G-31'), '900001'))], opts);
          const item = await tx.reservationItem.findUniqueOrThrow({
            where: { exelyRoomStayId: 'S-31' },
            include: {
              accommodationType: true,
              allocations: { include: { inventoryUnit: { include: { accommodationType: true } } } },
            },
          });
          expect(item.accommodationType.code).toBe('exely-900001');
          // одиночных свободных нет — без ячейки, но не на койке dorm
          expect(
            item.allocations.map((a) => a.inventoryUnit.accommodationType.code),
          ).not.toContain('exely-900003');
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);

  it('Q-118: повторный импорт не стирает гражданство, введённое на стойке; пустое — заполняет', async () => {
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    const ctx = {
      roomMap: new Map([['R-9010', '9010']]),
      typeMap: new Map([['900003', 'exely-900003']]),
    };
    // как у броней каналов в Exely: гражданства нет вовсе
    const noCitizenship = booking('T-9', 'S-9', 'R-9010', 'G-9');
    noCitizenship.customer.citizenshipCode = null;
    const records = [normalizeExelyReservation(adaptUniBooking(noCitizenship), ctx)];
    await expect(
      db.$transaction(
        async (tx) => {
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          const opts = { propertyId: inv.propertyId, anonymizeSalt: 'test-salt' };
          await importReservations(tx, records, opts);
          const imported = await tx.guest.findUniqueOrThrow({ where: { exelyPersonId: 'G-9' } });
          expect(imported.citizenship).toBeNull();

          // стойка вписала код с паспорта перед заселением
          await tx.guest.update({ where: { id: imported.id }, data: { citizenship: 'KAZ' } });
          // ночная синхронизация суток тянет ту же бронь ещё раз
          await importReservations(tx, records, opts);
          const afterSync = await tx.guest.findUniqueOrThrow({ where: { exelyPersonId: 'G-9' } });
          expect(afterSync.citizenship?.trim()).toBe('KAZ');

          // а когда в Exely гражданство есть, а в PMS пусто — импорт его заполняет
          const withCode = booking('T-10', 'S-10', null, 'G-10');
          await importReservations(
            tx,
            [normalizeExelyReservation(adaptUniBooking(withCode), ctx)],
            opts,
          );
          const filled = await tx.guest.findUniqueOrThrow({ where: { exelyPersonId: 'G-10' } });
          expect(filled.citizenship?.trim()).toBe('KAZ');
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);

  const dorm = {
    roomMap: new Map([
      ['R-9010', '9010'],
      ['R-9011', '9011'],
      ['R-9012', '9012'],
    ]),
    typeMap: new Map([['900003', 'exely-900003']]),
  };
  const dated = (b: exely.UniBooking, from: string, to: string): exely.UniBooking => ({
    ...b,
    roomStays: b.roomStays.map((st) => ({ ...st, checkInDateTime: `${from}T14:00`, checkOutDateTime: `${to}T12:00` })),
  });
  const seatsOf = (tx: Parameters<Parameters<Db['$transaction']>[0]>[0], stayId: string) =>
    tx.allocation.findMany({
      where: { reservationItem: { exelyRoomStayId: stayId } },
      include: { inventoryUnit: true },
      orderBy: { startDate: 'asc' },
    });
  const nights = (rows: Awaited<ReturnType<typeof seatsOf>>) =>
    rows.map((a) => `${a.inventoryUnit.code} ${a.startDate.toISOString().slice(0, 10)}→${a.endDate.toISOString().slice(0, 10)}`);

  it('ADR-044: гость переехал посреди проживания — до переезда своя койка, дальше койка из Exely; повтор ничего не меняет', async () => {
    // 14.09.2026: Exely хранит одну комнату на весь срок, а в первую ночь на новой койке спал другой гость
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    const norm = (b: exely.UniBooking) => normalizeExelyReservation(adaptUniBooking(b), dorm);
    await expect(
      db.$transaction(
        async (tx) => {
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          const opts = { propertyId: inv.propertyId, anonymizeSalt: 'test-salt' };
          await importReservations(
            tx,
            [
              norm(dated(booking('T-50', 'S-50', 'R-9010', 'G-50'), '2026-09-19', '2026-09-20')),
              norm(dated(booking('T-51', 'S-51', 'R-9011', 'G-51'), '2026-09-19', '2026-09-22')),
            ],
            { ...opts, today: '2026-09-19' },
          );
          expect(nights(await seatsOf(tx, 'S-51'))).toEqual(['9011 2026-09-19→2026-09-22']);

          // 20.09 гость перешёл на 9010; в Exely у проживания теперь 9010 на весь срок
          const moved = norm(dated(booking('T-51', 'S-51', 'R-9010', 'G-51'), '2026-09-19', '2026-09-22'));
          const report = await importReservations(tx, [moved], { ...opts, today: '2026-09-21' });
          const seats = await seatsOf(tx, 'S-51');
          expect(nights(seats)).toEqual(['9011 2026-09-19→2026-09-20', '9010 2026-09-20→2026-09-22']);
          expect(report.conflicts).toEqual([
            expect.objectContaining({ movedTo: '9011', split: { at: '2026-09-20', to: '9010' }, from: '2026-09-19', to: '2026-09-20' }),
          ]);
          expect(report.unassigned).toBe(0);

          // следующий прогон: те же назначения, записи не переписываются
          await importReservations(tx, [moved], { ...opts, today: '2026-09-22' });
          expect((await seatsOf(tx, 'S-51')).map((a) => a.id)).toEqual(seats.map((a) => a.id));
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);

  it('Q-120: одной свободной койки на весь срок нет, а каждую ночь есть — две койки с одним переездом', async () => {
    const plan = buildInventoryImportPlan(
      parseExelyInventory(readFileSync(resolve(FIXTURES, 'inventory.md'), 'utf-8')),
      parseExelyAccommodationTypes(readFileSync(resolve(FIXTURES, 'spravochniki.md'), 'utf-8')),
    );
    const norm = (b: exely.UniBooking) => normalizeExelyReservation(adaptUniBooking(b), dorm);
    await expect(
      db.$transaction(
        async (tx) => {
          const inv = await importInventoryPlan(tx, plan, TEST_PROPERTY);
          const opts = { propertyId: inv.propertyId, anonymizeSalt: 'test-salt', today: '2026-09-18' };
          // 20.09: заняты 9010 и 9011, свободна 9012; 21.09: заняты 9010 и 9012, свободна 9011
          const report = await importReservations(
            tx,
            [
              norm(dated(booking('T-60', 'S-60', 'R-9010', 'G-60'), '2026-09-20', '2026-09-22')),
              norm(dated(booking('T-61', 'S-61', 'R-9011', 'G-61'), '2026-09-20', '2026-09-21')),
              norm(dated(booking('T-62', 'S-62', 'R-9012', 'G-62'), '2026-09-21', '2026-09-22')),
              // Exely дал 9010, она занята T-60 на обе ночи
              norm(dated(booking('T-63', 'S-63', 'R-9010', 'G-63'), '2026-09-20', '2026-09-22')),
            ],
            opts,
          );
          expect(nights(await seatsOf(tx, 'S-63'))).toEqual(['9012 2026-09-20→2026-09-21', '9011 2026-09-21→2026-09-22']);
          expect(report.conflicts).toEqual([
            expect.objectContaining({ confirmationNumber: 'T-63', movedTo: '9012', split: { at: '2026-09-21', to: '9011' } }),
          ]);
          expect(report.unassigned).toBe(0);
          throw new Rollback('rollback');
        },
        { timeout: 120_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
  }, 180_000);
});
