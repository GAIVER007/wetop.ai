import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { AnalyticsModule } from './analytics.module';
import { ANALYTICS_REPOSITORY } from './analytics.repository';
import { FakeAnalyticsRepository, SITE } from './fake-repository';

describe('сайты и отчёты /analytics', () => {
  let app: INestApplication;
  let repo: FakeAnalyticsRepository;
  beforeAll(async () => {
    repo = new FakeAnalyticsRepository();
    repo.seedGate(); // контрольные числа гейта среза 8 (план §11)
    const m = await Test.createTestingModule({ imports: [AnalyticsModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue(repo)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('создание сайта: ключ pms_ + 12 hex, домены нормализованы, код для вставки содержит ключ', async () => {
    const r = await request(app.getHttpServer())
      .post('/analytics/sites')
      .send({ name: 'Сайт хостела', hosts: ['WWW.Luxx-Aparts.KZ', ' luxx-aparts.kz '] })
      .expect(201);
    expect(r.body.site.publicKey).toMatch(/^pms_[0-9a-f]{12}$/);
    expect(r.body.site.hosts).toEqual(['luxx-aparts.kz']);
    expect(r.body.snippet.code).toContain(`data-site="${r.body.site.publicKey}"`);
    expect(r.body.snippet.code).toContain('/a/pms.js');
    expect(repo.audits.map((a) => a.action)).toContain('analytics.site.create');
  });

  it.each([
    ['без имени', { name: '', hosts: ['a.kz'] }],
    ['без доменов', { name: 'x', hosts: [] }],
    ['домен с пробелом внутри', { name: 'x', hosts: ['bad host.kz'] }],
    ['домен со схемой', { name: 'x', hosts: ['https://a.kz/'] }],
  ])('отказ 400: %s', async (_l, body) => {
    await request(app.getHttpServer()).post('/analytics/sites').send(body).expect(400);
  });

  it('список сайтов и карточка со статусом счётчика', async () => {
    const list = await request(app.getHttpServer()).get('/analytics/sites').expect(200);
    expect(list.body.map((s: { publicKey: string }) => s.publicKey)).toContain(SITE.publicKey);
    const card = await request(app.getHttpServer()).get(`/analytics/sites/${SITE.id}`).expect(200);
    expect(card.body.site.name).toBe(SITE.name);
    expect(card.body.status).toEqual({
      lastEventAt: '2026-09-12T18:59:30.000Z',
      sessionsToday: 3,
      pageviewsToday: 4,
    });
    expect(card.body.snippet.key).toBe(SITE.publicKey);
    expect(card.body.snippet.demoUrl).toBe(`http://127.0.0.1:3001/a/demo?k=${SITE.publicKey}`);
    await request(app.getHttpServer())
      .get('/analytics/sites/00000000-0000-4000-8000-000000000000')
      .expect(404);
  });

  it('отчёт за период — контрольные числа гейта', async () => {
    const r = await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2026-09-11&to=2026-09-13`)
      .expect(200);
    expect(r.body.period).toEqual({
      from: '2026-09-11',
      to: '2026-09-13',
      timezone: 'Asia/Almaty',
    });
    expect(r.body.summary).toEqual({
      sessions: 3,
      visitors: 2,
      pageviews: 4,
      pagesPerSession: 1.33,
      avgDurationSeconds: 25,
      mobileSessions: 1,
      mobileShare: 0.33,
      bounces: 1,
      bounceRate: 0.33,
      bookings: 0,
    });
    expect(r.body.daily).toHaveLength(3);
    expect(r.body.daily[1]).toEqual({
      date: '2026-09-12',
      sessions: 3,
      visitors: 2,
      pageviews: 4,
      mobile: 1,
    });
    expect(
      r.body.sources.map((s: { kind: string; source: string | null }) => `${s.kind}/${s.source}`),
    ).toEqual(['DIRECT/null', 'SEARCH/google', 'SOCIAL/instagram']);
    expect(r.body.pages).toEqual([
      { path: '/', views: 3, share: 0.75 },
      { path: '/rooms', views: 1, share: 0.25 },
    ]);
    expect(r.body.demand).toEqual([{ arrival: '2026-10-01', searches: 1 }]);
    expect(r.body.events).toEqual([
      { name: 'phone_click', count: 2, sessions: 2 },
      { name: 'search', count: 1, sessions: 1 },
    ]);
    expect(r.body.devices.devices).toEqual([
      { key: 'DESKTOP', sessions: 2, share: 0.67 },
      { key: 'MOBILE', sessions: 1, share: 0.33 },
    ]);
    expect(r.body.devices.browsers).toEqual([{ key: 'Chrome', sessions: 3, share: 1 }]);
    expect(r.body.devices.os.map((o: { key: string }) => o.key)).toEqual(['macOS', 'Android']);
    // репозиторий спрошен за полуинтервал в UTC по поясу объекта
    expect(repo.lastRange).toEqual({
      startUtc: '2026-09-10T19:00:00.000Z',
      endUtcExclusive: '2026-09-13T19:00:00.000Z',
    });
    // WEB4: воронка по сессиям периода, брони с сайта — за тот же полуинтервал
    expect(r.body.funnel).toEqual({
      visits: 3,
      searches: 1,
      started: 0,
      booked: 0,
      conversion: 0,
    });
    expect(r.body.siteReservations).toEqual({ count: 0, cancelled: 0, noShow: 0, charged: [] });
    expect(repo.lastReservationsRange).toEqual(repo.lastRange);
  });

  it('брони с сайта в отчёте: число, отменённые, начислено по счетам (WEB4, Q-212)', async () => {
    repo.reservationRows = [
      {
        status: 'CONFIRMED',
        currency: 'KZT',
        charges: [{ amountMinor: 45_000_00n, voided: false }],
      },
      {
        status: 'CANCELLED',
        currency: 'KZT',
        charges: [
          { amountMinor: 20_000_00n, voided: true },
          { amountMinor: 10_000_00n, voided: false },
        ],
      },
    ];
    const r = await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2026-09-11&to=2026-09-13`)
      .expect(200);
    expect(r.body.siteReservations).toEqual({
      count: 2,
      cancelled: 1,
      noShow: 0,
      charged: [{ currency: 'KZT', chargedMinor: '5500000' }],
    });
  });

  it('без дат — текущий месяц по поясу объекта; кривые даты — 400', async () => {
    const r = await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report`)
      .expect(200);
    expect(r.body.period.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(r.body.period.to >= r.body.period.from).toBe(true);
    await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2026-13-01&to=2026-09-30`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2026-09-30&to=2026-09-01`)
      .expect(400);
  });

  /**
   * Предел периода отчёта (§7.3 плана wetop-domain). Данные счётчика живут 13 месяцев
   * (`npm run analytics:retention`), а отчёт брал любой период: «с 2020 по 2030» тянет из базы
   * всё и строит разбивку на тысячи дней. Предел — те же 400 дней, что и хранение.
   */
  it('период длиннее предела — 400 с внятным текстом, ровно по пределу — считается', async () => {
    const tooLong = await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2020-01-01&to=2030-12-31`)
      .expect(400);
    expect(String(tooLong.body.message)).toContain('400');
    await request(app.getHttpServer())
      .get(`/analytics/sites/${SITE.id}/report?from=2026-01-01&to=2027-02-04`)
      .expect(200);
  });

  it('бронирование с сайта: включение подставляет тариф по умолчанию, код виджета содержит ключ', async () => {
    const on = await request(app.getHttpServer())
      .patch(`/analytics/sites/${SITE.id}`)
      .send({ bookingEnabled: true })
      .expect(200);
    expect(on.body.site.bookingEnabled).toBe(true);
    expect(on.body.site.bookingRatePlan).toMatchObject({
      code: 'rate-base',
      name: 'Базовый тариф',
    });
    expect(on.body.snippet.bookingCode).toContain('/w/widget.js');
    expect(on.body.snippet.bookingCode).toContain(`data-site="${SITE.publicKey}"`);
    expect(on.body.snippet.bookingCode).toContain('<div id="pms-booking"></div>');
    expect(on.body.snippet.bookingDemoUrl).toBe(`http://127.0.0.1:3001/w/demo?k=${SITE.publicKey}`);
    await request(app.getHttpServer())
      .patch(`/analytics/sites/${SITE.id}`)
      .send({ bookingRatePlanCode: 'rate-disabled' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/analytics/sites/${SITE.id}`)
      .send({ bookingEnabled: 'yes' })
      .expect(400);
    const off = await request(app.getHttpServer())
      .patch(`/analytics/sites/${SITE.id}`)
      .send({ bookingEnabled: false })
      .expect(200);
    expect(off.body.site.bookingEnabled).toBe(false);
  });

  it('правка и удаление сайта попадают в журнал', async () => {
    const created = await request(app.getHttpServer())
      .post('/analytics/sites')
      .send({ name: 'Лендинг', hosts: ['promo.luxx-aparts.kz'] })
      .expect(201);
    const id = created.body.site.id;
    const patched = await request(app.getHttpServer())
      .patch(`/analytics/sites/${id}`)
      .send({ status: 'PAUSED', hosts: ['promo.luxx-aparts.kz', 'promo2.kz'] })
      .expect(200);
    expect(patched.body.site).toMatchObject({
      status: 'PAUSED',
      hosts: ['promo.luxx-aparts.kz', 'promo2.kz'],
    });
    await request(app.getHttpServer()).delete(`/analytics/sites/${id}`).expect(200);
    await request(app.getHttpServer()).get(`/analytics/sites/${id}`).expect(404);
    expect(repo.audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(['analytics.site.update', 'analytics.site.delete']),
    );
  });
});
