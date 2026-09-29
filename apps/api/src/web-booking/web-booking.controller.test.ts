import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
    code: 'category-single',
    name: 'Одиночная',
    active: true,
    capacityAdults: 1,
    capacityChildren: 0,
  },
  {
    id: 't2',
    code: 'category-twin',
    name: 'Двойная',
    active: true,
    capacityAdults: 2,
    capacityChildren: 0,
  },
  {
    id: 't9',
    code: 'legacy-900009',
    name: 'Без тарифа',
    active: true,
    capacityAdults: 1,
    capacityChildren: 0,
  },
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
  /** Объект, которым заняты цены и брони в служебном контексте (объект Luxx по имени) */
  async property() {
    return { id: SITE.propertyId, currency: 'KZT' };
  },
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
const createBooking = async (dto: { arrivalDate: string; departureDate: string }) => {
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
        accommodationTypeCode: 'category-single',
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
};
const reservations = { create: vi.fn(createBooking) };

const booking = () => ({
  k: SITE.publicKey,
  arrival: '2026-09-13',
  departure: '2026-09-15',
  category: 'category-single',
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
        code: 'category-single',
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
        code: 'category-twin',
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
    expect(two.body.categories[0]).toMatchObject({ code: 'category-single', fits: false });
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
          accommodationTypeCode: 'category-single',
          ratePlanCode: 'legacy-10157482',
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
    expect(await collect.accept(firstPageview(), { userAgent: CHROME, origin: ORIGIN })).toBe(
      'queued',
    );
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

  // Аудит 26.09, В-4 (Q-194, ADR-095): публичные пути брали цены, тариф и фонд объекта Luxx по имени, а не объекта
  // сайта. Сайт второй гостиницы показывал цены Luxx и заводил брони с данными её гостей в фонде Luxx.
  it('сайт другого объекта: ни цен, ни брони в чужом фонде — понятный отказ', async () => {
    const foreign = {
      ...SITE,
      id: '33333333-3333-4333-8333-333333333333',
      propertyId: '44444444-4444-4444-8444-444444444444',
      publicKey: 'pms_f0f0f0f0f0f0',
      bookingEnabled: true,
      bookingRatePlan: { id: plan.id, code: plan.code, name: plan.name },
    };
    sites.sitesById.set(foreign.id, foreign);
    try {
      const quote = await get(
        `/w/availability?k=${foreign.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`,
      );
      expect(quote.status).toBe(404);
      expect(quote.body.message).toMatch(/не подключено/);
      await post({ ...booking(), k: foreign.publicKey }).expect(404);
      expect(created.dtos).toHaveLength(0);
    } finally {
      sites.sitesById.delete(foreign.id);
    }
  });

  // Аудит 26.09, С-35: лимит сайта (30 броней в час) считал попытки, а не брони — тридцать запросов с несуществующей
  // категорией с шести адресов глушили бронирование с сайта на час.
  it('неудачные попытки не расходуют лимит сайта', async () => {
    reservations.create.mockImplementation(async () => {
      throw new NotFoundException('категория не найдена');
    });
    try {
      for (let i = 0; i < 30; i += 1) {
        await request(app.getHttpServer())
          .post('/w/book')
          .set('Origin', ORIGIN)
          .set('cf-connecting-ip', `198.51.100.${i}`)
          .send(booking())
          .expect(404);
      }
    } finally {
      reservations.create.mockImplementation(createBooking);
    }
    await post(booking()).expect(201);
  });

  // Проверка исправлений 26.09: предел сайта проверялся до записи брони, а засчитывался после — параллельные запросы с
  // разных адресов все проходили проверку, и сайт принимал больше броней в час, чем позволено
  it('одновременные брони с разных адресов не выходят за предел сайта в час', async () => {
    reservations.create.mockImplementation(
      async (dto: { arrivalDate: string; departureDate: string }) => {
        await new Promise((ok) => setTimeout(ok, 20));
        return createBooking(dto);
      },
    );
    try {
      const host = new URL(ORIGIN).hostname;
      const results = await Promise.allSettled(
        Array.from({ length: 40 }, (_, i) =>
          service.book(booking(), { originHost: host, ownHost: null, ip: `198.51.100.${i}` }),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled').length).toBeLessThanOrEqual(30);
    } finally {
      reservations.create.mockImplementation(createBooking);
    }
  });

  // Аудит 26.09, С-33: после записи брони шли привязка сессии и журнал без защиты. Их сбой отдавал гостю ошибку, кнопка
  // снова была активна, и повтор создавал вторую настоящую бронь.
  it('сбой после записи брони не превращается в ошибку для гостя', async () => {
    const link = sites.linkSessionReservation;
    sites.linkSessionReservation = async () => {
      throw new Error('база занята');
    };
    try {
      const res = await post(booking()).expect(201);
      expect(res.body.confirmationNumber).toBe('20260912-ABC123');
      expect(created.dtos).toHaveLength(1);
    } finally {
      sites.linkSessionReservation = link;
    }
  });

  // Аудит 26.09, С-36: цены с сайта — около 30 обращений к базе на запрос, ключ публичен, лимита не было
  it('цены: больше 60 запросов в минуту с одного адреса — 429', async () => {
    const quote = () =>
      request(app.getHttpServer())
        .get(`/w/availability?k=${SITE.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`)
        .set('Origin', ORIGIN)
        .set('cf-connecting-ip', '203.0.113.50');
    for (let i = 0; i < 60; i += 1) await quote().expect(200);
    await quote().expect(429);
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
  /**
   * BOOK-SEC1 (аудит 29.09.2026, ADR-126): публичный `POST /w/book` создаёт подтверждённую бронь, а `Origin` вне браузера
   * подделывается. Перед бронью проверяется токен Cloudflare Turnstile — на сервере, до занятия лимита сайта; любая
   * неопределённость — отказ. Поиск цен идёт без проверки. Cloudflare в тестах подделан (глобальный `fetch`).
   */
  describe('Turnstile перед бронью (BOOK-SEC1)', () => {
    const CF_OK = {
      success: true,
      hostname: 'test-site.local',
      action: 'booking',
      'error-codes': [],
    };
    const cloudflare = (impl: (body: URLSearchParams) => unknown) => {
      const fake = vi.fn(async (_url: string, init?: RequestInit) => {
        const out = impl(new URLSearchParams(String(init?.body)));
        if (out instanceof Error) throw out;
        return new Response(JSON.stringify(out), { status: 200 });
      });
      vi.stubGlobal('fetch', fake);
      return fake;
    };
    const withToken = (token?: string) => ({
      ...booking(),
      ...(token ? { turnstileToken: token } : {}),
    });

    beforeEach(() => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-not-real');
      vi.stubEnv('TURNSTILE_SITE_KEY', 'site-key-not-real');
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    it('секрет не задан — проверки нет, бронь как раньше, Cloudflare не спрашивается', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', '');
      const fake = cloudflare(() => new Error('не должен вызываться'));
      await post(booking()).expect(201);
      expect(created.dtos).toHaveLength(1);
      expect(fake).not.toHaveBeenCalled();
    });

    it('проверка включена, токена нет — 400, брони нет, Cloudflare не спрашивается', async () => {
      const fake = cloudflare(() => CF_OK);
      const r = await post(withToken()).expect(400);
      expect(r.body.message).toMatch(/не робот/);
      expect(created.dtos).toHaveLength(0);
      expect(fake).not.toHaveBeenCalled();
    });

    it('верный токен — бронь создана; у Cloudflare спрошен секрет и токен', async () => {
      const fake = cloudflare(() => CF_OK);
      await post(withToken('tok-ok')).expect(201);
      expect(created.dtos).toHaveLength(1);
      expect(fake).toHaveBeenCalledOnce();
      const [url, init] = fake.mock.calls[0]!;
      expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
      const sent = Object.fromEntries(new URLSearchParams(String(init?.body)));
      expect(sent).toMatchObject({ secret: 'secret-not-real', response: 'tok-ok' });
    });

    it('неверный и устаревший токен — 403, брони нет', async () => {
      cloudflare(() => ({ success: false, 'error-codes': ['invalid-input-response'] }));
      const bad = await post(withToken('tok-bad')).expect(403);
      expect(bad.body.message).toMatch(/не пройдена/);
      cloudflare(() => ({ success: false, 'error-codes': ['timeout-or-duplicate'] }));
      const old = await post(withToken('tok-old')).expect(403);
      expect(old.body.message).toMatch(/устарела/);
      expect(created.dtos).toHaveLength(0);
    });

    it('Cloudflare недоступен — 503 и брони нет (fail-closed), в ответе подробностей нет', async () => {
      cloudflare(() => new Error('ECONNREFUSED challenges.cloudflare.com'));
      const r = await post(withToken('tok-1')).expect(503);
      expect(r.text).not.toMatch(/ECONNREFUSED|cloudflare/i);
      expect(created.dtos).toHaveLength(0);
    });

    it('токен одноразовый: повтор того же токена — отказ, вторая бронь не создаётся', async () => {
      const used = new Set<string>();
      cloudflare((body) => {
        const token = body.get('response') ?? '';
        if (used.has(token)) return { success: false, 'error-codes': ['timeout-or-duplicate'] };
        used.add(token);
        return CF_OK;
      });
      await post(withToken('tok-once')).expect(201);
      await post(withToken('tok-once')).expect(403);
      expect(created.dtos).toHaveLength(1);
    });

    it('токен решён на чужой странице (другой хост в ответе Cloudflare) — 403', async () => {
      cloudflare(() => ({ ...CF_OK, hostname: 'evil.example' }));
      await post(withToken('tok-evil')).expect(403);
      expect(created.dtos).toHaveLength(0);
    });

    it('мусорный запрос отклоняется до Cloudflare: квота проверки не тратится', async () => {
      const fake = cloudflare(() => CF_OK);
      await post({ ...withToken('tok-1'), arrival: 'не дата' }).expect(400);
      expect(fake).not.toHaveBeenCalled();
      expect(created.dtos).toHaveLength(0);
    });

    it('отказ проверки не тратит лимит брони: после трёх неудач верная попытка проходит', async () => {
      let call = 0;
      cloudflare(() =>
        ++call <= 3 ? { success: false, 'error-codes': ['invalid-input-response'] } : CF_OK,
      );
      for (let i = 0; i < 3; i += 1) await post(withToken(`tok-${i}`)).expect(403);
      await post(withToken('tok-4')).expect(201);
      expect(created.dtos).toHaveLength(1);
    });

    it('поиск цен и мест идёт без проверки', async () => {
      const fake = cloudflare(() => new Error('не должен вызываться'));
      await get(
        `/w/availability?k=${SITE.publicKey}&arrival=2026-09-13&departure=2026-09-15&adults=1`,
      ).expect(200);
      expect(fake).not.toHaveBeenCalled();
    });

    it('GET /w/config: включено — публичный ключ без секрета; выключено — null', async () => {
      const on = await request(app.getHttpServer()).get('/w/config').expect(200);
      expect(on.body).toEqual({ turnstileSiteKey: 'site-key-not-real' });
      expect(on.text).not.toContain('secret-not-real');
      expect(on.headers['cache-control']).toMatch(/public/);
      vi.stubEnv('TURNSTILE_SECRET_KEY', '');
      const off = await request(app.getHttpServer()).get('/w/config').expect(200);
      expect(off.body).toEqual({ turnstileSiteKey: null });
    });

    it('скрипт виджета знает про проверку: берёт ключ из /w/config, шлёт токен и не содержит ключей', async () => {
      const js = await request(app.getHttpServer()).get('/w/widget.js').expect(200);
      expect(js.text).toContain('/w/config');
      expect(js.text).toContain('turnstileToken');
      expect(js.text).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
      expect(js.text).not.toContain('site-key-not-real');
      expect(js.text).not.toContain('secret-not-real');
    });
  });
});
