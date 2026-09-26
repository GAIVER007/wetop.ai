import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StayRestriction } from '@pms/domain';
import { ANALYTICS_REPOSITORY } from '../analytics/analytics.repository';
import { CollectService } from '../analytics/collect.service';
import { FakeAnalyticsRepository, SITE, SITE_PAUSED } from '../analytics/fake-repository';
import { ARI_PUBLISHER } from '../channels/ari-publisher';
import { CHANNELS_REPOSITORY } from '../channels/channels.repository';
import { PrismaService } from '../database/prisma.provider';
import {
  RESERVATIONS_UOW,
  type ReservationsRepository,
} from '../reservations/reservations.repository';
import { ReservationsService } from '../reservations/reservations.service';
import { INCIDENTS_REPOSITORY } from '../guard/incidents.repository';
import { currentOrganizationId } from '../auth/request-context';
import { WebBookingModule } from './web-booking.module';
import { BOOKING_RATE_LIMITS, WebBookingService } from './web-booking.service';

/**
 * Виджет на фальшивках: сайт с включённым бронированием и тарифом, две категории (одиночная 1 место,
 * двойная 2), цены на 13–15.09, одна закрытая ограничением дата у двойной. Бронь уходит в
 * ReservationsService.create — здесь он подменён и только запоминает DTO.
 */
const ORIGIN = 'http://test-site.local';
/** Неисправности (С-7): запоминаем наблюдения, строки не строим — сервис ответ не читает */
const incidents = {
  rows: [] as Array<Record<string, unknown>>,
  async record(o: Record<string, unknown>) {
    incidents.rows.push(o);
    return o as never;
  },
};
const TODAY = new Date('2026-09-12T06:00:00Z'); // 11:00 Алматы
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
/** Первый просмотр демо-страницы тем же посетителем и сессией, что потом бронирует */
const firstPageview = () =>
  JSON.stringify({
    k: SITE.publicKey,
    v: 'visitor-0001',
    s: 'session-0001',
    t: 'pageview',
    u: 'http://test-site.local/',
    r: '',
    w: 1440,
    l: 'ru-RU',
    z: 'Asia/Almaty',
    ti: 'Главная',
  });

const types = [
  {
    id: 't1',
    code: 'exely-900001',
    name: 'Одиночная',
    active: true,
    capacityAdults: 1,
    capacityChildren: 0,
  },
  {
    id: 't2',
    code: 'exely-900002',
    name: 'Двойная',
    active: true,
    capacityAdults: 2,
    capacityChildren: 0,
  },
  {
    id: 't9',
    code: 'exely-900009',
    name: 'Без тарифа',
    active: true,
    capacityAdults: 1,
    capacityChildren: 0,
  },
];
const plan = {
  id: 'p1',
  code: 'exely-10157482',
  name: 'Базовый тариф',
  currency: 'KZT',
  active: true,
  cancellationPenalty: 'FIRST_NIGHT' as const,
};

const fakeRepo = {
  availability: { t1: 3, t2: 0 } as Record<string, number>,
  restrictions: [] as Array<StayRestriction & { typeId: string }>,
  async activeCategories() {
    return types;
  },
  async ratePlanByCode(code: string) {
    return code === plan.code ? plan : null;
  },
  async ratePlanCoversType(_p: string, typeId: string) {
    return typeId !== 't9';
  },
  async restrictionsFor(typeId: string) {
    return fakeRepo.restrictions.filter((r) => r.typeId === typeId);
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
/** От чьего имени шли чтение и бронь (план tenant-isolation-2026-09-26 п. 4) */
const scopes: Array<string | null> = [];
const uow = {
  run: <T>(fn: (repo: ReservationsRepository) => Promise<T>) =>
    fn(fakeRepo as unknown as ReservationsRepository),
  read: <T>(fn: (repo: ReservationsRepository) => Promise<T>) => {
    scopes.push(currentOrganizationId());
    return fn(fakeRepo as unknown as ReservationsRepository);
  },
};

const created = { dtos: [] as unknown[] };
const reservations = {
  create: vi.fn(async (dto: { arrivalDate: string; departureDate: string }) => {
    created.dtos.push(dto);
    scopes.push(currentOrganizationId());
    return {
      confirmationNumber: '20260912-ABC123',
      source: 'WEBSITE',
      channel: null,
      status: 'CONFIRMED',
      arrivalDate: dto.arrivalDate,
      departureDate: dto.departureDate,
      adults: 1,
      children: 0,
      currency: 'KZT',
      totalAmountMinor: '2200000',
      notes: null,
      primaryGuest: null,
      items: [
        {
          id: 'i1',
          accommodationTypeCode: 'exely-900001',
          accommodationTypeName: 'Одиночная',
          arrivalDate: dto.arrivalDate,
          departureDate: dto.departureDate,
          status: 'CONFIRMED',
          priceMinor: '2200000',
          adults: 1,
          children: 0,
          unitCode: '9001',
          guests: [],
        },
      ],
    };
  }),
};

const booking = () => ({
  k: SITE.publicKey,
  arrival: '2026-09-13',
  departure: '2026-09-15',
  category: 'exely-900001',
  adults: 1,
  guest: {
    firstName: 'Айгерим',
    lastName: 'Тестова',
    phone: '+7 701 123 45 67',
    email: 'a@example.com',
  },
  comment: 'после 20:00',
  website: '',
  v: 'visitor-0001',
  s: 'session-0001',
});

describe('виджет бронирования /w/*', () => {
  let app: INestApplication;
  let sites: FakeAnalyticsRepository;
  let service: WebBookingService;
  beforeAll(async () => {
    process.env.ANONYMIZE_SALT = 'test-salt';
    delete process.env.PII_STORAGE;
    sites = new FakeAnalyticsRepository();
    sites.sitesById.set(SITE.id, {
      ...SITE,
      organizationId: 'org-site',
      bookingEnabled: true,
      bookingRatePlan: { id: plan.id, code: plan.code, name: plan.name },
    });
    const m = await Test.createTestingModule({ imports: [WebBookingModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue(sites)
      .overrideProvider(RESERVATIONS_UOW)
      .useValue(uow)
      .overrideProvider(ReservationsService)
      .useValue(reservations)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(ARI_PUBLISHER)
      .useValue({ reservationChanged: async () => {} })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .overrideProvider(INCIDENTS_REPOSITORY)
      .useValue(incidents)
      .compile();
    app = m.createNestApplication();
    await app.init();
    service = app.get(WebBookingService);
    vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });
  });
  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });
  beforeEach(async () => {
    await app.get(CollectService).flush();
    created.dtos = [];
    sites.recorded = [];
    sites.linked = [];
    sites.audits = [];
    sites.bookingsSince = null;
    incidents.rows = [];
    service.resetLimits();
    fakeRepo.restrictions = [];
  });

  const get = (path: string, origin = ORIGIN) =>
    request(app.getHttpServer()).get(path).set('Origin', origin);
  const post = (body: unknown, origin = ORIGIN) =>
    request(app.getHttpServer())
      .post('/w/book')
      .set('Origin', origin)
      .send(body as object);

  it('скрипт виджета и CORS: свой домен получает заголовки, чужой — нет; preflight — 204', async () => {
    const js = await request(app.getHttpServer()).get('/w/widget.js').expect(200);
    expect(js.headers['content-type']).toMatch(/javascript/);
    expect(js.text).toContain('pms-booking');
    const pre = await request(app.getHttpServer())
      .options('/w/book')
      .set('Origin', ORIGIN)
      .expect(204);
    expect(pre.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(pre.headers['access-control-allow-methods']).toContain('POST');
    const foreign = await request(app.getHttpServer())
      .options('/w/book')
      .set('Origin', 'http://evil.local')
      .expect(204);
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('цены и места: категории с тарифом, цена за период, «мест нет», закрытая ограничением, без тарифа не показана', async () => {
    fakeRepo.restrictions = [
      {
        typeId: 't2',
        date: '2026-09-13',
        stopSell: true,
        closedToArrival: false,
        closedToDeparture: false,
        minStay: null,
        maxStay: null,
      },
    ];
    const r = await get(
      `/w/availability?k=${SITE.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`,
    ).expect(200);
    expect(r.body).toMatchObject({
      site: SITE.name,
      nights: 2,
      adults: 1,
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      ratePlan: 'Базовый тариф',
    });
    expect(r.body.categories).toEqual([
      {
        code: 'exely-900001',
        name: 'Одиночная',
        capacity: 1,
        fits: true,
        available: 3,
        closed: false,
        totalMinor: '2200000',
        perNight: [
          { date: '2026-09-13', priceMinor: '1100000' },
          { date: '2026-09-14', priceMinor: '1100000' },
        ],
      },
      {
        code: 'exely-900002',
        name: 'Двойная',
        capacity: 2,
        fits: true,
        available: 0,
        closed: true,
        totalMinor: '3000000',
        perNight: [
          { date: '2026-09-13', priceMinor: '1500000' },
          { date: '2026-09-14', priceMinor: '1500000' },
        ],
      },
    ]);
    expect(r.headers['access-control-allow-origin']).toBe(ORIGIN);
    // двое гостей: одиночная не вмещает
    const two = await get(
      `/w/availability?k=${SITE.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=2`,
    ).expect(200);
    expect(two.body.categories[0]).toMatchObject({ code: 'exely-900001', fits: false });
  });

  it.each([
    [
      'чужой Origin → 403',
      `/w/availability?k=${SITE.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`,
      'http://evil.local',
      403,
    ],
    [
      'неизвестный ключ → 404',
      '/w/availability?k=pms_ffffffffffff&arrival=2026-09-13&departure=2026-09-15&adults=1',
      ORIGIN,
      404,
    ],
    [
      'бронирование выключено → 404',
      `/w/availability?k=${SITE_PAUSED.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`,
      ORIGIN,
      404,
    ],
    [
      'заезд вчера → 400',
      `/w/availability?k=${SITE.publicKey}&arrival=2026-09-11&departure=2026-09-15&adults=1`,
      ORIGIN,
      400,
    ],
  ])('%s', async (_l, path, origin, status) => {
    await get(path, origin).expect(status);
  });

  it('расчёт и бронь идут от имени организации сайта, а не объекта Luxx по имени', async () => {
    scopes.length = 0;
    await post(booking()).expect(201);
    expect(scopes.length).toBeGreaterThan(0);
    expect(new Set(scopes)).toEqual(new Set(['org-site']));
  });

  it('бронь: DTO для ReservationsService — WEBSITE, тариф сайта, autoAssign, псевдоним гостя; сессия связана; журнал', async () => {
    // просмотр страницы уже записан — сессия есть, к ней и привязываемся
    await app.get(CollectService).accept(firstPageview(), { userAgent: CHROME, origin: ORIGIN });
    await app.get(CollectService).flush();
    const r = await post(booking()).expect(201);
    expect(r.body).toEqual({
      confirmationNumber: '20260912-ABC123',
      status: 'CONFIRMED',
      arrivalDate: '2026-09-13',
      departureDate: '2026-09-15',
      nights: 2,
      categoryName: 'Одиночная',
      adults: 1,
      totalMinor: '2200000',
      currency: 'KZT',
      checkInTime: '14:00',
    });
    expect(created.dtos).toHaveLength(1);
    const dto = created.dtos[0] as Record<string, unknown> & {
      guest: Record<string, unknown>;
      items: unknown[];
    };
    expect(dto).toMatchObject({
      source: 'WEBSITE',
      arrivalDate: '2026-09-13',
      departureDate: '2026-09-15',
      notes: `Бронь с сайта «${SITE.name}». Комментарий гостя: после 20:00`,
      items: [
        {
          accommodationTypeCode: 'exely-900001',
          ratePlanCode: 'exely-10157482',
          adults: 1,
          autoAssign: true,
        },
      ],
    });
    // dev-БД: настоящие ФИО не пишутся (ADR-018)
    expect(dto.guest.firstName).toBe('Гость');
    expect(String(dto.guest.lastName)).toMatch(/^Канал-/);
    expect(dto.guest.phone).toMatch(/^\+7000\d{7}$/);
    expect(sites.linked).toEqual([
      { siteId: SITE.id, sessionKey: 'session-0001', confirmationNumber: '20260912-ABC123' },
    ]);
    expect(sites.audits.map((a) => a.action)).toContain('analytics.site.booking');
  });

  it('бронь сразу после первого просмотра: очередь счётчика записана до привязки, источник брони не теряется (гонка 15.09.2026)', async () => {
    // Приёмник пишет события пачкой раз в секунду; посетитель на быстрой сети бронирует раньше — сессии в базе ещё нет.
    // Воспроизведено на изолированном стенде: хит → сразу /w/book → reservation_id пуст, через 2 с — привязан.
    const collect = app.get(CollectService);
    expect(await collect.accept(firstPageview(), { userAgent: CHROME, origin: ORIGIN })).toBe('queued');
    expect(sites.recorded).toHaveLength(0);
    await post(booking()).expect(201);
    expect(sites.recorded.map((h) => h.sessionKey)).toEqual(['session-0001']);
    expect(sites.linked).toEqual([
      { siteId: SITE.id, sessionKey: 'session-0001', confirmationNumber: '20260912-ABC123' },
    ]);
    const audit = sites.audits.find((a) => a.action === 'analytics.site.booking');
    expect(audit?.details).toMatchObject({ linkedSession: true });
  });

  it('honeypot, кривая форма и чужой домен — без брони', async () => {
    await post({ ...booking(), website: 'http://spam' }).expect(400);
    await post({ ...booking(), guest: { firstName: 'A', lastName: 'B', phone: '123' } }).expect(
      400,
    );
    await post(booking(), 'http://evil.local').expect(403);
    expect(created.dtos).toHaveLength(0);
  });

  it('лимит: шестая бронь с одного адреса за час — 429', async () => {
    for (let i = 0; i < 5; i += 1) await post(booking()).expect(201);
    await post(booking()).expect(429);
    expect(created.dtos).toHaveLength(5);
  });

  it('Д3: за туннелем Cloudflare все запросы приходят с 127.0.0.1 — лимит считается по CF-Connecting-IP посетителя', async () => {
    const from = (ip: string) => post(booking()).set('CF-Connecting-IP', ip);
    for (let i = 0; i < 5; i += 1) await from('203.0.113.10').expect(201);
    // другой посетитель в тот же час не получает отказ из-за чужих броней
    await from('198.51.100.7').expect(201);
    // а первый упирается в свой лимит
    await from('203.0.113.10').expect(429);
    // мусор в заголовке не выдаётся за адрес: считается как сам запрос (loopback)
    await post(booking()).set('CF-Connecting-IP', 'not-an-ip').expect(201);
    expect(created.dtos).toHaveLength(7);
  });

  it('С-7: предел броней за час держит журнал, а не память — после «перезапуска» он не обнуляется', async () => {
    // окна в памяти пусты (beforeEach — как после рестарта API), но журнал помнит: предел за час уже выбран
    sites.bookingsSince = BOOKING_RATE_LIMITS.perSitePerHour;
    await post(booking()).expect(429);
    expect(created.dtos).toHaveLength(0);
  });

  it('С-7: упёршийся предел записывает неисправность booking.flood — сторож разбудит; адреса в ней нет', async () => {
    const from = () => post(booking()).set('CF-Connecting-IP', '203.0.113.77');
    for (let i = 0; i < 5; i += 1) await from().expect(201);
    await from().expect(429);
    const flood = incidents.rows.filter((r) => r.kind === 'booking.flood');
    expect(flood.length).toBeGreaterThan(0);
    expect(flood[0]).toMatchObject({ subjectId: SITE.id, fingerprint: `booking.flood:${SITE.id}` });
    // приватность среза 9 (план §4): адрес посетителя никуда не сохраняется — и в неисправность не едет
    expect(JSON.stringify(incidents.rows)).not.toContain('203.0.113.77');
  });

  it('демо-страница: виджет и счётчик по ключу; сайт без бронирования — 404', async () => {
    const r = await request(app.getHttpServer()).get(`/w/demo?k=${SITE.publicKey}`).expect(200);
    expect(r.text).toContain('/w/widget.js');
    expect(r.text).toContain('/a/pms.js');
    expect(r.text).toContain(`data-site="${SITE.publicKey}"`);
    await request(app.getHttpServer()).get(`/w/demo?k=${SITE_PAUSED.publicKey}`).expect(404);
  });
});
