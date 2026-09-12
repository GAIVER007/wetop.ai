import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.provider';
import { AnalyticsModule } from './analytics.module';
import { ANALYTICS_REPOSITORY } from './analytics.repository';
import { CollectService } from './collect.service';
import { FakeAnalyticsRepository, SITE, SITE_PAUSED } from './fake-repository';

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const hit = (over: Record<string, unknown> = {}) => ({
  k: SITE.publicKey,
  v: 'visitor-0001',
  s: 'session-0001',
  t: 'pageview',
  u: 'http://test-site.local/rooms?utm_source=instagram&utm_medium=social',
  r: 'https://l.instagram.com/',
  w: 1440,
  l: 'ru-RU',
  z: 'Asia/Almaty',
  ti: 'Номера',
  ...over,
});

describe('приёмник счётчика POST /a/hit и скрипт GET /a/pms.js', () => {
  let app: INestApplication;
  let repo: FakeAnalyticsRepository;
  let collect: CollectService;
  beforeAll(async () => {
    repo = new FakeAnalyticsRepository();
    const m = await Test.createTestingModule({ imports: [AnalyticsModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue(repo)
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
    collect = app.get(CollectService);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    repo.recorded = [];
    collect.resetLimits();
  });

  const post = (body: unknown, headers: Record<string, string> = {}) =>
    request(app.getHttpServer())
      .post('/a/hit')
      .set('Origin', 'http://test-site.local')
      .set('User-Agent', MAC_CHROME)
      .set('Content-Type', 'text/plain')
      .set(headers)
      .send(typeof body === 'string' ? body : JSON.stringify(body));

  it('скрипт отдаётся как JavaScript с кэшем на час и знает адрес приёмника', async () => {
    const r = await request(app.getHttpServer()).get('/a/pms.js').expect(200);
    expect(r.headers['content-type']).toMatch(/javascript/);
    expect(r.headers['cache-control']).toBe('public, max-age=3600');
    expect(r.text).toContain('data-site');
    expect(r.text).toContain("'hit'");
    expect(r.text).toContain('sendBeacon');
  });

  it('pageview text/plain со своего домена: 204, после сброса очереди — запись с источником и устройством', async () => {
    await post(hit()).expect(204);
    expect(repo.recorded).toHaveLength(0); // очередь, не синхронная запись
    await collect.flush();
    expect(repo.recorded).toHaveLength(1);
    expect(repo.recorded[0]).toMatchObject({
      siteId: SITE.id,
      type: 'pageview',
      visitorKey: 'visitor-0001',
      sessionKey: 'session-0001',
      path: '/rooms',
      title: 'Номера',
      language: 'ru-RU',
      // источник нормализован (instagram), хост реферера — как пришёл
      source: {
        kind: 'SOCIAL',
        source: 'instagram',
        medium: 'social',
        referrerHost: 'l.instagram.com',
      },
      device: { device: 'DESKTOP', browser: 'Chrome', os: 'macOS' },
    });
  });

  it('тело application/json тоже принимается; реферер с Referer-заголовком без Origin проходит', async () => {
    await request(app.getHttpServer())
      .post('/a/hit')
      .set('Referer', 'http://www.test-site.local/')
      .set('User-Agent', ANDROID)
      .send(hit({ u: 'http://test-site.local/', r: '' }))
      .expect(204);
    await collect.flush();
    expect(repo.recorded).toHaveLength(1);
    expect(repo.recorded[0]).toMatchObject({
      source: { kind: 'DIRECT' },
      device: { device: 'MOBILE', os: 'Android' },
    });
  });

  it('событие search: имя и параметры из allow-list, лишнее выброшено', async () => {
    await post(
      hit({
        t: 'event',
        n: 'search',
        p: { arrival: '2026-10-01', departure: '2026-10-03', adults: 2, email: 'x@y.z' },
      }),
    ).expect(204);
    await collect.flush();
    expect(repo.recorded[0]).toMatchObject({
      type: 'event',
      eventName: 'search',
      props: { arrival: '2026-10-01', departure: '2026-10-03', adults: 2 },
    });
  });

  it.each([
    ['чужой Origin', hit(), { Origin: 'http://evil.local' }],
    ['без Origin и Referer', hit(), { Origin: '', Referer: '' }],
    ['неизвестный ключ', hit({ k: 'pms_ffffffffffff' }), {}],
    ['сайт на паузе', hit({ k: SITE_PAUSED.publicKey }), {}],
    ['бот', hit(), { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }],
    ['не JSON', 'oops', {}],
    ['чужое имя события', hit({ t: 'event', n: 'purchase' }), {}],
  ])('%s → 204 без записи (спамеру ничего не подсказываем)', async (_l, body, headers) => {
    await post(body, headers).expect(204);
    await collect.flush();
    expect(repo.recorded).toHaveLength(0);
  });

  it('тело больше 4 КБ отбрасывается', async () => {
    await post(hit({ ti: 'T'.repeat(5000) })).expect(204);
    await collect.flush();
    expect(repo.recorded).toHaveLength(0);
  });

  it('лимит 60 событий в минуту на посетителя: 61-е не записывается', async () => {
    for (let i = 0; i < 61; i += 1) await post(hit({ t: 'ping' })).expect(204);
    await collect.flush();
    expect(repo.recorded).toHaveLength(60);
  });

  it('демо-страница: HTML со счётчиком по ключу, 404 на чужой ключ; событие с собственного хоста API проходит', async () => {
    const r = await request(app.getHttpServer()).get(`/a/demo?k=${SITE.publicKey}`).expect(200);
    expect(r.headers['content-type']).toMatch(/text\/html/);
    expect(r.text).toContain(`data-site="${SITE.publicKey}"`);
    expect(r.text).toContain(SITE.name);
    expect(r.text).toContain("pms('event', 'phone_click')");
    await request(app.getHttpServer()).get('/a/demo?k=pms_ffffffffffff').expect(404);
    await request(app.getHttpServer()).get('/a/demo').expect(404);
    // страница живёт на адресе API: Origin = Host, домена сайта в Origin нет — принимаем как свой
    await request(app.getHttpServer())
      .post('/a/hit')
      .set('Host', '127.0.0.1:3001')
      .set('Origin', 'http://127.0.0.1:3001')
      .set('User-Agent', MAC_CHROME)
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(hit({ u: 'http://127.0.0.1:3001/a/demo?k=' + SITE.publicKey, r: '' })))
      .expect(204);
    await collect.flush();
    expect(repo.recorded).toHaveLength(1);
    expect(repo.recorded[0]).toMatchObject({ path: '/a/demo', source: { kind: 'DIRECT' } });
  });

  it('accept отвечает причиной отказа — для журнала и тестов', async () => {
    expect(
      await collect.accept(hit(), { userAgent: MAC_CHROME, origin: 'http://test-site.local' }),
    ).toBe('queued');
    expect(
      await collect.accept(hit(), { userAgent: MAC_CHROME, origin: 'http://evil.local' }),
    ).toBe('rejected:origin');
    expect(
      await collect.accept(
        { k: 'zzz' },
        { userAgent: MAC_CHROME, origin: 'http://test-site.local' },
      ),
    ).toBe('rejected:bad site key');
  });
});
