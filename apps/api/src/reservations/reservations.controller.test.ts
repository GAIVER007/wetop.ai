import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { ReservationsModule } from './reservations.module';
import {
  AllocationOverlapError,
  RESERVATIONS_UOW,
  type ReservationState,
  type ReservationsRepository,
  type UnitOfWork,
} from './reservations.repository';

/** Фальшивое хранилище в памяти: 2 категории, тариф, ячейки, цены. Вымышленные данные. */
function makeFake() {
  const types = [
    { id: 't1', code: 'exely-900001', name: 'Тестовая одиночная', active: true, capacityAdults: 1 },
    { id: 't2', code: 'exely-900002', name: 'Тестовая двойная', active: true, capacityAdults: 2 },
  ];
  const plans = [
    { id: 'p1', code: 'exely-800001', name: 'Тестовый базовый', currency: 'KZT', active: true },
    { id: 'p3', code: 'exely-800003', name: 'Мёртвый', currency: 'KZT', active: false },
  ];
  const units = [
    { id: 'u1', code: '9001', accommodationTypeId: 't1', active: true },
    { id: 'u2', code: '9002', accommodationTypeId: 't2', active: true },
    { id: 'u3', code: '9003', accommodationTypeId: 't1', active: true },
  ];
  const rates: Record<string, bigint> = {};
  for (const d of ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']) {
    rates[`t1|p1|${d}|1`] = 1_100_000n;
    rates[`t2|p1|${d}|1`] = 1_500_000n;
    rates[`t2|p1|${d}|2`] = 1_500_000n;
  }
  const state = {
    reservations: new Map<string, ReservationState>(),
    allocations: [] as Array<{
      id: string;
      itemId: string;
      unitId: string;
      start: string;
      end: string;
    }>,
    audits: [] as Array<{ entityType: string; action: string }>,
    guests: 0,
    seq: 0,
  };
  const blocked = [{ unitId: 'u3', from: '2026-09-15', to: '2026-09-20' }];
  const overlaps = (unitId: string, start: string, end: string, exceptItem?: string) =>
    state.allocations.some(
      (a) => a.unitId === unitId && a.itemId !== exceptItem && a.start < end && a.end > start,
    );
  const repo: ReservationsRepository = {
    async property() {
      return { id: 'prop', currency: 'KZT' };
    },
    async categoryByCode(code) {
      return types.find((t) => t.code === code) ?? null;
    },
    async ratePlanByCode(code) {
      return plans.find((p) => p.code === code) ?? null;
    },
    async activeRatePlans() {
      return plans.filter((p) => p.active);
    },
    async ratePlanCoversType(planId, typeId) {
      return planId === 'p1' && ['t1', 't2'].includes(typeId);
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
    async hasBlockOverlap(unitId, from, toExclusive) {
      return blocked.some((b) => b.unitId === unitId && b.from < toExclusive && b.to > from);
    },
    async createGuest() {
      state.guests += 1;
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
    async reservationByNumber(number) {
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
    async audit(entry) {
      state.audits.push({ entityType: entry.entityType, action: entry.action });
    },
    async card(number) {
      const r = state.reservations.get(number);
      if (!r) return null;
      return {
        confirmationNumber: r.confirmationNumber,
        source: 'DESK',
        channel: null,
        status: r.status,
        arrivalDate: r.arrivalDate,
        departureDate: r.departureDate,
        adults: 1,
        children: 0,
        currency: r.currency,
        totalAmountMinor: r.items.reduce((s, i) => s + i.priceMinor, 0n).toString(),
        notes: null,
        primaryGuest: { label: 'Гость Тестовый', citizenship: null },
        items: r.items.map((it) => ({
          id: it.id,
          accommodationTypeCode: types.find((t) => t.id === it.accommodationTypeId)!.code,
          accommodationTypeName: types.find((t) => t.id === it.accommodationTypeId)!.name,
          arrivalDate: it.arrivalDate,
          departureDate: it.departureDate,
          status: it.status,
          priceMinor: it.priceMinor.toString(),
          unitCode: state.allocations.find((a) => a.itemId === it.id)?.unitId
            ? units.find((u) => u.id === state.allocations.find((a) => a.itemId === it.id)!.unitId)!
                .code
            : null,
          guests: [],
        })),
      };
    },
  };
  const uow: UnitOfWork = { run: (fn) => fn(repo) };
  return { uow, state };
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
  let app: INestApplication;
  let fake: ReturnType<typeof makeFake>;
  beforeEach(() => {
    fake = makeFake();
  });
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [ReservationsModule] })
      .overrideProvider(RESERVATIONS_UOW)
      .useFactory({
        factory: () => ({ run: (fn: Parameters<UnitOfWork['run']>[0]) => fake.uow.run(fn) }),
      })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
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

  it('GET /rate-plans lists only active tariffs', async () => {
    const res = await request(app.getHttpServer()).get('/rate-plans').expect(200);
    expect(res.body).toEqual([{ code: 'exely-800001', name: 'Тестовый базовый', currency: 'KZT' }]);
  });
});
