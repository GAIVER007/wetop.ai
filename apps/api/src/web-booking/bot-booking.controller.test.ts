import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { ConflictException, type INestApplication } from '@nestjs/common';
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
 * Бронь из чата ИИ-продавца (DATA_MODEL §24, ADR-141) на подделках: узкий ключ записи, котировка из того же расчёта, что у
 * виджета, организация и объект из строки агента, подтверждение создаёт бронь с ключом повтора = id намерения и ожидаемой
 * суммой; повтор не создаёт вторую; устаревшее и изменившаяся цена — отказ и REJECTED. Транзакции и CHECK — integration.
 */
const BOOK_KEY = 'seller-book-key-for-tests-0123456789';
const QUOTE_KEY = 'seller-quote-key-for-tests-0123456789';
const ORG = '44444444-4444-4444-8444-444444444444';
const AGENT = ORG;
const OTHER_AGENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const TODAY = new Date('2026-09-12T06:00:00Z');

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
];
const plan = {
  id: 'p1',
  code: 'legacy-10157482',
  name: 'Базовый тариф',
  currency: 'KZT',
  active: true,
  cancellationPenalty: 'FIRST_NIGHT' as const,
};
const card = (n: string) => ({
  confirmationNumber: n,
  status: 'CONFIRMED',
  arrivalDate: '2026-09-13',
  departureDate: '2026-09-15',
  totalAmountMinor: '3000000',
  currency: 'KZT',
  items: [{ accommodationTypeName: 'Двойная' }],
});
const fakeRepo = {
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
  async categoryAvailability() {
    return 2;
  },
  async nightRates(typeId: string) {
    const price = typeId === 't1' ? 1_100_000n : 1_500_000n;
    return ['2026-09-13', '2026-09-14'].flatMap((date) => [
      { date, occupancy: 1, priceMinor: price },
      { date, occupancy: 2, priceMinor: price },
    ]);
  },
  async card(n: string) {
    return card(n);
  },
};
const uow = {
  run: <T>(fn: (repo: ReservationsRepository) => Promise<T>) =>
    fn(fakeRepo as unknown as ReservationsRepository),
  read: <T>(fn: (repo: ReservationsRepository) => Promise<T>) =>
    fn(fakeRepo as unknown as ReservationsRepository),
};

type Row = Record<string, unknown> & { id: string; state: string; channelMessageId: string | null };
const intents = new Map<string, Row>();
const codeOf: Record<string, string> = { t1: 'category-single', t2: 'category-twin' };
const prisma = {
  db: {
    sellerBookingIntent: {
      async create({ data }: { data: Record<string, unknown> }) {
        const id = randomUUID();
        intents.set(id, {
          ...data,
          id,
          state: 'QUOTED',
          channelMessageId: null,
          reservationId: null,
        });
        return { id };
      },
      async findFirst({ where }: { where: { id: string; agentId: string } }) {
        const r = intents.get(where.id);
        if (!r || r.agentId !== where.agentId) return null;
        return {
          ...r,
          accommodationType: { code: codeOf[r.accommodationTypeId as string] },
          ratePlan: { code: plan.code },
          reservation: r.reservationId ? { confirmationNumber: 'CHAT-1' } : null,
        };
      },
      async updateMany({
        where,
        data,
      }: {
        where: { id: string; state?: string; OR?: unknown };
        data: Record<string, unknown>;
      }) {
        const r = intents.get(where.id);
        if (!r || (where.state && r.state !== where.state)) return { count: 0 };
        if (where.OR && r.channelMessageId !== null && r.channelMessageId !== data.channelMessageId)
          return { count: 0 };
        Object.assign(r, data);
        return { count: 1 };
      },
    },
    reservation: {
      async findFirst() {
        return { id: 'res-1' };
      },
    },
  },
};
const created: Array<Record<string, unknown>> = [];
const reservations = {
  failNext: null as Error | null,
  create: vi.fn(async (dto: Record<string, unknown>) => {
    if (reservations.failNext) {
      const e = reservations.failNext;
      reservations.failNext = null;
      throw e;
    }
    created.push(dto);
    return card('CHAT-1');
  }),
};

describe('бронь из чата продавца /bot/booking-intents (DATA_MODEL §24)', () => {
  let app: INestApplication;
  let sites: FakeAnalyticsRepository;
  beforeAll(async () => {
    process.env.SELLER_BOOK_KEY = BOOK_KEY;
    process.env.SELLER_QUOTE_KEY = QUOTE_KEY;
    process.env.ANONYMIZE_SALT = 'test-salt';
    delete process.env.PII_STORAGE;
    sites = new FakeAnalyticsRepository();
    sites.sitesById.set(SITE.id, {
      ...SITE,
      bookingEnabled: true,
      bookingRatePlan: { id: plan.id, code: plan.code, name: plan.name },
    });
    sites.siteOrganizations.set(SITE.id, ORG);
    sites.agentRows.set(AGENT, {
      id: AGENT,
      organizationId: ORG,
      locationId: 'loc-a',
      propertyId: SITE.propertyId,
      lifecycle: 'active',
      scenario: 'sales',
    });
    const m = await Test.createTestingModule({ imports: [WebBookingModule] })
      .overrideProvider(ANALYTICS_REPOSITORY)
      .useValue(sites)
      .overrideProvider(RESERVATIONS_UOW)
      .useValue(uow)
      .overrideProvider(ReservationsService)
      .useValue(reservations)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ARI_PUBLISHER)
      .useValue({ reservationChanged: async () => {} })
      .overrideProvider(CHANNELS_REPOSITORY)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
    vi.useFakeTimers({ now: TODAY, toFake: ['Date'] });
  });
  afterAll(async () => {
    vi.useRealTimers();
    delete process.env.SELLER_BOOK_KEY;
    delete process.env.SELLER_QUOTE_KEY;
    await app.close();
  });
  beforeEach(() => {
    intents.clear();
    created.length = 0;
    reservations.create.mockClear();
    vi.setSystemTime(TODAY);
    app.get(WebBookingService).resetLimits();
  });

  const post = (path: string, body: object, key: string | null = BOOK_KEY) => {
    let r = request(app.getHttpServer()).post(path).send(body);
    if (key !== null) r = r.set('x-wetop-service-key', key);
    return r;
  };
  const quoteBody = {
    agent: AGENT,
    conversation: 'conv-1',
    channel: 'whatsapp',
    category: 'category-twin',
    arrival: '2026-09-13',
    departure: '2026-09-15',
    adults: 2,
  };
  const guest = { firstName: 'Айгерим', lastName: 'Тестова', phone: '+77011234567' };
  const quote = async () => (await post('/bot/booking-intents', quoteBody).expect(201)).body;

  it('ключи: без ключа 401, ключом котировки 403, ключом записи котировка создана', async () => {
    await post('/bot/booking-intents', quoteBody, null).expect(401);
    await post('/bot/booking-intents', quoteBody, QUOTE_KEY).expect(403);
    await post('/bot/booking-intents/confirm', {}, QUOTE_KEY).expect(403);
    expect(intents.size).toBe(0);
  });

  it('котировка: сумма из расчёта сайта, срок 30 минут, организация, объект и тариф из агента', async () => {
    const q = await quote();
    expect(q).toMatchObject({
      categoryName: 'Двойная',
      nights: 2,
      adults: 2,
      totalMinor: '3000000',
      currency: 'KZT',
      expiresAt: new Date(TODAY.getTime() + 30 * 60_000).toISOString(),
    });
    expect(intents.get(q.intent)).toMatchObject({
      organizationId: ORG,
      propertyId: SITE.propertyId,
      ratePlanId: plan.id,
      accommodationTypeId: 't2',
      totalMinor: 3_000_000n,
      channel: 'whatsapp',
    });
  });

  it.each([
    ['не вмещает', { category: 'category-single' }, 409],
    ['нет категории', { category: 'nope' }, 404],
    ['Telegram — без брони', { channel: 'telegram' }, 400],
    ['чужой агент', { agent: OTHER_AGENT }, 404],
  ])('котировка: %s', async (_n, patch, code) => {
    await post('/bot/booking-intents', { ...quoteBody, ...patch }).expect(code);
    expect(intents.size).toBe(0);
  });

  it('подтверждение: бронь WHATSAPP с ключом повтора и ожидаемой суммой, гость псевдонимом; повтор — та же бронь', async () => {
    const q = await quote();
    const body = { agent: AGENT, intent: q.intent, message: 'msg-consent-0001', guest };
    const r = await post('/bot/booking-intents/confirm', body).expect(200);
    expect(r.body).toMatchObject({
      confirmationNumber: 'CHAT-1',
      totalMinor: '3000000',
      replay: false,
    });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      source: 'WHATSAPP',
      creationKey: q.intent,
      expectedTotalMinor: '3000000',
      arrivalDate: '2026-09-13',
      departureDate: '2026-09-15',
      items: [
        {
          accommodationTypeCode: 'category-twin',
          ratePlanCode: plan.code,
          adults: 2,
          autoAssign: true,
        },
      ],
    });
    expect((created[0]!.guest as { firstName: string }).firstName).toBe('Гость');
    expect(intents.get(q.intent)).toMatchObject({
      state: 'CONFIRMED',
      channelMessageId: 'msg-consent-0001',
    });
    const again = await post('/bot/booking-intents/confirm', body).expect(200);
    expect(again.body).toMatchObject({ confirmationNumber: 'CHAT-1', replay: true });
    expect(created).toHaveLength(1);
  });

  it('устарело через 30 минут: отказ, брони нет, предложение закрыто', async () => {
    const q = await quote();
    vi.setSystemTime(new Date(TODAY.getTime() + 31 * 60_000));
    const r = await post('/bot/booking-intents/confirm', {
      agent: AGENT,
      intent: q.intent,
      message: 'msg-consent-0002',
      guest,
    }).expect(409);
    expect(r.body.message).toContain('новое согласие');
    expect(created).toHaveLength(0);
    expect(intents.get(q.intent)!.state).toBe('REJECTED');
  });

  it('цена изменилась: отказ словами, предложение закрыто, повтор тоже отказ', async () => {
    const q = await quote();
    reservations.failNext = new ConflictException(
      'Стоимость изменилась. Проверьте обновлённый расчёт',
    );
    const body = { agent: AGENT, intent: q.intent, message: 'msg-consent-0003', guest };
    const r = await post('/bot/booking-intents/confirm', body).expect(409);
    expect(r.body.message).toContain('Стоимость изменилась');
    expect(intents.get(q.intent)!.state).toBe('REJECTED');
    await post('/bot/booking-intents/confirm', body).expect(409);
    expect(created).toHaveLength(0);
  });

  it('чужой агент не подтверждает чужое предложение; без телефона — отказ', async () => {
    const q = await quote();
    await post('/bot/booking-intents/confirm', {
      agent: OTHER_AGENT,
      intent: q.intent,
      message: 'msg-consent-0004',
      guest,
    }).expect(404);
    await post('/bot/booking-intents/confirm', {
      agent: AGENT,
      intent: q.intent,
      message: 'msg-consent-0004',
      guest: { ...guest, phone: '123' },
    }).expect(400);
    expect(created).toHaveLength(0);
  });
});
