import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_REPOSITORY } from '../analytics/analytics.repository';
import { FakeAnalyticsRepository, SITE } from '../analytics/fake-repository';
import { ARI_PUBLISHER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import {
  RESERVATIONS_UOW,
  type ReservationsRepository,
} from '../reservations/reservations.repository';
import { ReservationsService } from '../reservations/reservations.service';
import { WebBookingModule } from './web-booking.module';
import { WebBookingService } from './web-booking.service';

/**
 * Котировка для ИИ-продавца (Q-166 в объёме чтения, ADR-085; план `plans/seller-quotes-2026-09-25.md`):
 * `GET /bot/availability` — узкий ключ `SELLER_QUOTE_KEY` по образцу `ASSISTANT_READ_KEY` (ADR-067, ADR-079),
 * организация в запросе, тот же расчёт и тот же JSON, что у публичного виджета. Домены не проверяются — запрос
 * серверный; публичный `/w/availability` не ослабляется. Брони этой двери нет и не будет (Q-166б — после базы в РК).
 */
const KEY = 'seller-quote-key-for-tests-0123456789';
const ORG = '44444444-4444-4444-8444-444444444444';
const TODAY = new Date('2026-09-12T06:00:00Z'); // 11:00 Алматы

const types = [
  { id: 't1', code: 'category-single', name: 'Одиночная', active: true, capacityAdults: 1, capacityChildren: 0 },
  { id: 't2', code: 'category-twin', name: 'Двойная', active: true, capacityAdults: 2, capacityChildren: 0 },
];
const plan = {
  id: 'p1',
  code: 'legacy-10157482',
  name: 'Базовый тариф',
  currency: 'KZT',
  active: true,
  cancellationPenalty: 'FIRST_NIGHT' as const,
};
const fakeRepo = {
  availability: { t1: 3, t2: 1 } as Record<string, number>,
  // объект этой установки: цены, тарифы и фонд котировки — его (служебный контекст)
  async property() {
    return { id: SITE.propertyId, currency: 'KZT', timezone: 'Asia/Almaty' };
  },
  async activeCategories() {
    return types;
  },
  async ratePlanByCode(code: string) {
    return code === plan.code ? plan : null;
  },
  async ratePlanCoversType() {
    return true;
  },
  async restrictionsFor() {
    return [];
  },
  async categoryAvailability(typeId: string) {
    return fakeRepo.availability[typeId] ?? 0;
  },
  async nightRates(typeId: string) {
    const price = typeId === 't1' ? 1_100_000n : 1_500_000n;
    return ['2026-09-13', '2026-09-14', '2026-09-15'].flatMap((date) => [
      { date, occupancy: 1, priceMinor: price },
      { date, occupancy: 2, priceMinor: price },
    ]);
  },
};
const uow = {
  run: <T>(fn: (repo: ReservationsRepository) => Promise<T>) =>
    fn(fakeRepo as unknown as ReservationsRepository),
  read: <T>(fn: (repo: ReservationsRepository) => Promise<T>) =>
    fn(fakeRepo as unknown as ReservationsRepository),
};

describe('котировка продавца /bot/availability', () => {
  let app: INestApplication;
  let sites: FakeAnalyticsRepository;
  let service: WebBookingService;

  beforeAll(async () => {
    process.env.SELLER_QUOTE_KEY = KEY;
    process.env.ANONYMIZE_SALT = 'test-salt';
    sites = new FakeAnalyticsRepository();
    sites.sitesById.set(SITE.id, {
      ...SITE,
      bookingEnabled: true,
      bookingRatePlan: { id: plan.id, code: plan.code, name: plan.name },
    });
    // сайт принадлежит организации: дверь бота находит его по ней, а не по ключу сайта
    sites.siteOrganizations.set(SITE.id, ORG);
    const m = await Test.createTestingModule({ imports: [WebBookingModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue(sites)
      .overrideProvider(RESERVATIONS_UOW)
      .useValue(uow)
      .overrideProvider(ReservationsService)
      .useValue({})
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ARI_PUBLISHER)
      .useValue({ reservationChanged: async () => {} })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
    service = app.get(WebBookingService);
    // Даты запросов фиксированные — часы тоже: без этого «13.09» назавтра станет «заездом в прошлом»
    vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });
  });

  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.SELLER_QUOTE_KEY;
    await app.close();
  });

  beforeEach(() => {
    service.resetLimits();
  });

  const quote = (query: Record<string, string>, key: string | null = KEY) => {
    let r = request(app.getHttpServer()).get('/bot/availability').query(query);
    if (key !== null) r = r.set('x-wetop-service-key', key);
    return r;
  };
  // имена полей — контракта виджета (`adults`, не `guests`): разбор запроса общий
  const dates = {
    organization: ORG,
    arrival: '2026-09-13',
    departure: '2026-09-15',
    adults: '2',
  };

  // Проверка слияния 26.09 (к В-4, Q-194): котировка считается по объекту этой установки. Сайт другой гостиницы получал
  // бы места и цены Luxx — чужой фонд и чужие цены в ответе её продавца. До мультиобъектной котировки — честный отказ.
  it('сайт другого объекта: отказ, а не цены и места этой установки', async () => {
    const OTHER_ORG = '55555555-5555-4555-8555-555555555555';
    const other = {
      ...SITE,
      id: '66666666-6666-4666-8666-666666666666',
      propertyId: '77777777-7777-4777-8777-777777777777',
      publicKey: 'pms_abcdefabcdef',
      bookingEnabled: true,
      bookingRatePlan: { id: plan.id, code: plan.code, name: plan.name },
    };
    sites.sitesById.set(other.id, other);
    sites.siteOrganizations.set(other.id, OTHER_ORG);
    try {
      const res = await quote({ ...dates, organization: OTHER_ORG });
      expect(res.status).toBe(404);
      expect(res.body.categories).toBeUndefined();
    } finally {
      sites.sitesById.delete(other.id);
      sites.siteOrganizations.delete(other.id);
    }
  });

  it('свой ключ и организация — тот же JSON, что у виджета: категории, места, цена строкой минорных', async () => {
    const res = await quote(dates).expect(200);
    expect(res.body).toMatchObject({
      site: SITE.name,
      arrivalDate: '2026-09-13',
      departureDate: '2026-09-15',
      nights: 2,
      adults: 2,
      currency: 'KZT',
    });
    const double = res.body.categories.find((c: { code: string }) => c.code === 'category-twin');
    expect(double).toMatchObject({ fits: true, available: 1, closed: false, totalMinor: '3000000' });
    // Origin не присылался и не требовался: запрос серверный, дверь держит ключ
  });

  it('без ключа — 401, с чужим — 403; текст не объясняет, какой ключ ждали', async () => {
    await quote(dates, null).expect(401);
    const res = await quote(dates, 'ne-tot-klyuch').expect(403);
    expect(JSON.stringify(res.body)).not.toContain(KEY);
  });

  it('организация не UUID — 400; без сайта с бронированием — 404', async () => {
    await quote({ ...dates, organization: 'ne-uuid' }).expect(400);
    await quote({ ...dates, organization: '55555555-5555-4555-8555-555555555555' }).expect(404);
  });

  it('кривые даты — 400 словами проверки виджета', async () => {
    await quote({ ...dates, arrival: '2026-09-15', departure: '2026-09-13' }).expect(400);
  });

  it('предел частоты на организацию — 429, ключ платформы в ответе не всплывает', async () => {
    for (let i = 0; i < 120; i += 1) await quote(dates).expect(200);
    const res = await quote(dates).expect(429);
    expect(JSON.stringify(res.body)).not.toContain(KEY);
  });

  it('публичный /w/availability не ослаблен: без домена сайта — отказ, как был', async () => {
    await request(app.getHttpServer())
      .get('/w/availability')
      .query({ k: SITE.publicKey, arrival: '2026-09-13', departure: '2026-09-15', guests: '2' })
      .set('Origin', 'http://zloy-sait.local')
      .expect(403);
  });
});
