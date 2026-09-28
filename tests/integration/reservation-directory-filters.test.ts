import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { todayAt } from '@pms/domain';
import { LUXX_APARTS_PROPERTY } from '@pms/imports';
import {
  ReservationDirectory,
  type DirectoryQuery,
} from '../../apps/api/src/hotel/reservation-directory';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { financeState } from '../../apps/web/src/app/reservations/finance-state';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

const plus = (date: string, n: number) =>
  new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
const day = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * «Брони v2», срез R2 (ADR-106, plans/reservations-v2-r2-2026-09-27.md): отбор каталога броней идёт на
 * сервере. Здесь доказывается то, чего не видит юнит-тест с подделкой базы, — что SQL-отбор по деньгам,
 * «Требуют внимания», сортировка по долгу и сутки создания работают на настоящем PostgreSQL, а состояния
 * оплаты в SQL совпадают с тем, что стойка рисует в колонке «Финансы» (`financeState` поверх folioBalance).
 *
 * Восемь вымышленных броней (ADR-010) пишутся внутри транзакции и откатываются.
 */
describe.skipIf(!url)('каталог броней: отбор на сервере (integration, rolled back)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    if (db) await db.$disconnect();
  });

  it('виды, даты, источник, оплата, размещение, категория и сортировка — по данным базы', async () => {
    const prefix = `R2IT${Date.now().toString(36).toUpperCase()}`;
    const code = (key: string) => `${prefix}-${key}`;
    type Seen = Record<
      string,
      { numbers: string[]; total: number; counts?: Record<string, number> }
    >;
    const seen: Seen = {};
    let today = '';
    let wide: Awaited<ReturnType<ReservationDirectory['list']>>['rows'] = [];
    const typeCodes: Record<string, string[]> = {};
    let codes = { room: '', bed: '' };
    class Rollback extends Error {}

    await db
      .$transaction(
        async (tx) => {
          forgetPropertyRef();
          const property = await tx.property.findFirstOrThrow({
            where: { name: LUXX_APARTS_PROPERTY.name },
            orderBy: { createdAt: 'asc' },
            select: { id: true, currency: true, timezone: true },
          });
          today = todayAt(property.timezone);
          const T = today;
          // Ячейка, свободная на даты этой брони: иначе сработает ограничение пересечения размещений.
          // Свои же размещения транзакция видит, поэтому две брони одну ячейку не получат.
          const pick = async (kind: 'ROOM' | 'BED', from: number, to: number) => {
            const busy = await tx.allocation.findMany({
              where: { startDate: { lt: day(plus(T, to)) }, endDate: { gt: day(plus(T, from)) } },
              select: { inventoryUnitId: true },
            });
            return tx.inventoryUnit.findFirstOrThrow({
              where: {
                active: true,
                kind,
                accommodationType: { propertyId: property.id },
                id: { notIn: busy.map((b) => b.inventoryUnitId) },
              },
              orderBy: { code: 'asc' },
              select: {
                id: true,
                accommodationTypeId: true,
                accommodationType: { select: { code: true } },
              },
            });
          };
          type Unit = Awaited<ReturnType<typeof pick>>;
          /** Ячейки, выданные брони: без размещения проживание берёт категорию у ячейки другой брони */
          const units: Record<string, Unit> = {};
          const seed = async (
            key: string,
            r: {
              status: 'TENTATIVE' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
              source: 'OTA' | 'DESK' | 'WEBSITE' | 'PHONE';
              channel?: string;
              from: number;
              to: number;
              total: bigint;
              createdDaysAgo?: number;
              /** Вид ячейки — назначить свободную; `{ typeOf }` — без ячейки, категория как у брони typeOf */
              items: Array<'ROOM' | 'BED' | { typeOf: string }>;
              folio?: {
                charge?: bigint;
                voided?: boolean;
                paid?: bigint;
                refunded?: bigint;
                voidedPayment?: bigint;
              };
            },
          ) => {
            const reservation = await tx.reservation.create({
              data: {
                propertyId: property.id,
                confirmationNumber: code(key),
                source: r.source,
                channel: r.channel ?? null,
                status: r.status,
                arrivalDate: day(plus(T, r.from)),
                departureDate: day(plus(T, r.to)),
                adults: 1,
                currency: property.currency,
                totalAmount: r.total,
                ...(r.createdDaysAgo
                  ? { createdAt: new Date(`${plus(T, -r.createdDaysAgo)}T06:00:00Z`) }
                  : {}),
              },
              select: { id: true },
            });
            typeCodes[code(key)] = [];
            for (const [i, it] of r.items.entries()) {
              const unit = typeof it === 'string' ? await pick(it, r.from, r.to) : null;
              if (unit) units[key] ??= unit;
              const type = unit ?? units[(it as { typeOf: string }).typeOf]!;
              typeCodes[code(key)]!.push(type.accommodationType.code);
              const item = await tx.reservationItem.create({
                data: {
                  reservationId: reservation.id,
                  accommodationTypeId: type.accommodationTypeId,
                  arrivalDate: day(plus(T, r.from)),
                  departureDate: day(plus(T, r.to)),
                  price: r.total,
                  status: r.status,
                },
                select: { id: true },
              });
              if (unit)
                await tx.allocation.create({
                  data: {
                    reservationItemId: item.id,
                    inventoryUnitId: unit.id,
                    startDate: day(plus(T, r.from)),
                    endDate: day(plus(T, r.to)),
                  },
                });
              if (!r.folio || i > 0) continue;
              const folio = await tx.folio.create({
                data: { reservationItemId: item.id, currency: property.currency },
                select: { id: true },
              });
              if (r.folio.charge)
                await tx.charge.create({
                  data: {
                    folioId: folio.id,
                    kind: 'ACCOMMODATION',
                    description: 'Проживание (integration)',
                    unitPrice: r.folio.charge,
                    amount: r.folio.charge,
                    ...(r.folio.voided ? { voidedAt: new Date() } : {}),
                  },
                });
              const pay = async (amount: bigint, status: 'COMPLETED' | 'VOIDED') => {
                const payment = await tx.payment.create({
                  data: {
                    propertyId: property.id,
                    method: 'CASH',
                    amount,
                    currency: property.currency,
                    status,
                    externalReference: `integration:${randomUUID()}`,
                  },
                  select: { id: true },
                });
                await tx.paymentAllocation.create({
                  data: { paymentId: payment.id, folioId: folio.id, amount },
                });
                return payment.id;
              };
              if (r.folio.voidedPayment) await pay(r.folio.voidedPayment, 'VOIDED');
              if (r.folio.paid) {
                const paymentId = await pay(r.folio.paid, 'COMPLETED');
                if (r.folio.refunded)
                  await tx.refund.create({
                    data: { paymentId, folioId: folio.id, amount: r.folio.refunded },
                  });
              }
            }
          };

          // A — заезд сегодня, Booking.com, оплачено; аннулированный платёж в оплату не входит
          await seed('A', {
            status: 'CONFIRMED',
            source: 'OTA',
            channel: 'Booking.com',
            from: 0,
            to: 2,
            total: 100_000n,
            items: ['ROOM'],
            folio: { charge: 100_000n, paid: 100_000n, voidedPayment: 999n },
          });
          // B — проживает, выезд завтра, оплачено частично: долг гостя в доме
          await seed('B', {
            status: 'CHECKED_IN',
            source: 'DESK',
            from: -1,
            to: 1,
            total: 200_000n,
            items: ['BED'],
            folio: { charge: 200_000n, paid: 50_000n },
          });
          // C — будущая, с сайта, без ячейки, не оплачено
          await seed('C', {
            status: 'CONFIRMED',
            source: 'WEBSITE',
            from: 10,
            to: 12,
            total: 300_000n,
            items: [{ typeOf: 'A' }],
            folio: { charge: 300_000n },
          });
          // D — не заехал вовремя (заезд три дня назад, всё ещё подтверждена), счёта нет
          await seed('D', {
            status: 'CONFIRMED',
            source: 'PHONE',
            from: -3,
            to: 3,
            total: 400_000n,
            items: ['ROOM'],
          });
          // E — отменена, начисление сторнировано, предоплата осталась: к возврату
          await seed('E', {
            status: 'CANCELLED',
            source: 'OTA',
            channel: 'Trip.com',
            from: 5,
            to: 6,
            total: 150_000n,
            items: [{ typeOf: 'A' }],
            folio: { charge: 150_000n, voided: true, paid: 100_000n },
          });
          // F — отменена, предоплата возвращена; создана месяц назад
          await seed('F', {
            status: 'CANCELLED',
            source: 'DESK',
            from: 5,
            to: 6,
            total: 50_000n,
            createdDaysAgo: 30,
            items: [{ typeOf: 'A' }],
            folio: { paid: 50_000n, refunded: 50_000n },
          });
          // G — выехал с долгом
          await seed('G', {
            status: 'CHECKED_OUT',
            source: 'DESK',
            from: -5,
            to: -2,
            total: 120_000n,
            items: ['ROOM'],
            folio: { charge: 120_000n },
          });
          // H — групповая: одно место назначено, второе нет
          await seed('H', {
            status: 'CONFIRMED',
            source: 'PHONE',
            from: 20,
            to: 22,
            total: 600_000n,
            items: ['BED', { typeOf: 'H' }],
          });

          codes = {
            room: units['A']!.accommodationType.code,
            bed: units['B']!.accommodationType.code,
          };
          const service = new ReservationDirectory({ db: tx } as unknown as PrismaService);
          const ask = async (name: string, query: DirectoryQuery) => {
            const result = await service.list({ q: prefix, pageSize: '200', ...query });
            seen[name] = {
              numbers: result.rows.map((r) => r.confirmationNumber.slice(prefix.length + 1)),
              total: result.total,
              counts: result.counts,
            };
            return result;
          };
          const wideQuery = { from: plus(T, -10), to: plus(T, 30) };
          wide = (await ask('wide', wideQuery)).rows;
          await ask('today', { view: 'today' });
          await ask('todayCheckedIn', { view: 'today', status: 'CHECKED_IN' });
          await ask('future', { view: 'future' });
          await ask('inhouse', { view: 'inhouse' });
          await ask('attention', { view: 'attention', sort: 'debt' });
          await ask('attentionPage1', { view: 'attention', sort: 'debt', pageSize: '2' });
          await ask('attentionPage2', {
            view: 'attention',
            sort: 'debt',
            pageSize: '2',
            page: '2',
          });
          for (const payment of ['paid', 'partial', 'unpaid', 'due', 'refund', 'refunded'])
            await ask(`payment:${payment}`, { ...wideQuery, payment });
          for (const allocation of ['assigned', 'missing', 'room', 'bed'])
            await ask(`allocation:${allocation}`, { ...wideQuery, allocation });
          for (const allocation of ['assigned', 'missing', 'room', 'bed'])
            await ask(`allocationSql:${allocation}`, { ...wideQuery, allocation, sort: 'debt' });
          await ask('arrivalToday', { date: 'arrival', from: T, to: T });
          await ask('departureTomorrow', { date: 'departure', from: plus(T, 1), to: plus(T, 1) });
          await ask('createdToday', { date: 'created', from: T, to: T });
          await ask('source:booking', { ...wideQuery, source: 'booking' });
          await ask('source:ota', { ...wideQuery, source: 'ota' });
          await ask('source:website', { ...wideQuery, source: 'WEBSITE' });
          await ask('sourceSql:booking', { ...wideQuery, source: 'booking', payment: 'paid' });
          await ask('category:room', { ...wideQuery, category: codes.room });
          await ask('category:bed', { ...wideQuery, category: codes.bed });
          await ask('categorySql:bed', { ...wideQuery, category: codes.bed, sort: 'debt' });
          await ask('sort:amount', { ...wideQuery, sort: 'amount' });
          await ask('sort:new', { ...wideQuery, sort: 'new' });
          await ask('sort:departure', { ...wideQuery, sort: 'departure' });
          await ask('combo:missingUnpaid', {
            ...wideQuery,
            allocation: 'missing',
            payment: 'unpaid',
          });
          await ask('combo:otaRefund', { ...wideQuery, source: 'ota', payment: 'refund' });
          await ask('combo:futureBed', { view: 'future', category: codes.bed });
          await ask('combo:attentionCheckedOut', { view: 'attention', status: 'CHECKED_OUT' });
          throw new Rollback();
        },
        { timeout: 120_000, maxWait: 20_000 },
      )
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
    forgetPropertyRef();

    const set = (name: string) => [...seen[name]!.numbers].sort();
    expect(set('wide')).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    // Быстрые виды
    expect(seen['today']!.numbers).toEqual(['D', 'B', 'A']); // «Сегодня» — ближайший заезд первым
    expect(seen['todayCheckedIn']).toMatchObject({
      numbers: ['B'],
      total: 1,
      counts: { ALL: 3, CONFIRMED: 2, CHECKED_IN: 1 },
    });
    expect(set('future')).toEqual(['C', 'H']);
    expect(set('inhouse')).toEqual(['B']);
    // «Требуют внимания»: без ячейки (C, H), не заехал (D), долг в доме и после выезда (B, G), к возврату (E)
    expect(set('attention')).toEqual(['B', 'C', 'D', 'E', 'G', 'H']);
    const attention = seen['attention']!.numbers;
    expect(attention.slice(0, 3)).toEqual(['C', 'B', 'G']); // долг по убыванию
    expect(attention.at(-1)).toBe('E'); // переплата — отрицательный долг — последней
    expect(seen['attentionPage1']).toMatchObject({ numbers: ['C', 'B'], total: 6 });
    expect(seen['attentionPage2']!.numbers[0]).toBe('G');
    // Оплата — те же состояния, что колонка «Финансы»
    expect(set('payment:paid')).toEqual(['A']);
    expect(set('payment:partial')).toEqual(['B']);
    expect(set('payment:unpaid')).toEqual(['C', 'G']);
    expect(set('payment:due')).toEqual(['B', 'C', 'G']);
    expect(set('payment:refund')).toEqual(['E']);
    expect(set('payment:refunded')).toEqual(['F']);
    const kinds: Record<string, string[]> = {
      paid: ['paid'],
      partial: ['due'],
      unpaid: ['unpaid'],
      due: ['due', 'unpaid'],
      refund: ['refund-due'],
      refunded: ['refunded'],
    };
    for (const [payment, accepted] of Object.entries(kinds)) {
      const byScreen = wide
        .filter((r) => accepted.includes(financeState(r).kind))
        .map((r) => r.confirmationNumber.slice(prefix.length + 1))
        .sort();
      expect(set(`payment:${payment}`), `паритет SQL и «Финансов»: ${payment}`).toEqual(byScreen);
    }
    // Размещение — одинаково в обоих путях (Prisma и SQL)
    for (const prefixName of ['allocation', 'allocationSql']) {
      expect(set(`${prefixName}:assigned`)).toEqual(['A', 'B', 'D', 'G']);
      expect(set(`${prefixName}:missing`)).toEqual(['C', 'H']);
      expect(set(`${prefixName}:room`)).toEqual(['A', 'D', 'G']);
      expect(set(`${prefixName}:bed`)).toEqual(['B', 'H']);
    }
    // Семантика даты
    expect(set('arrivalToday')).toEqual(['A']);
    expect(set('departureTomorrow')).toEqual(['B']);
    expect(set('createdToday')).toEqual(['A', 'B', 'C', 'D', 'E', 'G', 'H']);
    // Источник
    expect(set('source:booking')).toEqual(['A']);
    expect(set('source:ota')).toEqual(['A', 'E']);
    expect(set('source:website')).toEqual(['C']);
    expect(set('sourceSql:booking')).toEqual(['A']);
    // Категория
    const withType = (typeCode: string) =>
      Object.entries(typeCodes)
        .filter(([, list]) => list.includes(typeCode))
        .map(([n]) => n.slice(prefix.length + 1))
        .sort();
    expect(set('category:room')).toEqual(withType(codes.room));
    expect(set('category:bed')).toEqual(withType(codes.bed));
    expect(set('categorySql:bed')).toEqual(withType(codes.bed));
    // Сортировки
    expect(seen['sort:amount']!.numbers).toEqual(['H', 'D', 'C', 'B', 'E', 'G', 'A', 'F']);
    expect(seen['sort:new']!.numbers.at(-1)).toBe('F');
    expect(seen['sort:departure']!.numbers.slice(0, 3)).toEqual(['G', 'B', 'A']);
    // Сочетания
    expect(set('combo:missingUnpaid')).toEqual(['C']);
    expect(set('combo:otaRefund')).toEqual(['E']);
    expect(set('combo:futureBed')).toEqual(['H']);
    expect(seen['combo:attentionCheckedOut']).toMatchObject({
      numbers: ['G'],
      counts: { ALL: 6, CHECKED_OUT: 1 },
    });
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
