import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ARI_PUBLISHER, type AriPublisher, type LocalRateChange } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import { RatesModule } from './rates.module';
import {
  RATES_REPOSITORY,
  expandDates,
  type RateRowCounts,
  type RatesRepository,
} from './rates.repository';

function makeFakes() {
  const applied: unknown[] = [];
  const published: LocalRateChange[][] = [];
  const audits: string[] = [];
  const repo: RatesRepository = {
    async categories() {
      return [
        { id: 't1', code: 'exely-900001', name: 'Одиночная', capacityAdults: 1 },
        { id: 't2', code: 'exely-900002', name: 'Двойная', capacityAdults: 2 },
      ];
    },
    async ratePlans() {
      return [{ id: 'p2', code: 'exely-800002', name: 'ОТА', currency: 'KZT', active: true }];
    },
    async calendar(_t, _p, from, to) {
      return expandDates(from, to).map((date) => ({
        date,
        prices: { '1': '1540000' },
        minStay: null,
        maxStay: null,
        stopSell: false,
        closedToArrival: false,
        closedToDeparture: false,
      }));
    },
    // Как настоящая транзакция: хук внутри неё (журнал, очередь каналов) упал — ничего не записано
    async applyChanges(
      changes,
      inTransaction?: (tx: unknown, counts: RateRowCounts) => Promise<void>,
    ) {
      const counts = { rateRows: changes.length, restrictionRows: 0 };
      if (inTransaction) await inTransaction({ fakeTx: true }, counts);
      applied.push(...changes);
      return counts;
    },
    async audit(action) {
      audits.push(action);
    },
  };
  const publisher: AriPublisher = {
    async reservationChanged() {},
    async ratesChanged(changes) {
      published.push(changes);
      // как настоящий издатель: сколько значений встало в очередь (здесь — все сопоставлены)
      return changes.length;
    },
  };
  return { repo, publisher, applied, published, audits };
}

describe('rates API', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
  });
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const m = await Test.createTestingModule({ imports: [RatesModule] })
      .overrideProvider(RATES_REPOSITORY)
      .useFactory({ factory: () => proxy(() => fakes.repo) })
      .overrideProvider(ARI_PUBLISHER)
      .useFactory({ factory: () => proxy(() => fakes.publisher) })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('expandDates honours weekday filter', () => {
    expect(expandDates('2026-11-01', '2026-11-10', ['mo'])).toEqual(['2026-11-02', '2026-11-09']);
    expect(expandDates('2026-11-01', '2026-11-03')).toHaveLength(3);
  });

  it('GET /rates returns the calendar for a category × tariff', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/rates?accommodationTypeCode=exely-900001&ratePlanCode=exely-800002&from=2026-11-01&to=2026-11-03',
      )
      .expect(200);
    expect(res.body.days).toHaveLength(3);
    expect(res.body.days[0]).toMatchObject({ date: '2026-11-01', prices: { '1': '1540000' } });
    await request(app.getHttpServer())
      .get(
        '/rates?accommodationTypeCode=exely-900001&ratePlanCode=nope&from=2026-11-01&to=2026-11-03',
      )
      .expect(422);
  });

  it('POST /rates/bulk applies several changes in one transaction and publishes ONE batch (certification tests 3–8)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({
        changes: [
          {
            accommodationTypeCode: 'exely-900001',
            ratePlanCode: 'exely-800002',
            dateFrom: '2026-11-21',
            dateTo: '2026-11-21',
            price: '333',
          },
          {
            accommodationTypeCode: 'exely-900002',
            ratePlanCode: 'exely-800002',
            dateFrom: '2026-11-01',
            dateTo: '2026-11-10',
            days: ['mo', 'tu'],
            price: '456.23',
            minStay: 3,
            closedToArrival: true,
          },
          {
            accommodationTypeCode: 'exely-900002',
            ratePlanCode: 'exely-800002',
            dateFrom: '2026-11-16',
            dateTo: '2026-11-16',
            stopSell: true,
          },
        ],
      })
      .expect(201);
    // queued — сколько значений действительно ушло в очередь каналов (волна 3: стойка не пишет
    // «ушло в каналы» для несопоставленных категорий и тарифов)
    expect(res.body).toMatchObject({ applied: 3, rateRows: 3, queued: 3 });
    expect(fakes.applied[1]).toMatchObject({
      accommodationTypeId: 't2',
      capacityAdults: 2,
      priceMinor: 45623n,
      minStay: 3,
      closedToArrival: true,
      days: ['mo', 'tu'],
    });
    expect(fakes.published).toHaveLength(1);
    expect(fakes.published[0]).toEqual([
      {
        accommodationTypeCode: 'exely-900001',
        ratePlanCode: 'exely-800002',
        dateFrom: '2026-11-21',
        dateTo: '2026-11-21',
        priceMinor: 33300n,
        primaryOccupancy: 1,
      },
      {
        accommodationTypeCode: 'exely-900002',
        ratePlanCode: 'exely-800002',
        dateFrom: '2026-11-01',
        dateTo: '2026-11-10',
        days: ['mo', 'tu'],
        priceMinor: 45623n,
        primaryOccupancy: 2,
        minStay: 3,
        closedToArrival: true,
      },
      {
        accommodationTypeCode: 'exely-900002',
        ratePlanCode: 'exely-800002',
        dateFrom: '2026-11-16',
        dateTo: '2026-11-16',
        stopSell: true,
      },
    ]);
    expect(fakes.audits).toEqual(['rates.bulk']);
  });

  it('rejects bad input with 400: no changes, bad date, nothing to change, occupancy above capacity', async () => {
    const base = {
      accommodationTypeCode: 'exely-900001',
      ratePlanCode: 'exely-800002',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-02',
    };
    await request(app.getHttpServer()).post('/rates/bulk').send({ changes: [] }).expect(400);
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...base, dateTo: '2026-10-01', price: '1' }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...base }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...base, price: '1', occupancy: 2 }] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...base, price: '1e3' }] })
      .expect(400);
    expect(fakes.published).toHaveLength(0);
  });

  const one = {
    accommodationTypeCode: 'exely-900002',
    ratePlanCode: 'exely-800002',
    dateFrom: '2026-11-01',
    dateTo: '2026-11-02',
  };

  it('rejects a zero price with 400: channels refuse it (Channex «rate must be greater than 0»)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...one, price: '0' }] })
      .expect(400);
    expect(res.body.message).toContain('больше нуля');
    expect(fakes.applied).toHaveLength(0);
    expect(fakes.published).toHaveLength(0);
  });

  it('min stay 0 and max stay 0 mean «no restriction»: stored and published as null, never as 0', async () => {
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...one, minStay: 0, maxStay: 0 }] })
      .expect(201);
    expect(fakes.applied[0]).toMatchObject({ minStay: null, maxStay: null });
    expect(fakes.published[0]![0]).toMatchObject({ minStay: null, maxStay: null });
  });

  it('a price for fewer guests carries its occupancy and the category capacity to the channel publisher', async () => {
    await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...one, price: '5000', occupancy: 1 }] })
      .expect(201);
    expect(fakes.published[0]![0]).toMatchObject({
      priceMinor: 500000n,
      occupancy: 1,
      primaryOccupancy: 2,
    });
  });

  it('prices, audit and the channel batch are one transaction: if queueing for channels fails, prices are not saved', async () => {
    fakes.publisher.ratesChanged = async () => {
      throw new Error('channel_outbox insert failed');
    };
    const res = await request(app.getHttpServer())
      .post('/rates/bulk')
      .send({ changes: [{ ...one, price: '5000' }] });
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(fakes.applied).toHaveLength(0);
  });
});
