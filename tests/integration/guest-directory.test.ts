import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db, type DbTx } from '@pms/database';
import { LUXX_APARTS_PROPERTY, shiftDate } from '@pms/domain';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { forgetPropertyRef, propertyToday } from '../../apps/api/src/database/property-ref';
import {
  PrismaGuestsRepository,
  type GuestDirectoryQuery,
  type GuestDirectoryResult,
} from '../../apps/api/src/guests/guests.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * «Гости v2», G7 (ТЗ §28, §30, §31): отборы и порядок справочника считаются в SQL по тем же фактам, что
 * колонки таблицы (`summarizeGuestStays`). Своя организация с вымышленными гостями — только её гости
 * в выдаче; всё откатывается.
 */
describe.skipIf(!url)(
  'справочник гостей: отборы визита, число визитов, порядок (integration)',
  () => {
    let db: Db;
    beforeAll(() => {
      db = createPrismaClient(url);
    });
    afterAll(async () => {
      await db?.$disconnect();
    });

    it('раздел NONE, последний визит, число визитов, сортировки и числа чипов с отборами', async () => {
      const seen: Record<string, GuestDirectoryResult> = {};
      let today = '';
      await expect(
        db.$transaction(
          async (tx) => {
            forgetPropertyRef();
            // «сегодня» — тот же, что берёт выборка: по поясу объекта стенда
            today = await propertyToday(tx as never, LUXX_APARTS_PROPERTY.name);
            const org = await tx.organization.create({
              data: { name: 'Integration G7' },
              select: { id: true },
            });
            // объект — только в цепочке Business → Location (ADR-104, `properties.location_id NOT NULL`)
            const property = await createPropertyInChain(tx, org.id, {
              name: 'Объект G7 (integration)',
              timezone: 'Asia/Almaty',
              currency: 'KZT',
              checkInTime: '14:00',
              checkOutTime: '12:00',
            });
            const type = await tx.accommodationType.create({
              data: {
                propertyId: property.id,
                code: 'G7-ROOM',
                name: 'Номер G7',
                kind: 'PRIVATE_ROOM',
                capacityAdults: 2,
              },
              select: { id: true },
            });
            const guest = (lastName: string) =>
              tx.guest.create({
                data: { organizationId: org.id, firstName: 'Фикстура', lastName },
                select: { id: true },
              });
            const stay = async (
              tx2: DbTx,
              guestId: string,
              status: 'CHECKED_IN' | 'CHECKED_OUT' | 'CONFIRMED' | 'CANCELLED',
              from: number,
              to: number,
            ) => {
              const arrivalDate = new Date(`${shiftDate(today, from)}T00:00:00Z`);
              const departureDate = new Date(`${shiftDate(today, to)}T00:00:00Z`);
              const r = await tx2.reservation.create({
                data: {
                  propertyId: property.id,
                  confirmationNumber: `G7-${randomUUID().slice(0, 8)}`,
                  source: 'DESK',
                  status,
                  arrivalDate,
                  departureDate,
                  adults: 1,
                  currency: 'KZT',
                  totalAmount: 0n,
                  primaryGuestId: guestId,
                },
                select: { id: true },
              });
              const item = await tx2.reservationItem.create({
                data: {
                  reservationId: r.id,
                  accommodationTypeId: type.id,
                  arrivalDate,
                  departureDate,
                  price: 0n,
                  status,
                },
                select: { id: true },
              });
              await tx2.stayGuest.create({
                data: { reservationItemId: item.id, guestId, isPrimary: true },
              });
            };
            // А — один визит, выехал 3 дня назад: «Недавние», последний визит в 7 днях
            const a = await guest('Алфавитов');
            await stay(tx, a.id, 'CHECKED_OUT', -5, -3);
            // Б — три визита, последний выезд 20 дней назад, плюс будущая бронь: «Ожидаются»
            const b = await guest('Буквин');
            await stay(tx, b.id, 'CHECKED_OUT', -60, -58);
            await stay(tx, b.id, 'CHECKED_OUT', -40, -38);
            await stay(tx, b.id, 'CHECKED_OUT', -22, -20);
            await stay(tx, b.id, 'CONFIRMED', 10, 12);
            // В — живёт сейчас, до этого визитов не было
            const v = await guest('Ведомостев');
            await stay(tx, v.id, 'CHECKED_IN', -1, 2);
            // Г — выехал 60 дней назад и больше не бронировал: «Без активного проживания»
            const g = await guest('Глаголев');
            await stay(tx, g.id, 'CHECKED_OUT', -62, -60);
            // Д — только отменённая бронь: визитов 0, тоже «Без активного проживания»
            const d = await guest('Добров');
            await stay(tx, d.id, 'CANCELLED', 3, 5);

            const guests = new PrismaGuestsRepository({ db: tx } as unknown as PrismaService);
            const run = (over: Partial<GuestDirectoryQuery>) =>
              withSignedInUser({ userId: randomUUID(), organizationId: org.id }, () =>
                guests.directory({ state: 'ALL', q: '', page: 1, pageSize: 25, ...over }),
              );
            seen['all'] = await run({});
            seen['none'] = await run({ state: 'NONE' });
            seen['last7'] = await run({ lastVisit: { days: 7 } });
            seen['last30'] = await run({ lastVisit: { days: 30 } });
            seen['period'] = await run({
              lastVisit: { from: shiftDate(today, -61), to: shiftDate(today, -59) },
            });
            seen['visits1'] = await run({ visits: '1' });
            seen['visits25'] = await run({ visits: '2-5' });
            seen['visits6'] = await run({ visits: '6+' });
            seen['next'] = await run({ sort: 'next' });
            seen['last'] = await run({ sort: 'last' });
            seen['byVisits'] = await run({ sort: 'visits' });
            seen['page2'] = await run({ pageSize: 2, page: 2 });
            seen['search'] = await run({ q: 'букв' });
            throw new Rollback();
          },
          { timeout: 120_000, maxWait: 30_000 },
        ),
      ).rejects.toBeInstanceOf(Rollback);
      forgetPropertyRef();

      const names = (k: string) => seen[k]!.rows.map((r) => r.lastName);
      // по имени по умолчанию; только гости своей организации
      expect(names('all')).toEqual(['Алфавитов', 'Буквин', 'Ведомостев', 'Глаголев', 'Добров']);
      expect(seen['all']!.counts).toEqual({ ALL: 5, INHOUSE: 1, EXPECTED: 1, RECENT: 1, NONE: 2 });
      expect(names('none')).toEqual(['Глаголев', 'Добров']);
      expect(seen['none']!.total).toBe(2);
      // последний визит — дата выезда последнего состоявшегося визита
      expect(names('last7')).toEqual(['Алфавитов']);
      expect(names('last30')).toEqual(['Алфавитов', 'Буквин']);
      expect(names('period')).toEqual(['Глаголев']);
      // числа чипов — с отборами, но без раздела
      expect(seen['last30']!.counts).toEqual({
        ALL: 2,
        INHOUSE: 0,
        EXPECTED: 1,
        RECENT: 1,
        NONE: 0,
      });
      // визиты — состоявшиеся проживания; отменённая бронь визитом не считается
      expect(names('visits1')).toEqual(['Алфавитов', 'Ведомостев', 'Глаголев']);
      expect(names('visits25')).toEqual(['Буквин']);
      expect(names('visits6')).toEqual([]);
      // порядок: ближайший заезд, у кого его нет — в конце по имени
      expect(names('next')).toEqual(['Буквин', 'Алфавитов', 'Ведомостев', 'Глаголев', 'Добров']);
      expect(names('last')).toEqual(['Алфавитов', 'Буквин', 'Глаголев', 'Ведомостев', 'Добров']);
      expect(names('byVisits')).toEqual([
        'Буквин',
        'Алфавитов',
        'Ведомостев',
        'Глаголев',
        'Добров',
      ]);
      // строки страницы — полные, как раньше: состояние и визиты вычислены
      expect(names('page2')).toEqual(['Ведомостев', 'Глаголев']);
      expect(seen['page2']!.total).toBe(5);
      expect(seen['all']!.rows.find((r) => r.lastName === 'Буквин')).toMatchObject({
        state: 'EXPECTED',
        staysCount: 3,
      });
      expect(names('search')).toEqual(['Буквин']);
    });
  },
);

/**
 * «Гости и бронирования» (план guests-bookings-2026-10-09): основное проживание строки, плитки, быстрые виды и
 * новые отборы считает SQL по тем же фактам, что `summarizeGuestStays` и «Требуют внимания» в «Бронях» (R2).
 * Своя организация, свой объект, вымышленные гости (ADR-010); всё откатывается.
 */
describe.skipIf(!url)('справочник гостей: основное проживание, плитки, виды, отборы (integration)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('счёт, источник, ячейка, виды «Сегодня/Выезды/Проблемные», плитки со вчерашним днём и отборы по основному проживанию', async () => {
    const seen: Record<string, GuestDirectoryResult> = {};
    let preview: Awaited<ReturnType<PrismaGuestsRepository['preview']>> = null;
    let today = '';
    await expect(
      db.$transaction(
        async (tx) => {
          forgetPropertyRef();
          today = await propertyToday(tx as never, LUXX_APARTS_PROPERTY.name);
          const org = await tx.organization.create({
            data: { name: 'Integration GB' },
            select: { id: true },
          });
          const property = await createPropertyInChain(tx, org.id, {
            name: 'Объект GB (integration)',
            timezone: 'Asia/Almaty',
            currency: 'KZT',
            checkInTime: '14:00',
            checkOutTime: '12:00',
          });
          const type = await tx.accommodationType.create({
            data: {
              propertyId: property.id,
              code: 'GB-ROOM',
              name: 'Номер GB',
              kind: 'PRIVATE_ROOM',
              capacityAdults: 2,
            },
            select: { id: true },
          });
          const building = await tx.building.create({
            data: { propertyId: property.id, name: 'Корпус GB' },
          });
          const floor = await tx.floor.create({ data: { buildingId: building.id, name: '1' } });
          let unitNo = 0;
          const unit = async () => {
            unitNo += 1;
            const room = await tx.physicalRoom.create({
              data: { floorId: floor.id, roomNumber: String(unitNo), capacity: 2 },
            });
            return tx.inventoryUnit.create({
              data: {
                propertyId: property.id,
                physicalRoomId: room.id,
                accommodationTypeId: type.id,
                code: `GB${unitNo}`,
                kind: 'ROOM',
                active: true,
              },
              select: { id: true, code: true },
            });
          };
          const guest = (lastName: string, contact: { phone?: string; email?: string } = {}) =>
            tx.guest.create({
              data: { organizationId: org.id, firstName: 'Фикстура', lastName, ...contact },
              select: { id: true },
            });
          type Status = 'CHECKED_IN' | 'CHECKED_OUT' | 'CONFIRMED' | 'CANCELLED';
          /** проживание гостя: бронь, позиция, ячейка (если нужна) и счёт с начислениями и платежом */
          const stay = async (
            guestId: string,
            status: Status,
            from: number,
            to: number,
            opts: {
              source?: 'DESK' | 'OTA' | 'WEBSITE' | 'PHONE';
              channel?: string;
              adults?: number;
              children?: number;
              withUnit?: boolean;
              charges?: Array<{ kind: 'ACCOMMODATION' | 'SERVICE'; amount: bigint; description: string }>;
              paid?: bigint;
            } = {},
          ) => {
            const arrivalDate = new Date(`${shiftDate(today, from)}T00:00:00Z`);
            const departureDate = new Date(`${shiftDate(today, to)}T00:00:00Z`);
            const number = `GB-${randomUUID().slice(0, 8)}`;
            const r = await tx.reservation.create({
              data: {
                propertyId: property.id,
                confirmationNumber: number,
                source: opts.source ?? 'DESK',
                channel: opts.channel ?? null,
                status,
                arrivalDate,
                departureDate,
                adults: opts.adults ?? 1,
                currency: 'KZT',
                totalAmount: 0n,
                primaryGuestId: guestId,
              },
              select: { id: true },
            });
            const item = await tx.reservationItem.create({
              data: {
                reservationId: r.id,
                accommodationTypeId: type.id,
                arrivalDate,
                departureDate,
                price: 0n,
                status,
                adults: opts.adults ?? 1,
                children: opts.children ?? 0,
              },
              select: { id: true },
            });
            await tx.stayGuest.create({
              data: { reservationItemId: item.id, guestId, isPrimary: true },
            });
            let unitCode: string | null = null;
            if (opts.withUnit !== false && status !== 'CANCELLED') {
              const u = await unit();
              unitCode = u.code;
              await tx.allocation.create({
                data: {
                  reservationItemId: item.id,
                  inventoryUnitId: u.id,
                  startDate: arrivalDate,
                  endDate: departureDate,
                },
              });
            }
            if (opts.charges) {
              const folio = await tx.folio.create({
                data: { reservationItemId: item.id, currency: 'KZT' },
                select: { id: true },
              });
              for (const c of opts.charges)
                await tx.charge.create({
                  data: {
                    folioId: folio.id,
                    kind: c.kind,
                    description: c.description,
                    unitPrice: c.amount,
                    amount: c.amount,
                    serviceDate: c.kind === 'SERVICE' ? arrivalDate : null,
                  },
                });
              if (opts.paid) {
                const payment = await tx.payment.create({
                  data: {
                    propertyId: property.id,
                    method: 'KASPI',
                    amount: opts.paid,
                    currency: 'KZT',
                    externalReference: `integration:${randomUUID()}`,
                  },
                  select: { id: true },
                });
                await tx.paymentAllocation.create({
                  data: { paymentId: payment.id, folioId: folio.id, amount: opts.paid },
                });
              }
            }
            return { number, unitCode };
          };
          const room = (amount: bigint) => [
            { kind: 'ACCOMMODATION' as const, amount, description: 'Проживание (integration)' },
          ];

          // А: живёт, оплачено полностью, источник канал, 2+1 гостя; раньше уже был (два визита); у счёта есть услуга
          const a = await guest('Анварова', { phone: '+77000000001' });
          const aNow = await stay(a.id, 'CHECKED_IN', -1, 2, {
            source: 'OTA',
            channel: 'Booking.com',
            adults: 2,
            children: 1,
            charges: [
              ...room(2_600_000n),
              { kind: 'SERVICE', amount: 400_000n, description: 'Завтрак (integration)' },
            ],
            paid: 3_000_000n,
          });
          await stay(a.id, 'CHECKED_OUT', -40, -38, { charges: room(1_000_000n), paid: 1_000_000n });
          // Б: живёт, выезд сегодня, долг 3 000 000 при оплате 2 000 000
          const b = await guest('Байжанов', { email: 'b@example.test' });
          await stay(b.id, 'CHECKED_IN', -3, 0, { charges: room(5_000_000n), paid: 2_000_000n });
          // В: заезд сегодня, сайт, ещё не оплачено (будущая бронь, не долг)
          const v = await guest('Волков');
          await stay(v.id, 'CONFIRMED', 0, 2, { source: 'WEBSITE', charges: room(1_000_000n) });
          // Г: ожидается через 5 дней, телефон, БЕЗ ячейки: «Проблемные»
          const g = await guest('Громов');
          await stay(g.id, 'CONFIRMED', 5, 7, { source: 'PHONE', withUnit: false });
          // Д: выехал 8 дней назад, всё оплачено
          const d = await guest('Дьяков', { phone: '+77000000002' });
          await stay(d.id, 'CHECKED_OUT', -10, -8, { charges: room(800_000n), paid: 800_000n });
          // Е: только отменённая бронь, основного проживания нет
          const e = await guest('Ержанов');
          await stay(e.id, 'CANCELLED', 3, 5);
          // Ж: выехал давно, оплатил больше начисленного, деньги ждут возврата («Проблемные»)
          const zh = await guest('Жумабаев');
          await stay(zh.id, 'CHECKED_OUT', -70, -68, { charges: room(1_000_000n), paid: 1_500_000n });
          // З: выехал вчера, нужен для «выезды вчера»
          const z = await guest('Захаров');
          await stay(z.id, 'CHECKED_OUT', -3, -1, { charges: room(900_000n), paid: 900_000n });

          const guests = new PrismaGuestsRepository({ db: tx } as unknown as PrismaService);
          const run = (over: Partial<GuestDirectoryQuery>) =>
            withSignedInUser({ userId: randomUUID(), organizationId: org.id }, () =>
              guests.directory({ state: 'ALL', q: '', page: 1, pageSize: 25, ...over }),
            );
          seen['all'] = await run({});
          seen['attention'] = await run({ view: 'attention' });
          seen['departures'] = await run({ view: 'departures' });
          seen['today'] = await run({ view: 'today' });
          seen['inhouse'] = await run({ view: 'inhouse' });
          seen['expected'] = await run({ view: 'expected' });
          seen['debt'] = await run({ debt: true });
          seen['fresh'] = await run({ fresh: true });
          seen['nocontact'] = await run({ noContact: true });
          seen['ota'] = await run({ source: 'OTA' });
          seen['booking'] = await run({ channel: 'booking' });
          seen['website'] = await run({ source: 'website' });
          seen['phone'] = await run({ source: 'PHONE' });
          seen['periodToday'] = await run({ stayPeriod: { days: 1 } });
          seen['periodRange'] = await run({
            stayPeriod: { from: shiftDate(today, -12), to: shiftDate(today, -7) },
          });
          seen['stateInhouseDebt'] = await run({ state: 'INHOUSE', debt: true });
          seen['search'] = await run({ q: 'Анвар' });
          seen['page2'] = await run({ pageSize: 3, page: 2, view: 'all' });
          preview = await withSignedInUser({ userId: randomUUID(), organizationId: org.id }, () =>
            guests.preview(a.id),
          );
          seen['aNow'] = { rows: [], total: 0 } as unknown as GuestDirectoryResult;
          (seen['aNow'] as unknown as { number: string; unit: string | null }).number = aNow.number;
          (seen['aNow'] as unknown as { number: string; unit: string | null }).unit = aNow.unitCode;
          throw new Rollback();
        },
        { timeout: 180_000, maxWait: 30_000 },
      ),
    ).rejects.toBeInstanceOf(Rollback);
    forgetPropertyRef();

    const names = (k: string) => seen[k]!.rows.map((r) => r.lastName);
    const all = [
      'Анварова',
      'Байжанов',
      'Волков',
      'Громов',
      'Дьяков',
      'Ержанов',
      'Жумабаев',
      'Захаров',
    ];
    expect(names('all')).toEqual(all);
    // плитки: вся база организации, заезды и выезды ещё и за вчера по датам брони
    expect(seen['all']!.kpi).toEqual({
      all: 8,
      inhouse: 2, // Анварова, Байжанов
      arrivalsToday: 1, // Волков
      departuresToday: 1, // Байжанов
      expected: 2, // Волков, Громов
      attention: 3, // Байжанов (долг), Громов (без ячейки), Жумабаев (возврат)
      none: 2, // Ержанов, Жумабаев
      arrivalsYesterday: 1, // Анварова (заселилась вчера)
      departuresYesterday: 1, // Захаров
    });
    // быстрые виды: числа не зависят от выбранного вида
    expect(seen['all']!.views).toEqual({
      all: 8,
      today: 2,
      inhouse: 2,
      expected: 2,
      departures: 1,
      attention: 3,
    });
    expect(seen['attention']!.views).toEqual(seen['all']!.views);
    expect(names('attention')).toEqual(['Байжанов', 'Громов', 'Жумабаев']);
    expect(seen['attention']!.total).toBe(3);
    expect(names('departures')).toEqual(['Байжанов']);
    expect(names('today')).toEqual(['Байжанов', 'Волков']);
    expect(names('inhouse')).toEqual(['Анварова', 'Байжанов']);
    expect(names('expected')).toEqual(['Волков', 'Громов']);
    // долг: остаток по заселённому или выехавшему проживанию больше нуля; будущая неоплаченная бронь и возврат не долг
    expect(names('debt')).toEqual(['Байжанов']);
    // новые: визитов не больше одного (отменённая и будущая брони визитом не считаются)
    expect(names('fresh')).toEqual([
      'Байжанов',
      'Волков',
      'Громов',
      'Дьяков',
      'Ержанов',
      'Жумабаев',
      'Захаров',
    ]);
    expect(names('nocontact')).toEqual([
      'Волков',
      'Громов',
      'Ержанов',
      'Жумабаев',
      'Захаров',
    ]);
    // источник и канал: про основное проживание (у Анваровой это текущая бронь с канала, а не прежняя со стойки)
    expect(names('ota')).toEqual(['Анварова']);
    expect(names('booking')).toEqual(['Анварова']);
    expect(names('website')).toEqual(['Волков']);
    expect(names('phone')).toEqual(['Громов']);
    // период: даты основного проживания пересекают окно
    expect(names('periodToday')).toEqual(['Анварова', 'Байжанов', 'Волков']);
    expect(names('periodRange')).toEqual(['Дьяков']);
    // раздел и отбор складываются
    expect(names('stateInhouseDebt')).toEqual(['Байжанов']);
    expect(seen['stateInhouseDebt']!.views.attention).toBe(1);
    expect(names('search')).toEqual(['Анварова']);
    expect(seen['page2']!.rows).toHaveLength(3);
    expect(seen['page2']!.total).toBe(8);

    const row = (name: string) => seen['all']!.rows.find((r) => r.lastName === name)!;
    const aNow = seen['aNow'] as unknown as { number: string; unit: string | null };
    expect(row('Анварова').stay).toMatchObject({
      kind: 'current',
      status: 'CHECKED_IN',
      confirmationNumber: aNow.number,
      unitCode: aNow.unit,
      nights: 3,
      adults: 2,
      children: 1,
      source: 'OTA',
      channel: 'Booking.com',
      currency: 'KZT',
      money: { chargedMinor: '3000000', paidMinor: '3000000', refundedMinor: '0', balanceMinor: '0' },
    });
    expect(row('Анварова').staysCount).toBe(2);
    expect(row('Байжанов').stay?.money).toEqual({
      chargedMinor: '5000000',
      paidMinor: '2000000',
      refundedMinor: '0',
      balanceMinor: '3000000',
    });
    // нет счёта: деньги null, а не нули; нет ячейки: unitCode null
    expect(row('Громов').stay).toMatchObject({ kind: 'next', unitCode: null, money: null, source: 'PHONE' });
    expect(row('Ержанов').stay).toBeNull();
    expect(row('Жумабаев').stay).toMatchObject({
      kind: 'last',
      money: { balanceMinor: '-500000' },
    });
    // предпросмотр: то же основное проживание, визиты новыми первыми, услуги только вида SERVICE из счёта проживания
    expect(preview).not.toBeNull();
    expect(preview!.stay).toMatchObject({ kind: 'current', confirmationNumber: aNow.number });
    expect(preview!.visits.map((v) => v.status)).toEqual(['CHECKED_IN', 'CHECKED_OUT']);
    expect(preview!.services).toEqual([
      expect.objectContaining({ description: 'Завтрак (integration)', quantity: 1, amountMinor: '400000' }),
    ]);
    expect(preview!.notes).toBeNull();
  });
});
