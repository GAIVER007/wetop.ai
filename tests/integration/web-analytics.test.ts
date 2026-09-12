import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import {
  PrismaAnalyticsRepository,
  type StoredHit,
} from '../../apps/api/src/analytics/analytics.repository';
import { AnalyticsService } from '../../apps/api/src/analytics/analytics.service';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Срез 8, шаг 8.2: сессии, просмотры и события на живой dev-БД. Три сессии из плана §11 (без HTTP):
 * A: два просмотра подряд; A через 31 минуту с utm instagram; B с телефона из google + событие search.
 * Сайт вымышленный, создаётся и удаляется тестом (каскадом уходят и сессии).
 */
describe.skipIf(!url)('web analytics repository (integration)', () => {
  let db: Db;
  let repo: PrismaAnalyticsRepository;
  let service: AnalyticsService;
  let siteId: string;
  const key = `pms_${'e2e'.padEnd(12, '0')}`; // pms_e2e000000000

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaAnalyticsRepository({ db } as never);
    service = new AnalyticsService(repo);
    await db.trackedSite.deleteMany({ where: { publicKey: key } });
    const site = await repo.createSite({
      name: 'ИНТЕГРАЦИОННЫЙ ТЕСТ',
      hosts: ['test-site.local'],
      publicKey: key,
    });
    siteId = site.id;
  });
  afterAll(async () => {
    if (siteId) await repo.deleteSite(siteId);
    await db.$disconnect();
  });

  const t0 = new Date('2026-09-12T05:00:00Z');
  const at = (sec: number) => new Date(t0.getTime() + sec * 1000);
  const base = (over: Partial<StoredHit>): StoredHit => ({
    siteId,
    at: t0,
    type: 'pageview',
    visitorKey: 'visitor-A',
    sessionKey: 'sess-1',
    path: '/',
    title: 'Главная',
    source: {
      kind: 'DIRECT',
      source: null,
      medium: null,
      campaign: null,
      content: null,
      term: null,
      referrerHost: null,
      landingPath: '/',
    },
    device: { device: 'DESKTOP', browser: 'Chrome', os: 'macOS' },
    language: 'ru-RU',
    eventName: null,
    props: null,
    ...over,
  });

  // пулер в Сингапуре: до четырёх запросов на событие, десять событий — десятки секунд
  it(
    'десять событий → три сессии с верными счётчиками, временем, источником и устройством',
    { timeout: 90_000 },
    async () => {
      await repo.record([
        base({}),
        base({ at: at(15), type: 'ping' }),
        base({ at: at(30), path: '/rooms', title: 'Номера' }),
        base({ at: at(40), type: 'leave' }),
        // та же вкладка, 31 минута спустя — счётчик выдал новый ключ сессии
        base({
          at: at(31 * 60),
          sessionKey: 'sess-2',
          path: '/',
          source: {
            kind: 'SOCIAL',
            source: 'instagram',
            medium: 'social',
            campaign: null,
            content: null,
            term: null,
            referrerHost: 'l.instagram.com',
            landingPath: '/',
          },
        }),
        base({ at: at(31 * 60 + 5), sessionKey: 'sess-2', type: 'leave' }),
        base({
          at: at(3600),
          visitorKey: 'visitor-B',
          sessionKey: 'sess-3',
          source: {
            kind: 'SEARCH',
            source: 'google',
            medium: null,
            campaign: null,
            content: null,
            term: null,
            referrerHost: 'google.com',
            landingPath: '/',
          },
          device: { device: 'MOBILE', browser: 'Chrome', os: 'Android' },
        }),
        base({
          at: at(3600 + 20),
          visitorKey: 'visitor-B',
          sessionKey: 'sess-3',
          type: 'event',
          eventName: 'search',
          props: { arrival: '2026-10-01', departure: '2026-10-03', adults: 2 },
        }),
        base({ at: at(3600 + 30), visitorKey: 'visitor-B', sessionKey: 'sess-3', type: 'leave' }),
        // ping без сессии (первый просмотр потерялся) — молча пропускается
        base({ at: at(5000), visitorKey: 'visitor-C', sessionKey: 'sess-ghost', type: 'ping' }),
      ]);

      const sessions = await db.webSession.findMany({
        where: { siteId },
        orderBy: { startedAt: 'asc' },
        select: {
          sessionKey: true,
          visitorKey: true,
          pageviews: true,
          durationSeconds: true,
          sourceKind: true,
          source: true,
          device: true,
          landingPath: true,
          referrerHost: true,
        },
      });
      expect(sessions).toEqual([
        {
          sessionKey: 'sess-1',
          visitorKey: 'visitor-A',
          pageviews: 2,
          durationSeconds: 40,
          sourceKind: 'DIRECT',
          source: null,
          device: 'DESKTOP',
          landingPath: '/',
          referrerHost: null,
        },
        {
          sessionKey: 'sess-2',
          visitorKey: 'visitor-A',
          pageviews: 1,
          durationSeconds: 5,
          sourceKind: 'SOCIAL',
          source: 'instagram',
          device: 'DESKTOP',
          landingPath: '/',
          referrerHost: 'l.instagram.com',
        },
        {
          sessionKey: 'sess-3',
          visitorKey: 'visitor-B',
          pageviews: 1,
          durationSeconds: 30,
          sourceKind: 'SEARCH',
          source: 'google',
          device: 'MOBILE',
          landingPath: '/',
          referrerHost: 'google.com',
        },
      ]);
      expect(await db.webPageview.count({ where: { session: { siteId } } })).toBe(4);
      expect(await db.webEvent.count({ where: { session: { siteId } } })).toBe(1);
    },
  );

  it(
    'отчёт сервиса за 12.09 по Алматы — контрольные числа гейта',
    { timeout: 30_000 },
    async () => {
      const r = await service.report(siteId, '2026-09-12', '2026-09-12');
      expect(r.summary).toEqual({
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
      expect(r.sources.map((s) => `${s.kind}/${s.source}`)).toEqual([
        'DIRECT/null',
        'SEARCH/google',
        'SOCIAL/instagram',
      ]);
      expect(r.pages).toEqual([
        { path: '/', views: 3, share: 0.75 },
        { path: '/rooms', views: 1, share: 0.25 },
      ]);
      expect(r.demand).toEqual([{ arrival: '2026-10-01', searches: 1 }]);
      // соседний день — пусто: границы периода в поясе объекта
      const empty = await service.report(siteId, '2026-09-13', '2026-09-13');
      expect(empty.summary.sessions).toBe(0);
    },
  );

  it('статус счётчика: последнее событие и сегодняшние сессии', { timeout: 30_000 }, async () => {
    const status = await repo.status(siteId, new Date('2026-09-11T19:00:00Z'));
    expect(status).toEqual({
      lastEventAt: new Date('2026-09-12T06:00:30Z'),
      sessionsToday: 3,
      pageviewsToday: 4,
    });
  });
});
