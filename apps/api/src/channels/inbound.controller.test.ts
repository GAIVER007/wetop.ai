import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { channex } from '@pms/integrations';
import { CHESSBOARD_REPOSITORY } from '../chessboard/chessboard.repository';
import { PrismaService } from '../database/prisma.provider';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ExternalEventRef,
  type ReservationState,
  type ReservationsRepository,
} from '../reservations/reservations.repository';
import { ChannelsModule } from './channels.module';
import { ARI_PUBLISHER } from './ari-publisher';
import { CHANNELS_REPOSITORY, CHANNEX_GATEWAY, type ChannexGateway } from './channels.repository';
import { InboundBookingsService, decimalToMinor, sanitizeRevision } from './inbound.service';

/** Что вернёт снятие блоков соседних ночей при отмене (ADR-021); тест задаёт, сброс — в beforeEach */
let releasedBlocks: Array<{ categoryCode: string; from: string; toExclusive: string }> = [];
/** Дельты доступности, поставленные в очередь; inTx — шла ли в этот момент транзакция разбора ревизии */
type Range = { categoryCode: string; from: string; toExclusive: string };
const published: Array<{
  categoryCodes: string[];
  from: string;
  toExclusive: string;
  ranges?: Range[];
  inTx: boolean;
}> = [];
const deltaLostLog: string[] = [];
let inTx = false;
let publishFails = false;
const recordingPublisher = {
  async reservationChanged(c: {
    categoryCodes: string[];
    from: string;
    toExclusive: string;
    ranges?: Range[];
  }) {
    if (publishFails) throw new Error('очередь недоступна');
    published.push({ ...c, inTx });
  },
  async ratesChanged() {
    return 0;
  },
  async deltaLost(_c: unknown, error: string) {
    deltaLostLog.push(error);
  },
};

/** Ревизия по примеру bookings-collection.md (Booking.com), гость вымышленный. */
function revision(
  over: Partial<channex.ChannexBookingRevisionAttributes> = {},
): channex.ChannexResource<channex.ChannexBookingRevisionAttributes> {
  const attrs: channex.ChannexBookingRevisionAttributes = {
    id: over.id ?? 'rev-1',
    property_id: 'prop-1',
    booking_id: 'bk-1',
    unique_id: 'BDC-9996013801',
    ota_reservation_code: '9996013801',
    ota_name: 'Booking.com',
    status: 'new',
    rooms: [
      {
        checkin_date: '2026-11-10',
        checkout_date: '2026-11-12',
        rate_plan_id: 'rp-3',
        room_type_id: 'rt-2',
        occupancy: { adults: 1, children: 0, infants: 0 },
        guests: [{ name: 'Guest', surname: 'Name' }],
        amount: '30800.00',
        days: { '2026-11-10': '15400.00', '2026-11-11': '15400.00' },
      },
    ],
    guarantee: {
      card_number: '411111******1111',
      cvv: '***',
      expiration_date: '10/2030',
      cardholder_name: 'Channex User',
      card_type: 'VI',
    },
    customer: {
      name: 'User',
      surname: 'Channex',
      mail: 'user@example.invalid',
      phone: '+70000000000',
      country: 'NL',
    },
    occupancy: { adults: 1, children: 0, infants: 0 },
    arrival_date: '2026-11-10',
    departure_date: '2026-11-12',
    amount: '30800.00',
    currency: 'KZT',
    notes: 'quiet room please',
    inserted_at: '2026-09-09T10:03:29.335485',
    ...over,
  };
  return { type: 'booking_revision', id: attrs.id, attributes: attrs };
}

function makeFakes() {
  const events = new Map<
    string,
    ExternalEventRef & {
      type: string;
      payload: unknown;
      lastError?: string | null;
      receivedVia?: string | undefined;
    }
  >();
  const reservations = new Map<
    string,
    ReservationState & {
      adults: number;
      totalAmountMinor: bigint;
      guestId: string;
      source: string;
      channel: string | null;
      notes: string | null;
    }
  >();
  const allocations: Array<{
    id: string;
    itemId: string;
    unitId: string;
    start: string;
    end: string;
  }> = [];
  const audits: string[] = [];
  /** Записи журнала целиком — для before/after (SECURITY.md §6) */
  const auditEntries: Array<{ action: string; before?: unknown; after?: unknown }> = [];
  const acks: string[] = [];
  /** С каким объектом читали ленту: webhook читает ленту своего объекта (property_id события) */
  const feedCalls: Array<string | undefined> = [];
  let feed: Array<channex.ChannexResource<channex.ChannexBookingRevisionAttributes>> = [];
  let n = 0;
  const id = (p: string) => `${p}${++n}`;
  // Только лента и ack: ревизию по ID PMS не читает (сценарий 11 сертификации Channex, 24.09.2026)
  const gateway: Pick<ChannexGateway, 'bookingRevisionsFeed' | 'ackBookingRevision'> = {
    async bookingRevisionsFeed(propertyId) {
      feedCalls.push(propertyId);
      return feed;
    },
    async ackBookingRevision(revId) {
      acks.push(revId);
    },
  };
  const state = (): ReservationState[] => [...reservations.values()];
  const penalties: Array<{ itemId: string; amountMinor: bigint; description: string }> = [];
  const guests: Array<{ firstName: string; lastName: string; phone?: string | null }> = [];
  const prepayments: Array<{ itemId: string; amountMinor: bigint; externalReference: string }> = [];
  /** Оплачено не каналом (перенос из Legacy, стойка) — баланс счёта проживания в тестах ADR-024 */
  const paidExternally = new Map<string, bigint>();
  const repo: ReservationsRepository = {
    promoByCode: async () => null,
    lockPromo: async () => undefined,
    async today() {
      // как прежний жёсткий UTC+5 — под фальшивыми часами тестов даёт ту же дату
      return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    },
    async property() {
      return { id: 'P', currency: 'KZT', timezone: 'Asia/Almaty' };
    },
    async categoryByCode() {
      return null;
    },
    async activeCategories() {
      return [];
    },
    async categoryById() {
      return null;
    },
    // как в Prisma: начислено (цена проживания) − оплачено (платежи Legacy/стойки + предоплаты канала)
    async stayBalanceMinor(itemId) {
      const item = [...reservations.values()].flatMap((r) => r.items).find((i) => i.id === itemId);
      if (!item) return 0n;
      const paid =
        (paidExternally.get(itemId) ?? 0n) +
        prepayments.filter((p) => p.itemId === itemId).reduce((sum, p) => sum + p.amountMinor, 0n);
      return item.priceMinor - paid;
    },
    async recordChannelPrepayment(itemId, amountMinor, externalReference) {
      const i = prepayments.findIndex((p) => p.externalReference === externalReference);
      if (i >= 0) prepayments.splice(i, 1);
      prepayments.push({ itemId, amountMinor, externalReference });
    },
    async releaseStayExtraBlocks() {
      return releasedBlocks;
    },
    async settleChannelPrepaymentAfterCancel(itemId) {
      // как в Prisma: остаётся ровно сумма штрафов проживания, без штрафа предоплата снимается
      const penalty = penalties
        .filter((p) => p.itemId === itemId)
        .reduce((s, p) => s + p.amountMinor, 0n);
      for (let i = prepayments.length - 1; i >= 0; i -= 1) {
        const p = prepayments[i]!;
        if (p.itemId !== itemId) continue;
        const keep = penalty < p.amountMinor ? penalty : p.amountMinor;
        if (keep === 0n) prepayments.splice(i, 1);
        else p.amountMinor = keep;
      }
    },
    async voidChannelPrepayment(externalReference) {
      const i = prepayments.findIndex((p) => p.externalReference === externalReference);
      if (i >= 0) prepayments.splice(i, 1);
    },
    async closeFolio() {},
    async ratePlanByCode() {
      return null;
    },
    async ratePlanById() {
      return null;
    },
    async addPenaltyCharge(itemId, amountMinor, description) {
      penalties.push({ itemId, amountMinor, description });
    },
    async activeRatePlans() {
      return [];
    },
    async ratePlanCoversType() {
      return false;
    },
    async nightRates() {
      return [];
    },
    async unitHousekeeping() {
      return null;
    },
    async setUnitHousekeeping() {},
    async unitByCode() {
      return null;
    },
    async hasBlockOverlap() {
      return false;
    },
    async hasAllocationOverlap(unitId, from, to, exceptItemId) {
      return allocations.some(
        (x) => x.unitId === unitId && x.itemId !== exceptItemId && x.start < to && x.end > from,
      );
    },
    // одна ячейка категории: свободна, если ни одно назначение не пересекает период
    async freeUnits() {
      return [];
    },
    async lockCategories() {},
    async lockReservation() {},
    async categoryAvailability() {
      return 99;
    },
    async restrictionsFor() {
      return [];
    },
    async firstFreeUnit(accommodationTypeId, from, to) {
      const busy = allocations.some((x) => x.unitId === 'u-9001' && x.start < to && x.end > from);
      return busy ? null : { id: 'u-9001', code: '9001', accommodationTypeId, active: true };
    },
    async guestForBooking() {
      return null;
    },
    async createGuest(g) {
      guests.push(g);
      return id('g');
    },
    async reservationByCreationKey() {
      return null;
    },
    async createReservation(input) {
      // ошибка записи с данными гостя в тексте — как у Prisma, которая печатает аргументы (SECURITY.md §7)
      if (input.confirmationNumber === 'BDC-FAIL-PII')
        throw new Error(
          'Invalid value for notes: call +7 700 000 00 00, write test.guest@example.com',
        );
      const rid = id('r');
      const items = input.items.map((it) => ({
        id: id('i'),
        accommodationTypeId: it.accommodationTypeId,
        arrivalDate: it.arrivalDate,
        departureDate: it.departureDate,
        status: it.status,
        priceMinor: it.priceMinor,
        guestsCount: 0,
        ratePlanId: it.ratePlanId ?? null,
        adults: it.adults ?? 1,
        children: it.children ?? 0,
        cancellationPenalty: 'FIRST_NIGHT' as const,
        allocations: [],
      }));
      reservations.set(input.confirmationNumber, {
        id: rid,
        confirmationNumber: input.confirmationNumber,
        // как в Prisma: без внешнего ID поле пустое (перенос из Legacy, ADR-024), а не номер брони
        externalId: input.externalId ?? null,
        status: input.status,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        currency: input.currency,
        items,
        adults: input.adults,
        totalAmountMinor: input.totalAmountMinor,
        guestId: input.primaryGuestId,
        source: input.source,
        channel: input.channel ?? null,
        notes: input.notes,
      });
      return { id: rid, itemIds: items.map((i) => i.id) };
    },
    async addStayGuest(itemId) {
      for (const r of reservations.values())
        for (const it of r.items) if (it.id === itemId) it.guestsCount += 1;
    },
    async createAllocation(itemId, unitId, start, end) {
      allocations.push({ id: id('a'), itemId, unitId, start, end });
    },
    async reservationByNumber(number) {
      const r = reservations.get(number);
      return r ? withAllocations(r) : null;
    },
    async reservationByExternalId(ext) {
      const r = [...reservations.values()].find((x) => x.externalId === ext);
      return r ? withAllocations(r) : null;
    },
    async addReservationItem(reservationId, it) {
      const r = [...reservations.values()].find((x) => x.id === reservationId)!;
      const iid = id('i');
      r.items.push({
        id: iid,
        accommodationTypeId: it.accommodationTypeId,
        arrivalDate: it.arrivalDate,
        departureDate: it.departureDate,
        status: it.status,
        priceMinor: it.priceMinor,
        guestsCount: 0,
        ratePlanId: it.ratePlanId ?? null,
        adults: it.adults ?? 1,
        children: it.children ?? 0,
        cancellationPenalty: 'FIRST_NIGHT' as const,
        allocations: [],
      });
      return iid;
    },
    async channelMappings() {
      return [
        {
          localAccommodationTypeId: 't1',
          localAccommodationTypeCode: 'category-single',
          localRatePlanId: 'p2',
          providerPropertyId: 'prop-1',
          providerRoomTypeId: 'rt-2',
          providerRatePlanId: 'rp-3',
        },
      ];
    },
    async recordExternalEvent(ev) {
      const key = `${ev.provider}|${ev.externalEventId}`;
      const have = events.get(key);
      if (have)
        return {
          id: have.id,
          status: have.status,
          attemptCount: have.attemptCount,
          lastError: have.lastError ?? null,
          isNew: false,
        };
      const created = {
        id: key,
        status: 'RECEIVED' as const,
        attemptCount: 0,
        lastError: null as string | null,
        isNew: true,
        type: ev.type,
        payload: ev.payload,
        receivedVia: ev.receivedVia,
      };
      events.set(key, created);
      return {
        id: created.id,
        status: created.status,
        attemptCount: 0,
        lastError: null,
        isNew: true,
      };
    },
    async resetExternalEventAttempts(provider, externalEventId) {
      const e = events.get(`${provider}|${externalEventId}`);
      if (e) {
        e.attemptCount = 0;
        e.status = 'RECEIVED';
        e.lastError = null;
      }
    },
    async updateExternalEvent(evId, patch) {
      const e = events.get(evId)!;
      e.status = patch.status;
      // счётчик растёт только когда сервис прямо об этом просит — как в настоящем хранилище
      if (patch.countAttempt) e.attemptCount += 1;
      if (patch.lastError !== undefined) e.lastError = patch.lastError;
    },
    async updateItem(itemId, patch) {
      for (const r of reservations.values())
        for (const it of r.items) if (it.id === itemId) Object.assign(it, patch);
    },
    async updateReservation(rid, patch) {
      for (const r of reservations.values()) if (r.id === rid) Object.assign(r, patch);
    },
    async deleteAllocation(aid) {
      const i = allocations.findIndex((a) => a.id === aid);
      if (i >= 0) allocations.splice(i, 1);
    },
    async shortenAllocation() {},
    async replaceAllocationDates(aid, start, end) {
      const a = allocations.find((x) => x.id === aid)!;
      if (a.unitId === 'busy') throw new AllocationOverlapError('busy');
      a.start = start;
      a.end = end;
    },
    async audit(entry) {
      audits.push(entry.action);
      auditEntries.push(JSON.parse(JSON.stringify(entry)));
    },
    async card(number) {
      const r = reservations.get(number);
      if (!r) return null;
      return {
        confirmationNumber: r.confirmationNumber,
        source: 'OTA',
        channel: 'Booking.com',
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        adults: r.adults,
        children: 0,
        currency: r.currency,
        totalAmountMinor: r.totalAmountMinor.toString(),
        notes: null,
        primaryGuest: null,
        items: r.items.map((it) => ({
          id: it.id,
          accommodationTypeCode: 'category-single',
          accommodationTypeName: 'Одиночная',
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          priceMinor: it.priceMinor.toString(),
          ratePlanCode: null,
          ratePlanName: null,
          unitCode: allocations.find((a) => a.itemId === it.id)?.unitId ?? null,
          guests: [],
          adults: 1,
          children: 0,
        })),
      };
    },
  };
  function withAllocations(r: ReservationState): ReservationState {
    return {
      ...r,
      items: r.items.map((it) => ({
        ...it,
        allocations: allocations
          .filter((a) => a.itemId === it.id)
          .map((a) => ({
            id: a.id,
            unitId: a.unitId,
            unitCode: a.unitId,
            startDate: a.start,
            endDate: a.end,
          })),
      })),
    };
  }
  return {
    guests,
    gateway,
    repo,
    penalties,
    prepayments,
    paidExternally,
    events,
    reservations,
    allocations,
    audits,
    auditEntries,
    acks,
    feedCalls,
    setFeed: (f: typeof feed) => (feed = f),
    state,
  };
}

describe('inbound bookings from Channex (contract on fakes)', () => {
  let app: INestApplication;
  let inbound: InboundBookingsService;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
    releasedBlocks = [];
    published.length = 0;
    deltaLostLog.length = 0;
    publishFails = false;
    process.env.CHANNEX_WEBHOOK_SECRET = 'test-webhook-secret';
    // ADR-018: без соли гость канала не запишется вовсе — режим хранения ПД задаётся окружением
    process.env.ANONYMIZE_SALT = 'test-salt';
    delete process.env.PII_STORAGE;
  });
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const m = await Test.createTestingModule({ imports: [ChannelsModule] })
      .overrideProvider(CHANNEX_GATEWAY)
      .useFactory({ factory: () => proxy(() => fakes.gateway) })
      .overrideProvider(RESERVATIONS_UOW)
      .useFactory({
        factory: () => ({
          run: async (fn: (r: ReservationsRepository) => Promise<unknown>) => {
            inTx = true;
            try {
              return await fn(fakes.repo);
            } finally {
              inTx = false;
            }
          },
          read: (fn: (r: ReservationsRepository) => Promise<unknown>) => fn(fakes.repo),
        }),
      })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .overrideProvider(ARI_PUBLISHER)
      .useValue(recordingPublisher)
      .overrideProvider(CHESSBOARD_REPOSITORY)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    inbound = m.get(InboundBookingsService);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('helpers: guarantee (card data) is stripped, decimal amounts become minor units exactly', () => {
    expect(sanitizeRevision(revision().attributes)).not.toHaveProperty('guarantee');
    expect(decimalToMinor('30800.00', 'x')).toBe(3_080_000n);
    expect(decimalToMinor('76.5', 'x')).toBe(7_650n);
    expect(() => decimalToMinor('1e3', 'x')).toThrow(/не десятичное/);
  });

  it('pull: new revision → reservation with the first free unit (Q-094), event PROCESSED without card data, ack; same revision again → duplicate skipped but acked; no free unit → without unit and a warning', async () => {
    fakes.setFeed([revision()]);
    const first = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(first.body).toMatchObject({ received: 1, acknowledged: 1 });
    expect(first.body.outcomes[0]).toMatchObject({
      result: 'created',
      confirmationNumber: 'BDC-9996013801',
      status: 'new',
    });
    const r = fakes.state()[0]!;
    expect(r).toMatchObject({
      confirmationNumber: 'BDC-9996013801',
      status: 'CONFIRMED',
      arrivalDate: '2026-11-10',
      departureDate: '2026-11-12',
      currency: 'KZT',
    });
    expect(r.items[0]).toMatchObject({
      accommodationTypeId: 't1',
      priceMinor: 3_080_000n,
      status: 'CONFIRMED',
    });
    // Q-094: первая свободная ячейка категории на весь период — назначена сразу, как в Legacy
    expect(fakes.allocations).toEqual([
      {
        id: expect.any(String),
        itemId: r.items[0]!.id,
        unitId: 'u-9001',
        start: '2026-11-10',
        end: '2026-11-12',
      },
    ]);
    const ev = [...fakes.events.values()][0]!;
    expect(ev).toMatchObject({ status: 'PROCESSED', type: 'booking_new' });
    expect(JSON.stringify(ev.payload)).not.toContain('411111');
    expect(fakes.acks).toEqual(['rev-1']);
    expect(fakes.audits).toEqual(['channex.booking.new']);

    const second = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(second.body.outcomes[0]).toMatchObject({
      result: 'skipped_duplicate',
      confirmationNumber: 'BDC-9996013801',
    });
    expect(fakes.state()).toHaveLength(1);
    expect(fakes.acks).toEqual(['rev-1', 'rev-1']);

    // вторая бронь на те же даты: единственная ячейка занята → без ячейки, предупреждение, бронь создана
    fakes.setFeed([revision({ id: 'rev-1b', booking_id: 'bk-2', unique_id: 'BDC-2' })]);
    const third = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(third.body.outcomes[0]).toMatchObject({
      result: 'created',
      confirmationNumber: 'BDC-2',
    });
    expect(fakes.allocations).toHaveLength(1);
    expect(JSON.stringify(third.body)).toContain('свободной ячейки');
  });

  it('modified revision moves dates and re-dates an existing allocation; cancelled frees units and cancels', async () => {
    fakes.setFeed([revision()]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const item = fakes.state()[0]!.items[0]!;
    fakes.allocations.push({
      id: 'a-free',
      itemId: item.id,
      unitId: 'u1',
      start: '2026-11-10',
      end: '2026-11-12',
    });
    fakes.setFeed([
      revision({
        id: 'rev-2',
        status: 'modified',
        arrival_date: '2026-11-11',
        departure_date: '2026-11-13',
        amount: '30800.00',
        rooms: [
          {
            ...revision().attributes.rooms[0]!,
            checkin_date: '2026-11-11',
            checkout_date: '2026-11-13',
          },
        ],
      }),
    ]);
    const mod = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(mod.body.outcomes[0]).toMatchObject({ result: 'modified', warnings: [] });
    expect(fakes.state()[0]).toMatchObject({
      arrivalDate: '2026-11-11',
      departureDate: '2026-11-13',
    });
    expect(fakes.allocations[0]).toMatchObject({ start: '2026-11-11', end: '2026-11-13' });

    fakes.setFeed([revision({ id: 'rev-3', status: 'cancelled' })]);
    const can = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(can.body.outcomes[0]).toMatchObject({
      result: 'cancelled',
      confirmationNumber: 'BDC-9996013801',
    });
    expect(fakes.state()[0]!.status).toBe('CANCELLED');
    expect(fakes.allocations).toHaveLength(0);
    expect(fakes.acks).toEqual(['rev-1', 'rev-2', 'rev-3']);
    // SECURITY.md §6: отмена каналом — в журнале карточка до и после, как у отмены со стойки
    const cancelled = fakes.auditEntries.find((e) => e.action === 'channex.booking.cancelled');
    expect(cancelled).toMatchObject({
      before: { confirmationNumber: 'BDC-9996013801', status: 'CONFIRMED' },
      after: {
        confirmationNumber: 'BDC-9996013801',
        status: 'CANCELLED',
        uniqueId: 'BDC-9996013801',
      },
    });
  });

  it('дельта доступности: новая, изменённая и отменённая ревизия ставят её после коммита; отмена — ещё и по снятым блокам соседних ночей', async () => {
    fakes.setFeed([revision()]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(published).toEqual([
      {
        categoryCodes: ['category-single'],
        from: '2026-11-10',
        toExclusive: '2026-11-12',
        ranges: [
          { categoryCode: 'category-single', from: '2026-11-10', toExclusive: '2026-11-12' },
        ],
        inTx: false,
      },
    ]);

    published.length = 0;
    fakes.setFeed([
      revision({
        id: 'rev-2',
        status: 'modified',
        arrival_date: '2026-11-11',
        departure_date: '2026-11-13',
        rooms: [
          {
            ...revision().attributes.rooms[0]!,
            checkin_date: '2026-11-11',
            checkout_date: '2026-11-13',
          },
        ],
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    // сдвиг 10→12 на 11→13: ночи брони до и после ревизии — по ним Channex сам вернул и занял место
    expect(published).toEqual([
      {
        categoryCodes: ['category-single'],
        from: '2026-11-10',
        toExclusive: '2026-11-13',
        ranges: [
          { categoryCode: 'category-single', from: '2026-11-10', toExclusive: '2026-11-13' },
        ],
        inTx: false,
      },
    ]);

    // перенос из канала на неделю (11→13 на 18→20): ночи между старыми и новыми датами не уходят
    published.length = 0;
    fakes.setFeed([
      revision({
        id: 'rev-2b',
        status: 'modified',
        arrival_date: '2026-11-18',
        departure_date: '2026-11-20',
        rooms: [
          {
            ...revision().attributes.rooms[0]!,
            checkin_date: '2026-11-18',
            checkout_date: '2026-11-20',
          },
        ],
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(published.map((p) => p.ranges)).toEqual([
      [
        { categoryCode: 'category-single', from: '2026-11-11', toExclusive: '2026-11-13' },
        { categoryCode: 'category-single', from: '2026-11-18', toExclusive: '2026-11-20' },
      ],
    ]);

    published.length = 0;
    releasedBlocks = [
      { categoryCode: 'category-single', from: '2026-11-13', toExclusive: '2026-11-14' },
    ];
    fakes.setFeed([revision({ id: 'rev-3', status: 'cancelled' })]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    // остаток считается по базе после коммита: до него блок соседней ночи ещё стоит и ночь выглядела бы занятой
    expect(published.map((p) => p.inTx)).toEqual([false, false]);
    expect(published.map((p) => `${p.from}→${p.toExclusive}`)).toContain('2026-11-13→2026-11-14');
  });

  it('ревизия канала, которую стойка уже отразила: разница PMS пуста, но ночи брони уходят — Channex меняет свой остаток сам (allow_availability_autoupdate_*)', async () => {
    const pull = () => request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const moved = (id: string, status: 'modified' | 'cancelled') =>
      revision({
        id,
        status,
        arrival_date: '2026-11-18',
        departure_date: '2026-11-20',
        rooms: [
          {
            ...revision().attributes.rooms[0]!,
            checkin_date: '2026-11-18',
            checkout_date: '2026-11-20',
          },
        ],
      });
    const bookingNights = [
      [{ categoryCode: 'category-single', from: '2026-11-18', toExclusive: '2026-11-20' }],
    ];
    fakes.setFeed([revision()]);
    await pull();
    const booking = fakes.state()[0]!;

    // стойка перенесла бронь на 18→20 сама (её дельта ушла), потом канал прислал тот же перенос:
    // Channex по ревизии сам занял место на 18–19 ещё раз — каналу возвращаются числа PMS
    booking.items[0]!.arrivalDate = '2026-11-18';
    booking.items[0]!.departureDate = '2026-11-20';
    published.length = 0;
    fakes.setFeed([moved('rev-m', 'modified')]);
    await pull();
    expect(published.map((p) => p.ranges)).toEqual(bookingNights);

    // стойка отменила раньше канала; отмена из канала вернёт место в Channex второй раз
    booking.status = 'CANCELLED';
    for (const it of booking.items) it.status = 'CANCELLED';
    published.length = 0;
    fakes.setFeed([moved('rev-c', 'cancelled')]);
    await pull();
    expect(published.map((p) => p.ranges)).toEqual(bookingNights);
  });

  it('связывание брони стойки с ревизией канала: ночи и брони стойки, и комнат ревизии — Channex уменьшил остаток по своим', async () => {
    await fakes.repo.createReservation({
      confirmationNumber: '20261101-DESK02',
      source: 'OTA',
      channel: 'Booking.com',
      externalId: '9996013801', // стойка вписала номер брони из экстранета, даты записала со сдвигом
      status: 'CONFIRMED',
      arrivalDate: '2026-11-11',
      departureDate: '2026-11-13',
      adults: 1,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: 3_080_000n,
      primaryGuestId: 'g-desk',
      notes: null,
      items: [
        {
          accommodationTypeId: 't1',
          arrivalDate: '2026-11-11',
          departureDate: '2026-11-13',
          priceMinor: 3_080_000n,
          status: 'CONFIRMED',
        },
      ],
    });
    fakes.setFeed([revision({ id: 'rev-desk-2' })]); // в канале та же бронь на 10→12
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({
      result: 'modified',
      confirmationNumber: '20261101-DESK02',
    });
    expect(published.map((p) => p.ranges)).toEqual([
      [{ categoryCode: 'category-single', from: '2026-11-10', toExclusive: '2026-11-13' }],
    ]);
  });

  it('сбой постановки дельты после ACK не рвёт разбор ревизии и оставляет след для сторожа', async () => {
    publishFails = true;
    fakes.setFeed([revision()]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({ result: 'created' });
    expect(fakes.acks).toEqual(['rev-1']);
    expect(deltaLostLog).toEqual(['очередь недоступна']);
  });

  it('перенесённая из Legacy бронь канала опознаётся по номеру брони OTA: модификация не создаёт дубль, отмена освобождает ячейку', async () => {
    // так выглядит бронь после переноса: номер — из Legacy, внешний ID — номер на стороне канала
    const seeded = await fakes.repo.createReservation({
      confirmationNumber: '20260901-513903-1262128988',
      source: 'OTA',
      channel: 'Booking.com',
      externalId: '9996013801', // = ota_reservation_code у Channex, а не unique_id
      status: 'CONFIRMED',
      arrivalDate: '2026-11-10',
      departureDate: '2026-11-12',
      adults: 1,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: 3_080_000n,
      primaryGuestId: 'g-imported',
      notes: null,
      items: [
        {
          accommodationTypeId: 't1',
          arrivalDate: '2026-11-10',
          departureDate: '2026-11-12',
          priceMinor: 3_080_000n,
          status: 'CONFIRMED',
        },
      ],
    });
    await fakes.repo.createAllocation(seeded.itemIds[0]!, 'u-9001', '2026-11-10', '2026-11-12');
    const before = fakes.state().length;

    fakes.setFeed([revision({ id: 'rev-ota-1', status: 'modified' })]);
    const mod = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(mod.body.outcomes[0]).toMatchObject({
      result: 'modified',
      confirmationNumber: '20260901-513903-1262128988',
    });
    expect(fakes.state()).toHaveLength(before); // дубля не появилось

    fakes.setFeed([revision({ id: 'rev-ota-2', status: 'cancelled' })]);
    const can = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(can.body.outcomes[0]).toMatchObject({ result: 'cancelled' });
    expect(fakes.allocations).toHaveLength(0); // ячейка освободилась, а не осталась занятой
  });

  it('ADR-071: бронь стойки с номером брони в канале при подключении канала СВЯЗЫВАЕТСЯ: гость, статус, ячейка и заметка стойки на месте, дубля нет', async () => {
    const seeded = await fakes.repo.createReservation({
      confirmationNumber: '20261101-DESK01',
      source: 'OTA',
      channel: 'Booking.com',
      externalId: '9996013801', // стойка вписала номер брони из экстранета
      status: 'CHECKED_IN',
      arrivalDate: '2026-11-10',
      departureDate: '2026-11-12',
      adults: 1,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: 3_080_000n,
      primaryGuestId: 'g-desk',
      notes: 'заметка стойки',
      items: [
        {
          accommodationTypeId: 't1',
          arrivalDate: '2026-11-10',
          departureDate: '2026-11-12',
          priceMinor: 3_080_000n,
          status: 'CHECKED_IN',
        },
      ],
    });
    await fakes.repo.createAllocation(seeded.itemIds[0]!, 'u-9001', '2026-11-10', '2026-11-12');
    const before = fakes.state().length;

    // подтяжка при подключении: та же бронь как booking_new, заметки у канала нет
    fakes.setFeed([revision({ id: 'rev-desk-1', notes: null })]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({
      result: 'modified',
      confirmationNumber: '20261101-DESK01',
    });
    expect(fakes.state()).toHaveLength(before);
    const linked = fakes.state().find((r) => r.id === seeded.id)!;
    expect(linked.externalId).toBe('BDC-9996013801');
    expect(linked.items.map((i) => i.status)).toEqual(['CHECKED_IN']);
    expect(fakes.reservations.get('20261101-DESK01')).toMatchObject({ notes: 'заметка стойки' });
    expect(fakes.allocations).toEqual([
      {
        id: expect.any(String),
        itemId: seeded.itemIds[0],
        unitId: 'u-9001',
        start: '2026-11-10',
        end: '2026-11-12',
      },
    ]);
    expect(fakes.audits).toEqual(['channex.booking.linked']);
  });

  /**
   * ADR-024 (Q-034): так выглядит бронь Booking.com после переноса из Legacy — номер из Legacy, канал как
   * его называет Legacy, внешнего ID нет (Универсальный API номер брони канала не отдаёт), ячейка назначена.
   */
  const seedImported = async (
    over: Partial<{
      confirmationNumber: string;
      channel: string;
      notes: string | null;
      items: Array<{ accommodationTypeId: string; arrivalDate: string; departureDate: string }>;
      unitId: string | null;
    }> = {},
  ) => {
    const items = over.items ?? [
      { accommodationTypeId: 't1', arrivalDate: '2026-11-10', departureDate: '2026-11-12' },
    ];
    const seeded = await fakes.repo.createReservation({
      confirmationNumber: over.confirmationNumber ?? '20260901-513903-1262128988',
      source: 'OTA',
      channel: over.channel ?? 'booking.com',
      externalId: null,
      status: 'CONFIRMED',
      arrivalDate: items[0]!.arrivalDate,
      departureDate: items[0]!.departureDate,
      adults: items.length,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: 3_080_000n,
      primaryGuestId: 'g-imported',
      notes: over.notes ?? null,
      items: items.map((it) => ({ ...it, priceMinor: 3_080_000n, status: 'CONFIRMED' as const })),
    });
    if (over.unitId !== null)
      for (const [i, itemId] of seeded.itemIds.entries())
        await fakes.repo.createAllocation(
          itemId,
          over.unitId ?? `u-legacy-${i}`,
          items[i]!.arrivalDate,
          items[i]!.departureDate,
        );
    return seeded;
  };

  it('предупреждения разбора не теряются: записываются в журнал события (PROCESSED + текст) — и при webhook, где результат никто не читает', async () => {
    // ячейка u-9001 занята перенесённой броней Agoda: её Channex не подтягивает, бронь Booking.com новая,
    // а свободной ячейки для неё нет — предупреждение «без ячейки»
    await seedImported({
      confirmationNumber: '20260901-513903-AGO',
      channel: 'Agoda',
      unitId: 'u-9001',
    });
    fakes.setFeed([revision({ id: 'rev-warn' })]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({ result: 'created' });
    expect(JSON.stringify(res.body.outcomes[0].warnings)).toContain('свободной ячейки');
    const ev = [...fakes.events.values()].find((e) => e.id.endsWith('rev-warn'))!;
    expect(ev.status).toBe('PROCESSED');
    expect(ev.lastError).toContain('свободной ячейки');

    process.env.CHANNEX_WEBHOOK_SECRET = 'test-webhook-secret';
    fakes.setFeed([revision({ id: 'rev-warn-hook', unique_id: 'BDC-HOOK' })]);
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({ event: 'booking', payload: { revision_id: 'rev-warn-hook' } })
      .expect(200);
    await inbound.drain();
    const hook = [...fakes.events.values()].find((e) => e.id.endsWith('rev-warn-hook'))!;
    expect(hook.status).toBe('PROCESSED');
    expect(hook.lastError).toContain('свободной ячейки');
  });

  it('Q-086: бронь, оплаченную площадкой, счёт принимает предоплатой; оплату на месте — нет', async () => {
    fakes.setFeed([revision({ id: 'rev-pay-1', payment_collect: 'ota', unique_id: 'BDC-PAID' })]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toEqual([
      {
        itemId: expect.any(String),
        amountMinor: 3_080_000n,
        externalReference: 'channex:BDC-PAID:0',
      },
    ]);

    // деньги берут на месте (Booking) — предоплаты нет, гость платит при заселении
    fakes.prepayments.length = 0;
    fakes.setFeed([
      revision({ id: 'rev-pay-2', payment_collect: 'property', unique_id: 'BDC-ONSITE' }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toEqual([]);
  });

  it('после шести неудач ревизия ждёт человека, а «Обработать заново» разбирает её', async () => {
    const bad = (over = {}) =>
      revision({
        id: 'rev-ceiling',
        unique_id: 'BDC-CEIL',
        rooms: [{ ...revision().attributes.rooms[0]!, amount: '1e3' }],
        ...over,
      });
    fakes.setFeed([bad()]);
    for (let i = 0; i < 6; i += 1)
      await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const ev = [...fakes.events.values()].find((e) => e.id.endsWith('rev-ceiling'))!;
    expect(ev.attemptCount).toBe(6);
    expect(ev.status).toBe('FAILED');

    // седьмой опрос ревизию уже не трогает: счётчик не растёт, в ошибке — что делать человеку
    const seventh = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(seventh.body.outcomes[0].error).toMatch(/Обработать заново/);
    expect(ev.attemptCount).toBe(6);
    expect(fakes.state()).toHaveLength(0);

    // причину устранили (канал прислал ту же ревизию с нормальной суммой) — кнопка разбирает её
    fakes.setFeed([bad({ rooms: [revision().attributes.rooms[0]!] })]);
    const retried = await request(app.getHttpServer())
      .post('/channels/channex/events/rev-ceiling/retry')
      .expect(200);
    expect(retried.body).toMatchObject({ result: 'created', confirmationNumber: 'BDC-CEIL' });
    expect(fakes.acks).toContain('rev-ceiling');
    // «Обработать заново» берёт ревизию из ленты (неподтверждённая в ней остаётся), а не по ID
    expect(fakes.feedCalls.length).toBeGreaterThan(7);
  });

  it('ADR-018: в журнале события ревизия без заказчика, гостей, заметки и карты — пока база не в РК', async () => {
    // Проверка по SECURITY.md 24.09.2026: гостя обезличивали, а ревизию целиком клали в external_events.payload
    fakes.setFeed([
      revision({
        id: 'rev-pii-payload',
        unique_id: 'BDC-PII-P',
        raw_message: 'RAW-OTA-MESSAGE',
        agent: 'AGENT-X',
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const ev = [...fakes.events.values()].find((e) => e.id.endsWith('rev-pii-payload'))!;
    const stored = JSON.stringify(ev.payload);
    const customer = revision().attributes.customer!;
    for (const value of [customer.name!, customer.surname!, customer.mail!, customer.phone!])
      expect(stored).not.toContain(value);
    expect(stored).not.toContain('"guests"');
    expect(stored).not.toContain('quiet room please');
    expect(stored).not.toContain('411111');
    expect(stored).not.toContain('RAW-OTA-MESSAGE');
    expect(stored).not.toContain('AGENT-X');
    // то, что читают экран «Приём брони» и поиск по номеру, остаётся
    expect(ev.payload).toMatchObject({
      unique_id: 'BDC-PII-P',
      ota_name: 'Booking.com',
      ota_reservation_code: '9996013801',
      arrival_date: '2026-11-10',
      departure_date: '2026-11-12',
      amount: '30800.00',
      currency: 'KZT',
      customer: { country: 'NL' },
    });
    expect((ev.payload as { rooms: unknown[] }).rooms[0]).toMatchObject({
      checkin_date: '2026-11-10',
      room_type_id: 'rt-2',
      rate_plan_id: 'rp-3',
      amount: '30800.00',
    });
  });

  it('PII_STORAGE=real (база в РК): ревизия хранится целиком, кроме карты', async () => {
    process.env.PII_STORAGE = 'real';
    try {
      fakes.setFeed([
        revision({ id: 'rev-real', unique_id: 'BDC-REAL', raw_message: 'RAW-OTA-MESSAGE' }),
      ]);
      await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
      const ev = [...fakes.events.values()].find((e) => e.id.endsWith('rev-real'))!;
      const customer = revision().attributes.customer!;
      expect(ev.payload).toMatchObject({ customer: { name: customer.name, mail: customer.mail } });
      expect(JSON.stringify(ev.payload)).not.toContain('411111');
      // исходное сообщение площадки может нести карту — не хранится и в РК
      expect(JSON.stringify(ev.payload)).not.toContain('RAW-OTA-MESSAGE');
    } finally {
      delete process.env.PII_STORAGE;
    }
  });

  it('ADR-018: событие не о брони — в журнале только идентификаторы, текст гостя не хранится', async () => {
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({
        event: 'message',
        property_id: 'prop-1',
        timestamp: '2026-09-24T10:00:00Z',
        payload: {
          booking_id: 'bk-1',
          message: 'Позвоните мне: +7 700 000 00 00, test.guest@example.com',
          message_thread_id: 'thread-1',
          sender: 'guest',
        },
      })
      .expect(200);
    await vi.waitFor(() =>
      expect([...fakes.events.values()].some((e) => e.type === 'message')).toBe(true),
    );
    const ev = [...fakes.events.values()].find((e) => e.type === 'message')!;
    expect(JSON.stringify(ev.payload)).not.toContain('Позвоните');
    expect(ev.payload).toMatchObject({ booking_id: 'bk-1', message_thread_id: 'thread-1' });
  });

  it('Q-169: пока база не в РК, почта и телефоны в заметке канала маскируются', async () => {
    fakes.setFeed([
      revision({
        id: 'rev-notes',
        unique_id: 'BDC-NOTES',
        notes: 'Late arrival, call +44 20 7946 0958 or mail guest.test@example.com',
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect([...fakes.reservations.values()][0]!.notes).toBe(
      'Late arrival, call <телефон> or mail <почта>',
    );
  });

  it('SECURITY.md §7: текст ошибки разбора ревизии пишется в last_error без почты и телефонов', async () => {
    fakes.setFeed([revision({ id: 'rev-fail-pii', unique_id: 'BDC-FAIL-PII' })]);
    const r = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const ev = [...fakes.events.values()].find((e) => e.id.endsWith('rev-fail-pii'))!;
    expect(ev.status).toBe('FAILED');
    for (const text of [ev.lastError ?? '', JSON.stringify(r.body)]) {
      expect(text).not.toContain('700 000 00 00');
      expect(text).not.toContain('test.guest@example.com');
    }
    expect(ev.lastError).toContain('<телефон>');
  });

  it('ADR-018: настоящие имя, телефон и почта гостя канала в базу не попадают', async () => {
    fakes.setFeed([revision({ id: 'rev-pii', unique_id: 'BDC-PII' })]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    const stored = fakes.guests[0]!;
    const customer = revision().attributes.customer!;
    expect(fakes.guests).toHaveLength(1);
    expect(stored.lastName).not.toBe(customer.surname);
    expect(stored.firstName).not.toBe(customer.name);
    expect(stored.phone).not.toBe(customer.phone);
    // псевдоним детерминирован: повторная ревизия той же брони не заведёт второго гостя
    const again = await request(app.getHttpServer()).post('/channels/channex/pull');
    expect(again.status).toBe(200);
    expect(fakes.guests).toHaveLength(1);
  });

  it('Q-108: отмена предоплаченной OTA-брони снимает платёж канала — на счёте не остаётся минуса', async () => {
    fakes.setFeed([revision({ id: 'rev-pp1', payment_collect: 'ota', unique_id: 'BDC-PP' })]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toHaveLength(1);
    // отмена заранее: штрафа нет (Q-103), значит площадка возвращает гостю всё, предоплата в PMS снимается
    fakes.setFeed([
      revision({ id: 'rev-pp2', status: 'cancelled', payment_collect: 'ota', unique_id: 'BDC-PP' }),
    ]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({ result: 'cancelled' });
    expect(fakes.prepayments).toEqual([]);
  });

  it('одна упавшая ревизия не рвёт ленту: следующая обработана и подтверждена', async () => {
    // Первая ревизия падает не на UnmappedRoomError, а на непарсимой сумме — раньше такая ошибка
    // выходила из pull() наружу, и остальная лента оставалась неразобранной и неподтверждённой.
    fakes.setFeed([
      revision({
        id: 'rev-bad',
        unique_id: 'BDC-BAD',
        rooms: [{ ...revision().attributes.rooms[0]!, amount: '1e3' }],
      }),
      revision({ id: 'rev-good', unique_id: 'BDC-GOOD' }),
    ]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body).toMatchObject({ received: 2, acknowledged: 1 });
    expect(res.body.outcomes[0]).toMatchObject({ revisionId: 'rev-bad', result: 'failed' });
    expect(res.body.outcomes[0].error).toMatch(/не десятичное/);
    expect(res.body.outcomes[1]).toMatchObject({ revisionId: 'rev-good', result: 'created' });
    // подтверждена только здоровая: плохая вернётся в ленте и будет разобрана снова
    expect(fakes.acks).toEqual(['rev-good']);
    expect(fakes.state().map((r) => r.confirmationNumber)).toEqual(['BDC-GOOD']);
    expect([...fakes.events.values()].find((e) => e.status === 'FAILED')).toBeDefined();
  });

  it('Q-086: модификация пересчитывает предоплату канала, а смена payment_collect её снимает', async () => {
    const paid = (over = {}) =>
      revision({ payment_collect: 'ota', unique_id: 'BDC-PREPAID', ...over });
    fakes.setFeed([paid({ id: 'rev-p1' })]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toMatchObject([{ amountMinor: 3_080_000n }]);

    // канал поднял цену — на стойке гость не должен остаться должником на разницу
    fakes.setFeed([
      paid({
        id: 'rev-p2',
        status: 'modified',
        amount: '45000.00',
        rooms: [{ ...revision().attributes.rooms[0]!, amount: '45000.00' }],
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toMatchObject([
      { amountMinor: 4_500_000n, externalReference: 'channex:BDC-PREPAID:0' },
    ]);

    // деньги теперь берёт объект — прежняя предоплата снимается, иначе гость «уже оплатил»
    fakes.setFeed([
      revision({
        id: 'rev-p3',
        status: 'modified',
        unique_id: 'BDC-PREPAID',
        payment_collect: 'property',
      }),
    ]);
    await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(fakes.prepayments).toEqual([]);
  });

  it('unmapped room type → event FAILED with a reason, no reservation, no ack', async () => {
    fakes.setFeed([
      revision({
        id: 'rev-9',
        rooms: [{ ...revision().attributes.rooms[0]!, room_type_id: 'rt-unknown' }],
      }),
    ]);
    const res = await request(app.getHttpServer()).post('/channels/channex/pull').expect(200);
    expect(res.body.outcomes[0]).toMatchObject({ result: 'failed' });
    expect(res.body.outcomes[0].error).toMatch(/rt-unknown/);
    expect(fakes.state()).toHaveLength(0);
    expect(fakes.acks).toEqual([]);
    expect([...fakes.events.values()][0]!.status).toBe('FAILED');
  });

  it('webhook: wrong secret → 401, missing secret config → 503, booking event → the feed of its property is read, never the revision by ID', async () => {
    fakes.setFeed([revision({ id: 'rev-7' })]);
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'nope')
      .send({ event: 'booking', payload: { revision_id: 'rev-7' } })
      .expect(401);
    const ok = await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({
        event: 'booking',
        payload: { booking_id: 'bk-1', property_id: 'prop-1', revision_id: 'rev-7' },
        property_id: 'prop-1',
        timestamp: '2026-09-09T00:00:00Z',
      })
      .expect(200);
    // ответ сразу, обработка — в очереди (туннели и прокси рвут долгие ответы; Channex повторяет только 5xx)
    expect(ok.body).toEqual({ ok: true, accepted: true });
    await inbound.drain();
    expect(fakes.events.has('channex|rev-7')).toBe(true);
    // Сценарий 11 сертификации: «received via webhook/feed, not list-polling or by-id fetching» (24.09.2026) —
    // по webhook PMS читает ленту неподтверждённых ревизий своего объекта; в журнале — «пришла по webhook»
    expect(fakes.feedCalls).toEqual(['prop-1']);
    expect(fakes.events.get('channex|rev-7')?.receivedVia).toBe('WEBHOOK');
    expect(fakes.acks).toEqual(['rev-7']);
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({ event: 'sync_error', payload: { message: 'x' }, timestamp: 't1' })
      .expect(200);
    await inbound.drain();
    expect([...fakes.events.keys()].some((k) => k.startsWith('channex|sync_error:'))).toBe(true);
    // событие booking без revision_id отклоняется до постановки в очередь
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({ event: 'booking_new', payload: {} })
      .expect(400);
    delete process.env.CHANNEX_WEBHOOK_SECRET;
    await request(app.getHttpServer())
      .post('/channels/channex/webhook')
      .set('x-channex-webhook-secret', 'test-webhook-secret')
      .send({ event: 'booking', payload: { revision_id: 'rev-7' } })
      .expect(503);
  });
});
