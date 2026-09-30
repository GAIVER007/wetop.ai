import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NightRate, StayRestriction } from '@pms/domain';
import { ARI_PUBLISHER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import { ReservationsModule } from './reservations.module';
import {
  RESERVATIONS_UOW,
  type CategoryRef,
  type RatePlanRef,
  type ReservationsRepository,
} from './reservations.repository';

/** «Свободные места», AV2 (ADR-110): цены «от» по правилу закрытого Q-204. Вымышленный фонд и тарифы. */
const categories: CategoryRef[] = [
  { id: 'room', code: 'ROOM', name: 'Тестовый двухместный', active: true, capacityAdults: 2, capacityChildren: 0, kind: 'PRIVATE_ROOM' },
  { id: 'bed', code: 'BED', name: 'Тестовая общая', active: true, capacityAdults: 1, capacityChildren: 0, kind: 'DORM_BED' },
];
const plans: RatePlanRef[] = [
  { id: 'base', code: 'BASE', name: 'Базовый', currency: 'KZT', active: true, cancellationPenalty: 'NONE' },
  { id: 'promo', code: 'PROMO', name: 'Акция', currency: 'KZT', active: true, cancellationPenalty: 'NONE' },
];
const covers = new Set(['base:room', 'promo:room', 'base:bed']);
const nightly = (occupancy: number, price: number): NightRate[] =>
  ['2026-10-01', '2026-10-02', '2026-10-03'].map((date) => ({
    date,
    occupancy,
    priceMinor: BigInt(price),
  }));
const rates: Record<string, NightRate[]> = {
  'base:room': [...nightly(1, 2_000_000), ...nightly(2, 3_200_000)],
  'promo:room': nightly(2, 2_500_000),
  'base:bed': nightly(1, 800_000),
};
const restrictions: Record<string, StayRestriction[]> = {};

const repo = {
  property: async () => ({ id: 'prop', currency: 'KZT' }),
  today: async () => '2026-09-29',
  activeRatePlans: async () => plans,
  activeCategories: async () => categories,
  ratePlanCoversType: async (plan: string, type: string) => covers.has(`${plan}:${type}`),
  nightRates: async (type: string, plan: string) => rates[`${plan}:${type}`] ?? [],
  restrictionsFor: async (type: string, plan: string) => restrictions[`${plan}:${type}`] ?? [],
} as unknown as ReservationsRepository;

let app: INestApplication;
beforeAll(async () => {
  const m = await Test.createTestingModule({ imports: [ReservationsModule] })
    .overrideProvider(RESERVATIONS_UOW)
    .useValue({ read: <T>(fn: (r: ReservationsRepository) => Promise<T>) => fn(repo) })
    .overrideProvider(PrismaService)
    .useValue({})
    .overrideProvider(CHANNELS_REPOSITORY)
    .useValue({})
    .overrideProvider(ARI_PUBLISHER)
    .useValue({})
    .compile();
  app = m.createNestApplication();
  await app.init();
});
afterAll(() => app?.close());

const get = (q: string) => request(app.getHttpServer()).get(`/availability/offers?${q}`);

describe('GET /availability/offers — производный тариф (DATA_MODEL §20)', () => {
  it('тариф, которому правило продажи запрещает эти даты, в цену «от» не попадает', async () => {
    const original = plans[1]!;
    plans[1] = {
      ...original,
      derivedRule: { discountPercent: 20, minDaysBeforeArrival: null, maxDaysBeforeArrival: null, minNights: 5 },
    };
    try {
      const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=2');
      expect(res.body.byCategory.ROOM).toEqual({
        plans: 1,
        totalMinor: '9600000',
        perNightMinor: '3200000',
        ratePlanCode: 'BASE',
      });
    } finally {
      plans[1] = original;
    }
  });
});

describe('GET /availability/offers — цены «от» (Q-204)', () => {
  it('номер: самый дешёвый допустимый тариф за весь срок, число тарифов, цена ночи', async () => {
    const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nights: 3, guests: 2, currency: 'KZT' });
    expect(res.body.byCategory.ROOM).toEqual({
      plans: 2,
      totalMinor: '7500000',
      perNightMinor: '2500000',
      ratePlanCode: 'PROMO',
    });
  });

  it('койки: итог — на всех гостей запроса (8 000 × 2 × 3 = 48 000), цена ночи — за койку', async () => {
    const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=2');
    expect(res.body.byCategory.BED).toEqual({
      plans: 1,
      totalMinor: '4800000',
      perNightMinor: '800000',
      ratePlanCode: 'BASE',
    });
  });

  it('номер, который не вмещает всех гостей, цены не получает', async () => {
    const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=3');
    expect(res.body.byCategory.ROOM).toBeNull();
    expect(res.body.byCategory.BED).toMatchObject({ totalMinor: '7200000' });
  });

  it('occupancy запроса: для одного гостя берётся цена на одного', async () => {
    const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=1');
    expect(res.body.byCategory.ROOM).toMatchObject({ plans: 1, totalMinor: '6000000', ratePlanCode: 'BASE' });
  });

  it('стоп-продажа по тарифу исключает его из «от»', async () => {
    restrictions['promo:room'] = [
      { date: '2026-10-02', minStay: null, maxStay: null, stopSell: true, closedToArrival: false, closedToDeparture: false },
    ];
    const res = await get('arrival=2026-10-01&departure=2026-10-04&guests=2');
    delete restrictions['promo:room'];
    expect(res.body.byCategory.ROOM).toMatchObject({ plans: 1, totalMinor: '9600000', ratePlanCode: 'BASE' });
  });

  it('неверный запрос — 400, а не общая ошибка', async () => {
    expect((await get('arrival=2026-10-04&departure=2026-10-01&guests=2')).status).toBe(400);
    expect((await get('arrival=2026-10-01&departure=2026-10-04&guests=0')).status).toBe(400);
    expect((await get('arrival=2026-10-01&departure=2027-01-01&guests=1')).status).toBe(400);
  });
});
