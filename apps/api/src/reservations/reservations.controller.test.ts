import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARI_PUBLISHER, type AriPublisher } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import { ReservationsModule } from './reservations.module';
import { ReservationsService } from './reservations.service';
import { withSignedInUser } from '../auth/request-context';
import {
  RATE_PLAN_CHANGE_MESSAGE,
  RATE_PLAN_SOFT_MESSAGE,
  type MembershipRole,
  type StayRestriction,
} from '@pms/domain';
import {
  type RatePlanRef,
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ReservationState,
  type ReservationsRepository,
  type UnitOfWork,
} from './reservations.repository';

/** Фальшивка хранит и то, чего в ReservationState нет, но что отдаёт карточка: источник, заметки, гостей */
type StoredReservation = ReservationState & {
  source?: string;
  notes?: string | null;
  channel?: string | null;
  externalId?: string | null;
  adults?: number;
  children?: number;
};

/** Фальшивое хранилище в памяти: 2 категории, тариф, ячейки, цены. Вымышленные данные. */
function makeFake() {
  const types = [
    {
      id: 't1',
      code: 'exely-900001',
      name: 'Тестовая одиночная',
      active: true,
      capacityAdults: 1,
      capacityChildren: 0, // как на объекте: детское размещение выключено
    },
    {
      id: 't2',
      code: 'exely-900002',
      name: 'Тестовая двойная',
      active: true,
      capacityAdults: 2,
      capacityChildren: 0,
    },
  ];
  const plans: RatePlanRef[] = [
    {
      id: 'p1',
      code: 'exely-800001',
      name: 'Тестовый базовый',
      currency: 'KZT',
      active: true,
      cancellationPenalty: 'FIRST_NIGHT', // правило Exely «первые сутки» (Q-103)
    },
    {
      id: 'p3',
      code: 'exely-800003',
      name: 'Мёртвый',
      currency: 'KZT',
      active: false,
      cancellationPenalty: 'NONE',
    },
  ];
  type Hk = 'DIRTY' | 'CLEAN' | 'INSPECTED';
  // ячейки проверены: выезд должен сам перевести ячейку в «требует уборки» (Q-155, ADR-068)
  const hk = 'INSPECTED' as Hk;
  const units = [
    { id: 'u1', code: '9001', accommodationTypeId: 't1', active: true, housekeepingStatus: hk },
    { id: 'u2', code: '9002', accommodationTypeId: 't2', active: true, housekeepingStatus: hk },
    { id: 'u3', code: '9003', accommodationTypeId: 't1', active: true, housekeepingStatus: hk },
    // ещё две койки одиночной категории — для групповой брони на несколько мест
    { id: 'u5', code: '9005', accommodationTypeId: 't1', active: true, housekeepingStatus: hk },
    { id: 'u4', code: '9004', accommodationTypeId: 't1', active: true, housekeepingStatus: hk },
  ];
  /** Какие тарифы действуют на обе категории; второй тариф тест добавляет сам (Q-199) */
  const covers = new Set(['p1']);
  const rates: Record<string, bigint> = {};
  for (const d of ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']) {
    rates[`t1|p1|${d}|1`] = 1_100_000n;
    rates[`t2|p1|${d}|1`] = 1_500_000n;
    rates[`t2|p1|${d}|2`] = 1_500_000n;
  }
  const state = {
    categoryAvailabilityOverride: null as number | null,
    /** категории, продажи которых заблокированы на время команды (Б2), в порядке вызова */
    locks: [] as string[],
    /** Порядок «замок брони → чтение брони» (аудит 26.09, С-15) */
    events: [] as string[],
    /** гражданство заказчика, как его отдаёт карточка — для правила заселения (DATA_MODEL §3) */
    citizenship: 'KAZ' as string | null,
    /** долг счёта по проживанию — для T3 (выселение с долгом) */
    debts: new Map<string, bigint>(),
    /** проживания, у которых счёт закрыт при выезде */
    closedFolios: [] as string[],
    reservations: new Map<string, StoredReservation>(),
    /** ограничения продаж (ADR-020): дата × категория × тариф */
    restrictions: [] as Array<StayRestriction & { typeId: string; planId: string }>,
    allocations: [] as Array<{
      id: string;
      itemId: string;
      unitId: string;
      start: string;
      end: string;
    }>,
    audits: [] as Array<{ entityType: string; action: string }>,
    guests: 0,
    /** что записано в гости (ADR-072: до переезда базы — псевдоним) */
    createdGuests: [] as Array<Record<string, unknown>>,
    seq: 0,
  };
  const blocked: Array<{ unitId: string; from: string; to: string; reason?: string }> = [
    { unitId: 'u3', from: '2026-09-15', to: '2026-09-20' },
  ];
  const overlaps = (unitId: string, start: string, end: string, exceptItem?: string) =>
    state.allocations.some(
      (a) => a.unitId === unitId && a.itemId !== exceptItem && a.start < end && a.end > start,
    );
  const penalties: Array<{ itemId: string; amountMinor: bigint; description: string }> = [];
  const repo: ReservationsRepository = {
    async today() {
      // как прежний жёсткий UTC+5 — под фальшивыми часами тестов даёт ту же дату
      return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    },
    async property() {
      return { id: 'prop', currency: 'KZT', timezone: 'Asia/Almaty' };
    },
    async categoryByCode(code) {
      return types.find((t) => t.code === code) ?? null;
    },
    async activeCategories() {
      return types.filter((t) => t.active);
    },
    async categoryById(id) {
      return types.find((t) => t.id === id) ?? null;
    },
    async stayBalanceMinor(itemId) {
      return state.debts.get(itemId) ?? 0n;
    },
    async closeFolio(itemId) {
      state.closedFolios.push(itemId);
    },
    async recordChannelPrepayment() {},
    async voidChannelPrepayment() {},
    async settleChannelPrepaymentAfterCancel() {},
    async releaseStayExtraBlocks(confirmationNumber) {
      const mine = blocked.filter((b) => b.reason?.endsWith(`, бронь ${confirmationNumber}`));
      for (const b of mine) blocked.splice(blocked.indexOf(b), 1);
      return mine.map((b) => ({
        categoryCode: units.find((u) => u.id === b.unitId)?.accommodationTypeId ?? '',
        from: b.from,
        toExclusive: b.to,
      }));
    },
    async ratePlanByCode(code) {
      return plans.find((p) => p.code === code) ?? null;
    },
    async ratePlanById(planId) {
      return plans.find((p) => p.id === planId) ?? null;
    },
    async addPenaltyCharge(itemId, amountMinor, description) {
      penalties.push({ itemId, amountMinor, description });
    },
    async activeRatePlans() {
      return plans.filter((p) => p.active);
    },
    async ratePlanCoversType(planId, typeId) {
      return covers.has(planId) && ['t1', 't2'].includes(typeId);
    },
    async nightRates(typeId, planId, from, toExclusive) {
      return Object.entries(rates)
        .map(([k, priceMinor]) => {
          const [t, p, date, occ] = k.split('|') as [string, string, string, string];
          return { t, p, date, occupancy: Number(occ), priceMinor };
        })
        .filter((r) => r.t === typeId && r.p === planId && r.date >= from && r.date < toExclusive)
        .map((r) => ({ date: r.date, occupancy: r.occupancy, priceMinor: r.priceMinor }));
    },
    async unitByCode(code) {
      return units.find((u) => u.code === code) ?? null;
    },
    async unitHousekeeping(unitId) {
      return units.find((u) => u.id === unitId)?.housekeepingStatus ?? null;
    },
    async setUnitHousekeeping(unitId, _from, to) {
      const u = units.find((u) => u.id === unitId);
      if (u) u.housekeepingStatus = to;
    },
    async hasBlockOverlap(unitId, from, toExclusive) {
      return blocked.some((b) => b.unitId === unitId && b.from < toExclusive && b.to > from);
    },
    async hasAllocationOverlap(unitId, from, toExclusive, exceptItem) {
      return overlaps(unitId, from, toExclusive, exceptItem);
    },
    async firstFreeUnit() {
      return null; // ручная бронь ячейку выбирает сама; автоназначение — для каналов (Q-094)
    },
    async categoryAvailability(typeId, from, toExclusive) {
      // Q-107: по умолчанию как у канала = свободные ячейки; тест может занизить остаток «бронями без ячейки»
      if (state.categoryAvailabilityOverride !== null) return state.categoryAvailabilityOverride;
      return (await this.freeUnits(typeId, from, toExclusive)).length;
    },
    async freeUnits(typeId, from, toExclusive) {
      return units
        .filter(
          (u) =>
            u.accommodationTypeId === typeId &&
            u.active &&
            !overlaps(u.id, from, toExclusive) &&
            !blocked.some((b) => b.unitId === u.id && b.from < toExclusive && b.to > from),
        )
        .sort((a, b) => Number(a.code) - Number(b.code));
    },
    async lockCategories(typeIds) {
      state.locks.push(...typeIds);
    },
    async restrictionsFor(typeId, planId, from, toExclusive) {
      return state.restrictions
        .filter(
          (r) =>
            r.typeId === typeId && r.planId === planId && r.date >= from && r.date < toExclusive,
        )
        .map((r): StayRestriction => ({
          date: r.date,
          minStay: r.minStay,
          maxStay: r.maxStay,
          stopSell: r.stopSell,
          closedToArrival: r.closedToArrival,
          closedToDeparture: r.closedToDeparture,
        }));
    },
    async createGuest(g) {
      state.guests += 1;
      state.createdGuests.push({ ...g });
      return `g${state.guests}`;
    },
    async createReservation(input) {
      state.seq += 1;
      const id = `r${state.seq}`;
      const items = input.items.map((it, i) => ({
        id: `${id}-i${i + 1}`,
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
      state.reservations.set(input.confirmationNumber, {
        id,
        confirmationNumber: input.confirmationNumber,
        status: input.status,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        currency: input.currency,
        items,
        source: input.source,
        notes: input.notes,
        adults: input.adults,
        children: input.children,
        channel: input.channel ?? null,
        externalId: input.externalId ?? null,
      });
      return { id, itemIds: items.map((i) => i.id) };
    },
    async addStayGuest(itemId) {
      for (const r of state.reservations.values())
        for (const it of r.items) if (it.id === itemId) it.guestsCount += 1;
    },
    async createAllocation(itemId, unitId, startDate, endDate) {
      if (overlaps(unitId, startDate, endDate)) throw new AllocationOverlapError(unitId);
      state.allocations.push({
        id: `a${state.allocations.length + 1}`,
        itemId,
        unitId,
        start: startDate,
        end: endDate,
      });
    },
    async lockReservation(number) {
      state.events.push(`lock:${number}`);
    },
    async reservationByNumber(number) {
      state.events.push(`read:${number}`);
      const r = state.reservations.get(number);
      if (!r) return null;
      return {
        ...r,
        items: r.items.map((it) => ({
          ...it,
          allocations: state.allocations
            .filter((a) => a.itemId === it.id)
            .map((a) => ({
              id: a.id,
              unitId: a.unitId,
              unitCode: units.find((u) => u.id === a.unitId)!.code,
              startDate: a.start,
              endDate: a.end,
            })),
        })),
      };
    },
    async updateItem(itemId, patch) {
      for (const r of state.reservations.values())
        for (const it of r.items) if (it.id === itemId) Object.assign(it, patch);
    },
    async updateReservation(id, patch) {
      for (const r of state.reservations.values()) if (r.id === id) Object.assign(r, patch);
    },
    async deleteAllocation(id) {
      state.allocations = state.allocations.filter((a) => a.id !== id);
    },
    async shortenAllocation(id, endDate) {
      const a = state.allocations.find((x) => x.id === id)!;
      a.end = endDate;
    },
    async replaceAllocationDates(id, startDate, endDate) {
      const a = state.allocations.find((x) => x.id === id)!;
      if (overlaps(a.unitId, startDate, endDate, a.itemId))
        throw new AllocationOverlapError(a.unitId);
      a.start = startDate;
      a.end = endDate;
    },
    async reservationByExternalId(externalId) {
      const r = [...state.reservations.values()].find((x) => x.externalId === externalId);
      return r ? this.reservationByNumber(r.confirmationNumber) : null;
    },
    async importedOtaCandidates() {
      return [];
    },
    async addReservationItem() {
      return 'x';
    },
    async channelMappings() {
      return [];
    },
    async recordExternalEvent() {
      return { id: 'e', status: 'RECEIVED', attemptCount: 0, lastError: null, isNew: true };
    },
    async resetExternalEventAttempts() {},
    async updateExternalEvent() {},
    async audit(entry) {
      state.audits.push({ entityType: entry.entityType, action: entry.action });
    },
    async card(number) {
      const r = state.reservations.get(number);
      if (!r) return null;
      return {
        confirmationNumber: r.confirmationNumber,
        source: r.source ?? 'DESK',
        channel: null,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        adults: r.adults ?? 1,
        children: r.children ?? 0,
        currency: r.currency,
        totalAmountMinor: r.items.reduce((s, i) => s + i.priceMinor, 0n).toString(),
        notes: r.notes ?? null,
        primaryGuest: {
          id: 'g1',
          label: 'Гость Тестовый',
          citizenship: state.citizenship,
          phone: '+70000000000',
        },
        items: r.items.map((it) => ({
          id: it.id,
          accommodationTypeCode: types.find((t) => t.id === it.accommodationTypeId)!.code,
          accommodationTypeName: types.find((t) => t.id === it.accommodationTypeId)!.name,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          priceMinor: it.priceMinor.toString(),
          ratePlanCode: null,
          ratePlanName: null,
          adults: it.adults,
          children: it.children,
          unitCode: state.allocations.find((a) => a.itemId === it.id)?.unitId
            ? units.find((u) => u.id === state.allocations.find((a) => a.itemId === it.id)!.unitId)!
                .code
            : null,
          unitHousekeepingStatus:
            units.find((u) => u.id === state.allocations.find((a) => a.itemId === it.id)?.unitId)
              ?.housekeepingStatus ?? null,
          // как loadReservationCard: гости проживания из StayGuest (заказчик записан на каждое)
          guests: Array.from({ length: it.guestsCount }, (_v, i) => ({
            id: `g-${i + 1}`,
            label: 'Гость Тестовый',
            isPrimary: true,
          })),
        })),
      };
    },
  };
  const uow: UnitOfWork = { run: (fn) => fn(repo), read: (fn) => fn(repo) };
  return { uow, state, penalties, blocked, units, plans, rates, covers };
}

const body = (over: Record<string, unknown> = {}) => ({
  source: 'PHONE',
  arrivalDate: '2026-09-15',
  departureDate: '2026-09-17',
  guest: { firstName: 'Гость', lastName: 'Тестовый', phone: '+70000000000' },
  items: [
    {
      accommodationTypeCode: 'exely-900001',
      ratePlanCode: 'exely-800001',
      adults: 1,
      unitCode: '9001',
    },
  ],
  ...over,
});

describe('manual reservation API', () => {
  // GET /rate-plans проверяется в конце файла
  const published: unknown[] = [];
  /** Б6: очередь каналов не принимает дельту (сбой базы после коммита команды) */
  let publishFails = false;
  let app: INestApplication;
  let fake: ReturnType<typeof makeFake>;
  beforeEach(() => {
    fake = makeFake();
    published.length = 0;
  });
  // Даты в фикстурах фиксированные (сентябрь 2026), а правило штрафа смотрит на сегодняшний день.
  // Без заморозки времени тест сам покраснеет, когда календарь дойдёт до этих дат.
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-10T06:00:00Z'));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [ReservationsModule] })
      .overrideProvider(RESERVATIONS_UOW)
      .useFactory({
        factory: () => ({
          run: (fn: Parameters<UnitOfWork['run']>[0]) => fake.uow.run(fn),
          read: (fn: Parameters<UnitOfWork['read']>[0]) => fake.uow.read(fn),
        }),
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .overrideProvider(ARI_PUBLISHER)
      .useFactory({
        factory: (): AriPublisher => ({
          reservationChanged: async (c) => {
            if (publishFails) throw new Error('channel_outbox insert failed');
            published.push(c);
          },
          ratesChanged: async () => 0,
        }),
      })
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('ADR-021: отмена брони снимает блоки соседних ночей от раннего заезда и позднего выезда', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const number = created.body.confirmationNumber as string;
    // как ставит финансовый модуль: блок на койку с причиной «…, бронь N»
    fake.blocked.push({
      unitId: 'u1',
      from: '2026-11-12',
      to: '2026-11-13',
      reason: `Поздний выезд, бронь ${number}`,
    });
    await request(app.getHttpServer()).post(`/reservations/${number}/cancel`).expect(200);
    expect(fake.blocked.some((b) => b.reason?.endsWith(`, бронь ${number}`))).toBe(false);
    // чужой блок не тронут
    expect(fake.blocked.some((b) => b.unitId === 'u3')).toBe(true);
  });

  it('Q-107: ячейка физически свободна, но категория продана бронями без ячейки → 409, как для канала', async () => {
    fake.state.categoryAvailabilityOverride = 0;
    const res = await request(app.getHttpServer()).post('/reservations').send(body());
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/мест нет|свободно только/);
    fake.state.categoryAvailabilityOverride = null;
  });

  it('Б6: бронь записана, а дельта каналов не встала в очередь — ответ 201 с карточкой, не 500: иначе повтор создаст дубль', async () => {
    publishFails = true;
    try {
      const res = await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.items[0].unitCode).toBe('9001');
    } finally {
      publishFails = false;
    }
  });

  it('POST /reservations creates a CONFIRMED booking priced from DailyRate, assigns the unit, writes audit', async () => {
    const res = await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
    expect(res.body.confirmationNumber).toMatch(/^\d{8}-[A-Z0-9]{6}$/);
    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.totalAmountMinor).toBe('2200000'); // 2 ночи × 11 000 ₸
    expect(res.body.items[0].unitCode).toBe('9001');
    expect(fake.state.audits).toEqual([
      { entityType: 'Reservation', action: 'reservation.create' },
    ]);
    // после коммита в каналы уходит дельта доступности по категории и ночам брони
    expect(published).toEqual([
      { categoryCodes: ['exely-900001'], from: '2026-09-15', toExclusive: '2026-09-17' },
    ]);
  });
  it('ADR-072: пока база не в Казахстане, гость со стойки записывается псевдонимом; имя не обязательно', async () => {
    const before = process.env.PII_STORAGE;
    delete process.env.PII_STORAGE;
    try {
      await request(app.getHttpServer())
        .post('/reservations')
        .send(
          body({
            guest: {
              firstName: 'Иван',
              lastName: 'Петров',
              middleName: 'С.',
              phone: '+77011234567',
            },
          }),
        )
        .expect(201);
      await request(app.getHttpServer())
        .post('/reservations')
        .send(body({ guest: undefined, arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
        .expect(201);
      expect(fake.state.createdGuests).toHaveLength(2);
      for (const g of fake.state.createdGuests) {
        expect(g).toMatchObject({ firstName: 'Гость', middleName: null, phone: null, email: null });
        expect(String(g['lastName'])).toMatch(/^Стойка-[0-9a-f]{6}$/);
      }
      expect(JSON.stringify(fake.state.createdGuests)).not.toMatch(/Иван|Петров|7011234567/);
    } finally {
      if (before === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = before;
    }
  });
  it('ADR-072: база в Казахстане (PII_STORAGE=real) — гость как введён, имя и фамилия обязательны', async () => {
    const before = process.env.PII_STORAGE;
    process.env.PII_STORAGE = 'real';
    try {
      await request(app.getHttpServer())
        .post('/reservations')
        .send(body({ guest: { firstName: ' Иван ', lastName: 'Петров', phone: '  ' } }))
        .expect(201);
      expect(fake.state.createdGuests).toEqual([
        { firstName: 'Иван', lastName: 'Петров', middleName: null, phone: null, email: null },
      ]);
      await request(app.getHttpServer())
        .post('/reservations')
        .send(
          body({
            guest: { firstName: 'Иван' },
            arrivalDate: '2026-09-18',
            departureDate: '2026-09-19',
          }),
        )
        .expect(400);
    } finally {
      if (before === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = before;
    }
  });
  it('ADR-071: OTA вручную — канал и номер брони в канале обязательны; номер без пробелов, канал каноническим именем', async () => {
    const ota = (over: Record<string, unknown>) =>
      body({ source: 'OTA', arrivalDate: '2026-09-18', departureDate: '2026-09-19', ...over });
    const r = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ source: 'OTA', channel: 'BookingCom', externalId: ' 999 601 3801 ' }))
      .expect(201);
    expect(fake.state.reservations.get(r.body.confirmationNumber)).toMatchObject({
      source: 'OTA',
      channel: 'Booking.com',
      externalId: '9996013801',
    });
    for (const bad of [
      { channel: undefined, externalId: '111' },
      { channel: 'Booking.com', externalId: undefined },
      { channel: 'Airbnb', externalId: '111' },
      { channel: 'Agoda', externalId: 'a' },
    ])
      await request(app.getHttpServer()).post('/reservations').send(ota(bad)).expect(400);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          source: 'PHONE',
          channel: 'Agoda',
          externalId: '111',
          arrivalDate: '2026-09-18',
          departureDate: '2026-09-19',
        }),
      )
      .expect(400);
  });
  it('ADR-071: номер брони в канале второй раз не заводится — ни вручную, ни когда бронь уже пришла из Channex', async () => {
    const night = (day: string, over: Record<string, unknown>) =>
      body({
        source: 'OTA',
        arrivalDate: `2026-09-${day}`,
        departureDate: `2026-09-${String(Number(day) + 1)}`,
        items: [{ accommodationTypeCode: 'exely-900001', ratePlanCode: 'exely-800001', adults: 1 }],
        ...over,
      });
    const first = await request(app.getHttpServer())
      .post('/reservations')
      .send(night('15', { channel: 'Agoda', externalId: '555' }))
      .expect(201);
    const dup = await request(app.getHttpServer())
      .post('/reservations')
      .send(night('16', { channel: 'Agoda', externalId: '555' }))
      .expect(409);
    expect(dup.body.message).toContain(`уже записан в брони ${first.body.confirmationNumber}`);
    // бронь Booking.com, которую уже прислал Channex: её внешний ID — unique_id
    const channexCard = await request(app.getHttpServer())
      .post('/reservations')
      .send(night('17', { channel: 'Booking.com', externalId: '777' }))
      .expect(201);
    fake.state.reservations.get(channexCard.body.confirmationNumber)!.externalId = 'BDC-778';
    const fromChannex = await request(app.getHttpServer())
      .post('/reservations')
      .send(night('18', { channel: 'Booking.com', externalId: '778' }))
      .expect(409);
    expect(fromChannex.body.message).toContain(
      `уже пришла из канала: ${channexCard.body.confirmationNumber}`,
    );
  });
  it('ADR-071: номер брони в канале можно вписать и поправить на готовой брони OTA; у другой — 400', async () => {
    const r = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ source: 'OTA', channel: 'Hostelworld', externalId: '100' }))
      .expect(201);
    const n = r.body.confirmationNumber;
    await request(app.getHttpServer())
      .patch(`/reservations/${n}`)
      .send({ channel: 'Hostelworld', externalId: '101-A' })
      .expect(200);
    expect(fake.state.reservations.get(n)).toMatchObject({
      channel: 'Hostelworld',
      externalId: '101-A',
    });
    const phone = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/reservations/${phone.body.confirmationNumber}`)
      .send({ channel: 'Agoda', externalId: '200' })
      .expect(400);
  });
  it('rejects a missing/unknown source with 400 — no default (Q-089)', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ source: undefined }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ source: 'FROM_DESK' }))
      .expect(400);
  });
  it('422 when a night has no price, the tariff is inactive or the unit belongs to another category', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-20' }))
      .expect(422);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          items: [
            { accommodationTypeCode: 'exely-900001', ratePlanCode: 'exely-800003', adults: 1 },
          ],
        }),
      )
      .expect(422);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          items: [
            {
              accommodationTypeCode: 'exely-900001',
              ratePlanCode: 'exely-800001',
              adults: 1,
              unitCode: '9002',
            },
          ],
        }),
      )
      .expect(422);
  });
  it('409 when the unit is blocked or already allocated for an overlapping night', async () => {
    await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          items: [
            {
              accommodationTypeCode: 'exely-900001',
              ratePlanCode: 'exely-800001',
              adults: 1,
              unitCode: '9003',
            },
          ],
        }),
      )
      .expect(409);
    await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-16', departureDate: '2026-09-18' }))
      .expect(409);
    // выезд 17 и заезд 17 не пересекаются
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-17', departureDate: '2026-09-18' }))
      .expect(201);
  });
  it('PATCH dates reprices and moves the allocation; cancel frees the unit; both audited', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const moved = await request(app.getHttpServer())
      .patch(`/reservations/${n}/dates`)
      .send({
        arrivalDate: '2026-09-16',
        departureDate: '2026-09-19',
        ratePlanCode: 'exely-800001',
      })
      .expect(200);
    expect(moved.body.arrivalDate).toBe('2026-09-16');
    expect(moved.body.totalAmountMinor).toBe('3300000');
    expect(fake.state.allocations[0]).toMatchObject({ start: '2026-09-16', end: '2026-09-19' });

    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(409);
    const cancelled = await request(app.getHttpServer())
      .post(`/reservations/${n}/cancel`)
      .send({})
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(fake.state.allocations).toHaveLength(0);
    await request(app.getHttpServer()).post(`/reservations/${n}/cancel`).send({}).expect(422);
    await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(201);
    expect(fake.state.audits.map((a) => a.action)).toEqual([
      'reservation.create',
      'reservation.changeDates',
      'reservation.cancel',
      'reservation.create',
    ]);
  });
  // Аудит 26.09, С-15: отмена и незаезд читали статус без блокировки — две вкладки или два сотрудника одновременно
  // проходили проверку «ещё не отменена» и начисляли штраф дважды. Теперь бронь берётся под замок до чтения.
  it('отмена и незаезд берут замок брони раньше, чем читают её состояние', async () => {
    const created = await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
    const n = created.body.confirmationNumber as string;
    fake.state.events.length = 0;
    await request(app.getHttpServer()).post(`/reservations/${n}/cancel`).send({}).expect(200);
    expect(fake.state.events.filter((e) => e.endsWith(n))[0]).toBe(`lock:${n}`);

    const second = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-15', departureDate: '2026-09-18' }))
      .expect(201);
    const n2 = second.body.confirmationNumber as string;
    fake.state.events.length = 0;
    await request(app.getHttpServer())
      .post(`/reservations/${n2}/items/${second.body.items[0].id as string}/no-show`)
      .send({})
      .expect(200);
    expect(fake.state.events.filter((e) => e.endsWith(n2))[0]).toBe(`lock:${n2}`);
  });

  // Предпросмотры читают без транзакции, а рекомендательный замок вне транзакции отпускается тем же запросом: он ничего
  // не держит, только заставляет чтение ждать чужую запись (проверка исправлений 26.09)
  it('предпросмотр действия замок брони не берёт — только читает', async () => {
    const created = await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    fake.state.events.length = 0;
    await request(app.getHttpServer())
      .get(`/reservations/${n}/items/${itemId}/preview?action=cancel`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/reservations/${n}/items/${itemId}/extend-preview?nights=1`)
      .expect(200);
    expect(fake.state.events.filter((e) => e.startsWith('lock:'))).toEqual([]);
    expect(fake.state.events).toContain(`read:${n}`);
  });

  it('Q-103: отмена заранее штрафа не даёт, незаезд даёт; даты меняются без повторного тарифа (Q-102)', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    // Q-102: тариф лежит на проживании — ratePlanCode повторять не нужно
    const moved = await request(app.getHttpServer())
      .patch(`/reservations/${n}/dates`)
      .send({ arrivalDate: '2026-09-16', departureDate: '2026-09-19' })
      .expect(200);
    expect(moved.body.totalAmountMinor).toBe('3300000');

    // отмена задолго до заезда — штрафа нет (ответ управляющего: бесплатно на всех каналах)
    await request(app.getHttpServer()).post(`/reservations/${n}/cancel`).send({}).expect(200);
    expect(fake.penalties).toEqual([]);

    // незаезд — штраф есть всегда: место простояло. Сумма = первая ночь по календарю
    const second = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-15', departureDate: '2026-09-18' }))
      .expect(201);
    const n2 = second.body.confirmationNumber as string;
    const item2 = second.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/reservations/${n2}/items/${item2}/no-show`)
      .send({})
      .expect(200);
    expect(fake.penalties).toEqual([
      {
        itemId: item2,
        amountMinor: 1_100_000n,
        description: 'Штраф за незаезд (2026-09-15 → 2026-09-18)',
      },
    ]);
  });

  it('assign moves the guest to another unit from a date (переселение), 404 for unknown booking/item', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          arrivalDate: '2026-09-15',
          departureDate: '2026-09-18',
          items: [
            { accommodationTypeCode: 'exely-900001', ratePlanCode: 'exely-800001', adults: 1 },
          ],
        }),
      )
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    expect(created.body.items[0].unitCode).toBeNull();
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9001' })
      .expect(200);
    const moved = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9003', fromDate: '2026-09-20' })
      .expect(422); // fromDate вне проживания
    expect(moved.body.message).toMatch(/fromDate/);
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9003', fromDate: '2026-09-16' })
      .expect(409); // 9003 заблокирована
    await request(app.getHttpServer())
      .post(`/reservations/nope/items/${itemId}/assign`)
      .send({ unitCode: '9001' })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/zzz/assign`)
      .send({ unitCode: '9001' })
      .expect(404);
    expect(fake.state.allocations).toEqual([
      expect.objectContaining({ unitId: 'u1', start: '2026-09-15', end: '2026-09-18' }),
    ]);
  });

  it('T1: переселение в другую категорию пересчитывает цену по её календарю и шлёт дельту по обеим категориям; частичное — запрещено', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    expect(created.body.items[0].priceMinor).toBe('2200000'); // 2 ночи × 1 100 000 в одиночной
    published.length = 0;

    // частичное переселение в другую категорию — не выражается моделью, честный отказ
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9002', fromDate: '2026-09-16' })
      .expect(422);

    const moved = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9002' })
      .expect(200);
    expect(moved.body.items[0]).toMatchObject({
      unitCode: '9002',
      accommodationTypeCode: 'exely-900002',
      priceMinor: '3000000', // 2 ночи × 1 500 000 в двойной
    });
    expect(moved.body.totalAmountMinor).toBe('3000000');
    // канал должен узнать: в одиночной освободилось, в двойной занялось
    expect(published).toEqual([
      {
        categoryCodes: ['exely-900001', 'exely-900002'],
        from: '2026-09-15',
        toExclusive: '2026-09-17',
      },
    ]);
  });

  /**
   * Срез 7.3 (Д5): сумму объявляют гостю ДО действия, а до сих пор её считали молча после нажатия.
   * Предпросмотр — только чтение теми же функциями; главный случай — «сумма в окне = начисление».
   */
  it('предпросмотр называет цену переселения и продления, штраф отмены, и ничего не пишет', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-15', departureDate: '2026-09-18' }))
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    const preview = (q: string) =>
      request(app.getHttpServer()).get(`/reservations/${n}/items/${itemId}/preview?${q}`);

    // переселение в двойную: 3 ночи по её календарю вместо одиночной
    const move = await preview('action=move&unitCode=9002').expect(200);
    expect(move.body).toMatchObject({
      action: 'move',
      currentPriceMinor: '3300000',
      newPriceMinor: '4500000',
      differenceMinor: '1200000',
      changesCategory: true,
    });
    // та же категория — цена не меняется, и это сказано, а не показано нулём
    const same = await preview('action=move&unitCode=9001').expect(200);
    expect(same.body).toMatchObject({ changesCategory: false, differenceMinor: '0' });

    // продление: добавляется только новая ночь
    const extend = await preview('action=extend&nights=1').expect(200);
    expect(extend.body).toMatchObject({
      action: 'extend',
      currentPriceMinor: '3300000',
      newPriceMinor: '4400000',
      differenceMinor: '1100000',
    });

    // отмена заранее штрафа не даёт — окно скажет это словом, а не нулём без объяснения (Q-103)
    const cancel = await preview('action=cancel').expect(200);
    expect(cancel.body).toMatchObject({
      action: 'cancel',
      policy: 'FIRST_NIGHT',
      penaltyMinor: '0',
    });

    // незаезд штраф даёт всегда: место простояло. Сумма — первая ночь по календарю
    const noShow = await preview('action=no_show').expect(200);
    expect(noShow.body).toMatchObject({ action: 'no_show', penaltyMinor: '1100000' });

    // предпросмотр ничего не записал: ни штрафа, ни цены
    expect(fake.penalties).toEqual([]);
    expect(fake.state.reservations.get(n)!.items[0]!.priceMinor).toBe(3_300_000n);

    // главное требование Д5: то же число, что начислит настоящий незаезд
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/no-show`)
      .send({})
      .expect(200);
    expect(fake.penalties.map((x) => x.amountMinor.toString())).toEqual([noShow.body.penaltyMinor]);
  });

  it('T2: «+1 ночь» сдвигает выезд, пересчитывает цену и продлевает назначение; занятая ячейка — 409, выселенного продлить нельзя', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    published.length = 0;

    // Цена проживания согласована с каналом и не совпадает с календарём PMS: так приходят брони OTA.
    // Продление обязано добавить только новую ночь, а не переоценить уже проданные.
    const seeded = fake.state.reservations.get(n)!;
    seeded.items[0]!.priceMinor = 3_600_000n;

    const ext = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/extend`)
      .send({})
      .expect(200);
    // 3 600 000 согласованных + одна добавленная ночь по календарю 1 100 000
    expect(ext.body).toMatchObject({ departureDate: '2026-09-18', totalAmountMinor: '4700000' });
    expect(ext.body.items[0]).toMatchObject({
      departureDate: '2026-09-18',
      priceMinor: '4700000',
      unitCode: '9001',
    });
    expect(fake.state.allocations[0]).toMatchObject({ start: '2026-09-15', end: '2026-09-18' });
    expect(published).toHaveLength(1);

    // чужая бронь занимает ту же койку на следующую ночь → продлить нельзя
    const other = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(201);
    const otherItem = other.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/extend`)
      .send({})
      .expect(409);

    // нельзя продлить выселенного
    await request(app.getHttpServer())
      .post(`/reservations/${other.body.confirmationNumber}/items/${otherItem}/check-in`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${other.body.confirmationNumber}/items/${otherItem}/check-out`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${other.body.confirmationNumber}/items/${otherItem}/extend`)
      .send({})
      .expect(422);

    // некорректное число ночей
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/extend`)
      .send({ nights: 0 })
      .expect(400);
  });

  it('Д5 (срез 7.3): сумма в окне = начисление — предпросмотр переселения, продления, отмены и незаезда', async () => {
    const get = (path: string) => request(app.getHttpServer()).get(path);
    const post = (path: string, payload: object = {}) =>
      request(app.getHttpServer()).post(path).send(payload);
    const created = await post('/reservations', body()).expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;

    // переселение в другую категорию: новая сумма по её календарю; ничего не записано
    const mv = await get(`/reservations/${n}/items/${itemId}/move-preview?unitCode=9002`).expect(
      200,
    );
    expect(mv.body).toEqual({
      unitCode: '9002',
      changesCategory: true,
      fromCategory: { code: 'exely-900001', name: 'Тестовая одиночная' },
      toCategory: { code: 'exely-900002', name: 'Тестовая двойная' },
      nights: 2,
      currentMinor: '2200000',
      newMinor: '3000000',
      ratePlanRequired: false,
      problem: null,
    });
    expect(fake.state.audits).toHaveLength(1); // только создание
    // заблокированная ячейка своей категории — причина словом, суммы нет
    const blocked = await get(
      `/reservations/${n}/items/${itemId}/move-preview?unitCode=9003`,
    ).expect(200);
    expect(blocked.body).toMatchObject({ changesCategory: false, newMinor: null });
    expect(blocked.body.problem).toContain('заблокирована');
    // занятая ячейка ДРУГОЙ категории: окно называет категорию цели, а не текущую
    const neighbour = await post(
      '/reservations',
      body({
        arrivalDate: '2026-09-15',
        departureDate: '2026-09-16',
        items: [
          {
            accommodationTypeCode: 'exely-900002',
            ratePlanCode: 'exely-800001',
            adults: 1,
            unitCode: '9002',
          },
        ],
      }),
    ).expect(201);
    const busyOther = await get(
      `/reservations/${n}/items/${itemId}/move-preview?unitCode=9002`,
    ).expect(200);
    expect(busyOther.body).toMatchObject({
      changesCategory: true,
      toCategory: { code: 'exely-900002', name: 'Тестовая двойная' },
      newMinor: null,
    });
    expect(busyOther.body.problem).toContain('занята');
    // соседа убираем: дальше эта же ячейка нужна свободной для настоящего переселения
    await post(`/reservations/${neighbour.body.confirmationNumber}/cancel`).expect(200);
    await get(`/reservations/${n}/items/${itemId}/move-preview`).expect(400);

    // продление: только добавленная ночь по календарю, ячейка свободна
    const ex = await get(`/reservations/${n}/items/${itemId}/extend-preview`).expect(200);
    expect(ex.body).toEqual({
      nights: 1,
      departureDate: '2026-09-18',
      unitCode: '9001',
      addedMinor: '1100000',
      newMinor: '3300000',
      ratePlanRequired: false,
      nextNightsFree: true,
      problem: null,
    });
    await get(`/reservations/${n}/items/${itemId}/extend-preview?nights=0`).expect(400);

    // штраф: отмена до дня заезда — не наступил (Q-103); незаезд — первая ночь по календарю тарифа
    const cp = await get(`/reservations/${n}/cancel-preview`).expect(200);
    expect(cp.body).toEqual({
      reason: 'cancel',
      items: [
        { itemId, unitCode: '9001', policy: 'FIRST_NIGHT', dueNow: false, penaltyMinor: '0' },
      ],
      totalPenaltyMinor: '0',
    });
    const ns = await get(
      `/reservations/${n}/cancel-preview?reason=no_show&itemId=${itemId}`,
    ).expect(200);
    expect(ns.body.items[0]).toMatchObject({ dueNow: true, penaltyMinor: '1100000' });
    await get(`/reservations/${n}/cancel-preview?reason=refund`).expect(400);
    await get(`/reservations/${n}/cancel-preview?itemId=nope`).expect(404);

    // окно = начисление: переселение
    const moved = await post(`/reservations/${n}/items/${itemId}/assign`, {
      unitCode: '9002',
    }).expect(200);
    expect(moved.body.items[0].priceMinor).toBe(mv.body.newMinor);
    // окно = начисление: продление уже в новой категории (её календарь — 1 500 000 за ночь)
    const ex2 = await get(`/reservations/${n}/items/${itemId}/extend-preview`).expect(200);
    expect(ex2.body).toMatchObject({
      unitCode: '9002',
      addedMinor: '1500000',
      newMinor: '4500000',
    });
    const extended = await post(`/reservations/${n}/items/${itemId}/extend`).expect(200);
    expect(extended.body.items[0].priceMinor).toBe(ex2.body.newMinor);
    // соседняя бронь занимает ячейку на следующую ночь → предпросмотр говорит «занята», команда даст 409
    await post(
      '/reservations',
      body({
        arrivalDate: '2026-09-18',
        departureDate: '2026-09-19',
        items: [
          {
            accommodationTypeCode: 'exely-900002',
            ratePlanCode: 'exely-800001',
            adults: 1,
            unitCode: '9002',
          },
        ],
      }),
    ).expect(201);
    const busy = await get(`/reservations/${n}/items/${itemId}/extend-preview`).expect(200);
    expect(busy.body).toMatchObject({ nextNightsFree: false, departureDate: '2026-09-19' });
    // окно = начисление: незаезд — штраф ровно той суммы, что показал предпросмотр
    const ns2 = await get(
      `/reservations/${n}/cancel-preview?reason=no_show&itemId=${itemId}`,
    ).expect(200);
    expect(ns2.body.items[0].penaltyMinor).toBe('1500000');
    await post(`/reservations/${n}/items/${itemId}/no-show`).expect(200);
    expect(fake.penalties).toEqual([
      {
        itemId,
        amountMinor: BigInt(ns2.body.items[0].penaltyMinor),
        description: 'Штраф за незаезд (2026-09-15 → 2026-09-18)',
      },
    ]);
  });

  it('T3: выселить с непогашенным счётом можно только с подтверждением, и это попадает в журнал', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-in`)
      .send({})
      .expect(200);

    fake.state.debts.set(itemId, 1_250_000n); // 12 500,00 ₸ долга
    const refused = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-out`)
      .send({})
      .expect(409);
    expect(refused.body.message).toContain('12 500,00 ₸');

    const done = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-out`)
      .send({ withDebt: true })
      .expect(200);
    expect(done.body.items[0].status).toBe('CHECKED_OUT');
    expect(fake.state.audits.map((a) => a.action)).toContain('reservation.checkOut.withDebt');
    expect(fake.state.closedFolios).toEqual([]); // счёт с долгом остаётся открытым

    // а когда рассчитались — счёт закрывается при выезде
    const clean = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(201);
    const cleanItem = clean.body.items[0].id as string;
    await request(app.getHttpServer())
      .post(`/reservations/${clean.body.confirmationNumber}/items/${cleanItem}/check-in`)
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/reservations/${clean.body.confirmationNumber}/items/${cleanItem}/check-out`)
      .send({})
      .expect(200);
    expect(fake.state.closedFolios).toEqual([cleanItem]);
  });

  it('ADR-020: ограничения продаж действуют на стойке — стоп-продажа, закрытый заезд/выезд, срок → 409 с датой и категорией; канал и другая категория не задеты', async () => {
    const post = (b: object) => request(app.getHttpServer()).post('/reservations').send(b);
    const rule = (date: string, over: Partial<StayRestriction>) => ({
      typeId: 't1',
      planId: 'p1',
      date,
      minStay: null,
      maxStay: null,
      stopSell: false,
      closedToArrival: false,
      closedToDeparture: false,
      ...over,
    });

    // стоп-продажа на вторую ночь — бронь 15→17 не проходит, сообщение читается на стойке
    fake.state.restrictions.push(rule('2026-09-16', { stopSell: true }));
    const stop = await post(body()).expect(409);
    expect(stop.body.message).toBe('Стоп-продажа на 2026-09-16, Тестовая одиночная');
    // другая категория той же датой — без ограничений, продаётся
    await post(
      body({
        items: [
          {
            accommodationTypeCode: 'exely-900002',
            ratePlanCode: 'exely-800001',
            adults: 1,
            unitCode: '9002',
          },
        ],
      }),
    ).expect(201);
    // ночь выезда не продаётся: стоп-продажа на 17-е брони 15→17 не мешает
    fake.state.restrictions.length = 0;
    fake.state.restrictions.push(rule('2026-09-17', { stopSell: true }));
    const created = await post(body()).expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;

    // продление «+1 ночь» упирается в стоп-продажу на добавленную ночь
    const ext = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/extend`)
      .send({})
      .expect(409);
    expect(ext.body.message).toBe('Стоп-продажа на 2026-09-17, Тестовая одиночная');

    // максимальный срок по дате заезда: 15→17 = 2 ночи, продление до 3 — отказ
    fake.state.restrictions.length = 0;
    fake.state.restrictions.push(rule('2026-09-15', { maxStay: 2 }));
    const max = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/extend`)
      .send({})
      .expect(409);
    expect(max.body.message).toBe(
      'Максимальный срок 2 ноч. на 2026-09-15, Тестовая одиночная: запрошено 3 ноч.',
    );

    // закрытый заезд на 16-е: перенос дат 16→18 — отказ, 15→18 проходит
    fake.state.restrictions.length = 0;
    fake.state.restrictions.push(rule('2026-09-16', { closedToArrival: true }));
    const cta = await request(app.getHttpServer())
      .patch(`/reservations/${n}/dates`)
      .send({ arrivalDate: '2026-09-16', departureDate: '2026-09-18' })
      .expect(409);
    expect(cta.body.message).toBe('Закрыт заезд на 2026-09-16, Тестовая одиночная');
    await request(app.getHttpServer())
      .patch(`/reservations/${n}/dates`)
      .send({ arrivalDate: '2026-09-15', departureDate: '2026-09-18' })
      .expect(200);

    // закрытый выезд на 18-е ловится при переносе, минимальный срок — при создании
    fake.state.restrictions.length = 0;
    fake.state.restrictions.push(rule('2026-09-18', { closedToDeparture: true }));
    const ctd = await request(app.getHttpServer())
      .patch(`/reservations/${n}/dates`)
      .send({ arrivalDate: '2026-09-16', departureDate: '2026-09-18' })
      .expect(409);
    expect(ctd.body.message).toBe('Закрыт выезд на 2026-09-18, Тестовая одиночная');
    fake.state.restrictions.length = 0;
    fake.state.restrictions.push(rule('2026-09-15', { minStay: 3 }));
    const min = await post(
      body({
        items: [{ accommodationTypeCode: 'exely-900001', ratePlanCode: 'exely-800001', adults: 1 }],
      }),
    ).expect(409);
    expect(min.body.message).toBe(
      'Минимальный срок 3 ноч. на 2026-09-15, Тестовая одиночная: запрошено 2 ноч.',
    );
    // отказ по ограничению ничего не записал: журнал только с успешных команд
    expect(fake.state.audits.map((a) => a.action)).toEqual([
      'reservation.create',
      'reservation.create',
      'reservation.changeDates',
    ]);
  });

  it('Q-169: пока база не в РК, почта и телефоны в заметке брони маскируются — и при создании, и при правке', async () => {
    const before = process.env.PII_STORAGE;
    delete process.env.PII_STORAGE;
    try {
      const created = await request(app.getHttpServer())
        .post('/reservations')
        .send(body({ notes: 'просил звонить +7 701 234 56 78 или писать guest.test@example.com' }))
        .expect(201);
      expect(created.body.notes).toBe('просил звонить <телефон> или писать <почта>');
      const patched = await request(app.getHttpServer())
        .patch(`/reservations/${created.body.confirmationNumber as string}`)
        .send({ notes: 'поздний заезд, WhatsApp 8 (777) 123-45-67' })
        .expect(200);
      expect(patched.body.notes).toBe('поздний заезд, WhatsApp <телефон>');
    } finally {
      if (before === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = before;
    }
  });

  it('Q-169: база в Казахстане (PII_STORAGE=real) — заметка как введена', async () => {
    const before = process.env.PII_STORAGE;
    process.env.PII_STORAGE = 'real';
    try {
      const created = await request(app.getHttpServer())
        .post('/reservations')
        .send(body({ notes: 'звонить +7 701 234 56 78', guest: { firstName: 'Тест', lastName: 'Гостев' } }))
        .expect(201);
      expect(created.body.notes).toBe('звонить +7 701 234 56 78');
    } finally {
      if (before === undefined) delete process.env.PII_STORAGE;
      else process.env.PII_STORAGE = before;
    }
  });

  it('правка готовой брони: PATCH заметки и источник, PATCH гостей на проживании с проверкой вместимости; всё в журнале', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ notes: 'первая заметка' }))
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    expect(created.body).toMatchObject({ source: 'PHONE', notes: 'первая заметка' });

    const patched = await request(app.getHttpServer())
      .patch(`/reservations/${n}`)
      .send({ notes: 'поздний заезд, ключ у соседа', source: 'WHATSAPP' })
      .expect(200);
    expect(patched.body).toMatchObject({
      source: 'WHATSAPP',
      notes: 'поздний заезд, ключ у соседа',
    });
    // заметку можно стереть, источник — только из справочника, пустой запрос — ошибка
    const cleared = await request(app.getHttpServer())
      .patch(`/reservations/${n}`)
      .send({ notes: null })
      .expect(200);
    expect(cleared.body).toMatchObject({ source: 'WHATSAPP', notes: null });
    await request(app.getHttpServer())
      .patch(`/reservations/${n}`)
      .send({ source: 'FROM_MARS' })
      .expect(400);
    await request(app.getHttpServer()).patch(`/reservations/${n}`).send({}).expect(400);
    await request(app.getHttpServer()).patch('/reservations/nope').send({ notes: 'x' }).expect(404);

    // гостей на проживании: одиночная вмещает одного взрослого, детей на объекте нет
    const over = await request(app.getHttpServer())
      .patch(`/reservations/${n}/items/${itemId}`)
      .send({ adults: 2 })
      .expect(422);
    expect(over.body.message).toMatch(/вместимость 1/);
    await request(app.getHttpServer())
      .patch(`/reservations/${n}/items/${itemId}`)
      .send({ adults: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/reservations/${n}/items/${itemId}`)
      .send({ adults: 1, children: 1 })
      .expect(422);
    await request(app.getHttpServer())
      .patch(`/reservations/${n}/items/zzz`)
      .send({ adults: 1 })
      .expect(404);

    // двойная вмещает двоих: гостей 1 → 2, шапка брони пересчитана
    const two = await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          items: [
            {
              accommodationTypeCode: 'exely-900002',
              ratePlanCode: 'exely-800001',
              adults: 1,
              unitCode: '9002',
            },
          ],
        }),
      )
      .expect(201);
    const n2 = two.body.confirmationNumber as string;
    const item2 = two.body.items[0].id as string;
    const guests = await request(app.getHttpServer())
      .patch(`/reservations/${n2}/items/${item2}`)
      .send({ adults: 2 })
      .expect(200);
    expect(guests.body.items[0]).toMatchObject({ adults: 2, children: 0 });
    expect(guests.body.adults).toBe(2);

    expect(fake.state.audits.map((a) => a.action)).toEqual([
      'reservation.create',
      'reservation.update',
      'reservation.update',
      'reservation.create',
      'reservation.updateItem',
    ]);
  });

  it('групповая бронь: quantity=3 → 3 проживания на трёх разных свободных ячейках по номеру; свободных меньше → 409 «свободно только K»', async () => {
    const post = (b: object) => request(app.getHttpServer()).post('/reservations').send(b);
    const group = (quantity: number, over: Record<string, unknown> = {}) =>
      body({
        items: [
          {
            accommodationTypeCode: 'exely-900001',
            ratePlanCode: 'exely-800001',
            adults: 1,
            quantity,
          },
        ],
        ...over,
      });
    // конкретная ячейка вместе с количеством — противоречие, а не выбор
    await post(
      body({
        items: [
          {
            accommodationTypeCode: 'exely-900001',
            ratePlanCode: 'exely-800001',
            adults: 1,
            quantity: 2,
            unitCode: '9001',
          },
        ],
      }),
    ).expect(400);
    await post(group(0)).expect(400);

    const res = await post(group(3)).expect(201);
    expect(res.body.items).toHaveLength(3);
    // 9003 заблокирована на эти даты — пропущена; порядок по номеру ячейки, не по порядку в списке
    expect(res.body.items.map((i: { unitCode: string }) => i.unitCode)).toEqual([
      '9001',
      '9004',
      '9005',
    ]);
    expect(res.body.totalAmountMinor).toBe('6600000'); // 3 койки × 2 ночи × 11 000 ₸
    expect(res.body.adults).toBe(3);
    // заказчик записан гостем на каждое проживание — регистрационная карта печатается с каждого
    for (const it of res.body.items) expect(it.guests).toHaveLength(1);
    expect(fake.state.allocations.map((a) => a.unitId).sort()).toEqual(['u1', 'u4', 'u5']);

    // на пересекающиеся даты свободна только одна койка — просьба на две отклоняется с числом
    const refused = await post(
      group(2, { arrivalDate: '2026-09-16', departureDate: '2026-09-18' }),
    ).expect(409);
    expect(refused.body.message).toContain('свободно только 0');
    const later = await post(
      group(2, { arrivalDate: '2026-09-17', departureDate: '2026-09-18' }),
    ).expect(201);
    expect(later.body.items.map((i: { unitCode: string }) => i.unitCode)).toEqual(['9001', '9004']);
    expect(fake.state.audits.map((a) => a.action)).toEqual([
      'reservation.create',
      'reservation.create',
    ]);
  });

  /**
   * Q-199 (ответ владельца 27.09.2026 — «нет не могут»): тариф — цена и правило штрафа брони, у существующей брони его
   * меняют владелец и управляющий (право `rates`). Администратор меняет даты, продлевает и переселяет в том же тарифе.
   * Брони из Exely без тарифа тариф назначают они же — до ответа на Q-200.
   */
  describe('тариф брони по роли (Q-199, ADR-106)', () => {
    const secondPlan = () => {
      fake.plans.push({
        id: 'p2',
        code: 'exely-800002',
        name: 'Тестовый без штрафа',
        currency: 'KZT',
        active: true,
        cancellationPenalty: 'NONE',
      });
      fake.covers.add('p2');
      for (const d of ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']) {
        fake.rates[`t1|p2|${d}|1`] = 900_000n;
        fake.rates[`t2|p2|${d}|1`] = 1_200_000n;
      }
    };
    const as = <T>(role: MembershipRole, fn: () => Promise<T>) =>
      withSignedInUser({ userId: `user-${role}`, organizationId: 'org-test', role }, fn);
    const service = () => app.get(ReservationsService);
    const book = async () => {
      const res = await request(app.getHttpServer()).post('/reservations').send(body()).expect(201);
      return { n: res.body.confirmationNumber as string, itemId: res.body.items[0].id as string };
    };
    const planOf = (n: string) => fake.state.reservations.get(n)!.items[0]!.ratePlanId;
    const stay = { arrivalDate: '2026-09-15', departureDate: '2026-09-18' };

    it('администратор меняет даты в том же тарифе; другой тариф — отказ словами, бронь не тронута', async () => {
      secondPlan();
      const { n } = await book();
      await expect(
        as('STAFF', () => service().changeDates(n, { ...stay, ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_CHANGE_MESSAGE);
      expect(planOf(n)).toBe('p1');
      expect(fake.state.reservations.get(n)!.departureDate).toBe('2026-09-17');

      const kept = await as('STAFF', () => service().changeDates(n, stay));
      expect(kept.departureDate).toBe('2026-09-18');
      expect(planOf(n)).toBe('p1');
    });

    it('управляющий тариф меняет', async () => {
      secondPlan();
      const { n } = await book();
      await as('MANAGER', () => service().changeDates(n, { ...stay, ratePlanCode: 'exely-800002' }));
      expect(planOf(n)).toBe('p2');
    });

    it('продление и переселение в другую категорию — в тарифе брони; с другим тарифом — отказ', async () => {
      secondPlan();
      const { n, itemId } = await book();
      await expect(
        as('STAFF', () => service().extend(n, itemId, { nights: 1, ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_CHANGE_MESSAGE);
      await as('STAFF', () => service().extend(n, itemId, { nights: 1 }));
      await expect(
        as('STAFF', () => service().assign(n, itemId, { unitCode: '9002', ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_CHANGE_MESSAGE);
      const moved = await as('STAFF', () => service().assign(n, itemId, { unitCode: '9002' }));
      expect(moved.items[0]!.unitCode).toBe('9002');
      expect(planOf(n)).toBe('p1');
    });

    /**
     * Q-200 (ответ владельца 27.09.2026 — «Да, разрешить»): брони из Exely без тарифа администратор назначает тариф один
     * раз, со штрафом не мягче «первых суток»; тариф записывается в бронь и дальше меняется только владельцем и
     * управляющим. В фальшивке p1 — «первые сутки», p2 — без штрафа.
     */
    it('бронь из Exely без тарифа: администратор назначает тариф со штрафом, без штрафа — отказ; тариф записывается (Q-200)', async () => {
      secondPlan();
      const plain = await book();
      fake.state.reservations.get(plain.n)!.items[0]!.ratePlanId = null;
      // без выбора пересчитать не по чему — стойка просит выбрать тариф, как у всех
      await expect(as('STAFF', () => service().changeDates(plain.n, stay))).rejects.toThrow(
        /ratePlanCode обязателен/,
      );
      const preview = await as('STAFF', () =>
        service().previewExtend(plain.n, plain.itemId, { nights: 1 }),
      );
      expect(preview.ratePlanRequired).toBe(true);
      await expect(
        as('STAFF', () => service().changeDates(plain.n, { ...stay, ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_SOFT_MESSAGE);
      expect(planOf(plain.n)).toBeNull();
      await as('STAFF', () => service().changeDates(plain.n, { ...stay, ratePlanCode: 'exely-800001' }));
      expect(planOf(plain.n)).toBe('p1');
      // записанный тариф администратор уже не меняет (Q-199)
      await expect(
        as('STAFF', () => service().changeDates(plain.n, { ...stay, ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_CHANGE_MESSAGE);
    });

    it('продление брони без тарифа записывает выбранный тариф: второе продление — уже в нём (Q-200)', async () => {
      secondPlan();
      const { n, itemId } = await book();
      fake.state.reservations.get(n)!.items[0]!.ratePlanId = null;
      await expect(
        as('STAFF', () => service().extend(n, itemId, { nights: 1, ratePlanCode: 'exely-800002' })),
      ).rejects.toThrow(RATE_PLAN_SOFT_MESSAGE);
      await as('STAFF', () => service().extend(n, itemId, { nights: 1, ratePlanCode: 'exely-800001' }));
      expect(planOf(n)).toBe('p1');
      await as('STAFF', () => service().extend(n, itemId, { nights: 1 }));
      expect(fake.state.reservations.get(n)!.items[0]!.departureDate).toBe('2026-09-19');
    });

    it('управляющий назначает брони без тарифа любой тариф, и без штрафа тоже', async () => {
      secondPlan();
      const { n } = await book();
      fake.state.reservations.get(n)!.items[0]!.ratePlanId = null;
      await as('MANAGER', () => service().changeDates(n, { ...stay, ratePlanCode: 'exely-800002' }));
      expect(planOf(n)).toBe('p2');
    });
  });

  it('GET /rate-plans lists only active tariffs', async () => {
    const res = await request(app.getHttpServer()).get('/rate-plans').expect(200);
    // правило штрафа — чтобы стойка показала администратору только тарифы, которые ему можно назначить (Q-200)
    expect(res.body).toEqual([
      {
        code: 'exely-800001',
        name: 'Тестовый базовый',
        currency: 'KZT',
        cancellationPenalty: 'FIRST_NIGHT',
      },
    ]);
  });

  it('check-in needs an assigned unit; check-out frees the unit on early departure; no-show drops the allocation', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          arrivalDate: '2026-09-15',
          departureDate: '2026-09-18',
          items: [
            { accommodationTypeCode: 'exely-900001', ratePlanCode: 'exely-800001', adults: 1 },
          ],
        }),
      )
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    const noUnit = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-in`)
      .send({})
      .expect(422);
    expect(noUnit.body.message).toMatch(/назначьте ячейку/);
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/assign`)
      .send({ unitCode: '9001' })
      .expect(200);
    const checkedIn = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-in`)
      .send({})
      .expect(200);
    expect(checkedIn.body.status).toBe('CHECKED_IN');
    expect(checkedIn.body.items[0].status).toBe('CHECKED_IN');
    // Q-156: карточка знает статус уборки ячейки — стойка предупреждает о непроверенной перед заселением
    expect(checkedIn.body.items[0].unitHousekeepingStatus).toBe('INSPECTED');
    await request(app.getHttpServer()).post(`/reservations/${n}/cancel`).send({}).expect(422); // заселённого не отменить
    const out = await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-out`)
      .send({})
      .expect(200);
    expect(out.body.items[0].status).toBe('CHECKED_OUT');
    // Q-155 (ADR-068): выезд сам переводит ячейку в «требует уборки», запись журнала называет причину
    expect(fake.units.find((u) => u.code === '9001')?.housekeepingStatus).toBe('DIRTY');
    expect(fake.state.audits.map((a) => a.action)).toContain('unit.housekeeping');
    await request(app.getHttpServer())
      .post(`/reservations/${n}/items/${itemId}/check-out`)
      .send({})
      .expect(422);

    const second = await request(app.getHttpServer())
      .post('/reservations')
      .send(
        body({
          arrivalDate: '2026-09-15',
          departureDate: '2026-09-16',
          items: [
            {
              accommodationTypeCode: 'exely-900001',
              ratePlanCode: 'exely-800001',
              adults: 1,
              unitCode: '9003',
            },
          ],
        }),
      )
      .expect(409);
    void second;
    const third = await request(app.getHttpServer())
      .post('/reservations')
      .send(body({ arrivalDate: '2026-09-18', departureDate: '2026-09-19' }))
      .expect(201);
    const n3 = third.body.confirmationNumber as string;
    const i3 = third.body.items[0].id as string;
    const ns = await request(app.getHttpServer())
      .post(`/reservations/${n3}/items/${i3}/no-show`)
      .send({})
      .expect(200);
    expect(ns.body.status).toBe('NO_SHOW');
    expect(fake.state.allocations.filter((a) => a.itemId === i3)).toHaveLength(0);
    expect(fake.state.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['reservation.checkIn', 'reservation.checkOut', 'reservation.noShow']),
    );
  });
  it('заселение без гражданства и с гражданством из одних пробелов отклоняется одним и тем же сообщением', async () => {
    const created = await request(app.getHttpServer())
      .post('/reservations')
      .send(body())
      .expect(201);
    const n = created.body.confirmationNumber as string;
    const itemId = created.body.items[0].id as string;
    const checkIn = () =>
      request(app.getHttpServer()).post(`/reservations/${n}/items/${itemId}/check-in`).send({});

    fake.state.citizenship = null;
    const missing = await checkIn().expect(422);
    expect(missing.body.message).toMatch(/гражданство/);

    // CHAR(3) в Postgres дополняет пустую строку пробелами: '' → '   '. Строка из пробелов истинна в JS,
    // и проверка «есть/нет» её пропускала — гость заселялся без гражданства (наблюдение 12.09.2026).
    fake.state.citizenship = '   ';
    const blank = await checkIn().expect(422);
    expect(blank.body.message).toBe(missing.body.message);
    expect(fake.state.audits.map((a) => a.action)).not.toContain('reservation.checkIn');

    fake.state.citizenship = 'KAZ';
    const ok = await checkIn().expect(200);
    expect(ok.body.items[0].status).toBe('CHECKED_IN');
  });
});
