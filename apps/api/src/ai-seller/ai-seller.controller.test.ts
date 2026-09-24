import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SellerFactsSource } from '@pms/domain';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { AiSellerController } from './ai-seller.controller';
import {
  FakeAudit,
  FakeConnection,
  FakeFacts,
  FakeProfiles,
  rejected,
  unavailable,
} from './fakes';
import { SELLER_CONNECTION, type SellerConfig } from './seller.connection';
import { SELLER_AUDIT, SELLER_FACTS, SELLER_PROFILES } from './seller.repository';
import { SellerService } from './seller.service';

/**
 * Раздел «ИИ-продавец» в API (ТЗ ред. 1 П5, П7, П8; ADR-075). Настоящие замок и автор запроса, подставные продавец
 * и хранилища. Копия продавца привязана к одной организации (`SELLER_ORGANIZATION_ID`): вошедший из другой
 * организации не видит ни диалогов, ни знаний, ни песочницы.
 */

const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const USER_A = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const USER_B = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const CONV = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
const KEY = 'seller-service-key-for-run-0123456789';

const baseConfig = (): SellerConfig => ({
  baseUrl: 'http://seller:8000/panel-x',
  serviceKey: KEY,
  organizationId: ORG_A,
  publicUrl: 'https://seller.example.invalid',
  syncEnabled: true,
});

const factsSource = (): SellerFactsSource => ({
  property: {
    name: 'Тестовый хостел',
    address: 'Алматы, ул. Вымышленная, 1',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
    checkInTime: '14:00',
    checkOutTime: '12:00',
  },
  categories: [
    { code: 'DBL', name: 'Двухместная', kind: 'PRIVATE_ROOM', capacityAdults: 2, units: 4 },
  ],
  ratePlan: { code: 'BASE', name: 'Базовый тариф' },
  rates: [{ categoryCode: 'DBL', date: '2026-09-25', occupancy: 2, priceMinor: 1_500_000n }],
  window: { from: '2026-09-24', to: '2026-11-22' },
});

const profile = {
  botName: 'Айгерим',
  addressForm: 'INFORMAL',
  useEmoji: false,
  replyLength: 'SHORT',
  languages: ['ru', 'en'],
  greeting: 'Привет!',
  includedInPrice: 'Бельё и Wi-Fi.',
  paidExtras: '',
  houseRules: 'Тишина с 23:00.',
  prohibitions: '',
  handoffRules: '',
  faq: [],
};

const connection = new FakeConnection(baseConfig());
const profiles = new FakeProfiles();
const facts = new FakeFacts();
const audit = new FakeAudit();
let app: INestApplication;

beforeAll(async () => {
  const users: Record<string, { id: string; organizationId: string }> = {
    'session-a': { id: USER_A, organizationId: ORG_A },
    'session-b': { id: USER_B, organizationId: ORG_B },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? {
            user: { ...who, email: `${who.id.slice(0, 4)}@example.invalid`, name: null },
            organization: null,
            expiresAt: '2026-09-25T00:00:00.000Z',
          }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [AiSellerController],
    providers: [
      SellerService,
      { provide: SELLER_CONNECTION, useValue: connection },
      { provide: SELLER_PROFILES, useValue: profiles },
      { provide: SELLER_FACTS, useValue: facts },
      { provide: SELLER_AUDIT, useValue: audit },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  connection.settings = baseConfig();
  connection.seller.calls = [];
  connection.seller.failWith = null;
  connection.seller.replies = {};
  profiles.rows.clear();
  profiles.audits = [];
  facts.source = factsSource();
  facts.asked = [];
  audit.events = [];
});

const as = (session: string) => ({ 'x-wetop-session': session });
const api = () => request(app.getHttpServer());

describe('состояние раздела', () => {
  it('без адреса и ключа продавца — «не подключён»', async () => {
    connection.settings = { ...baseConfig(), baseUrl: null, serviceKey: null };
    const res = await api().get('/ai-seller/status').set(as('session-a')).expect(200);
    expect(res.body.state).toBe('not-configured');
  });

  it('вошедший из другой организации — «не подключён для вашей организации»', async () => {
    const res = await api().get('/ai-seller/status').set(as('session-b')).expect(200);
    expect(res.body.state).toBe('other-organization');
  });

  it('своя организация: профиль не сохранён и не применён', async () => {
    const res = await api().get('/ai-seller/status').set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({
      state: 'ready',
      profile: { saved: false, applied: false },
      facts: { applied: false },
      lastError: null,
    });
  });

  it('ни адреса, ни ключа продавца в ответе нет', async () => {
    const res = await api().get('/ai-seller/status').set(as('session-a')).expect(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('seller:8000');
  });
});

describe('профиль (П5)', () => {
  it('без сохранённого — умолчание и признак «не сохранён»', async () => {
    const res = await api().get('/ai-seller/profile').set(as('session-a')).expect(200);
    expect(res.body.saved).toBe(false);
    expect(res.body.profile.languages).toEqual(['ru']);
  });

  it('неверные поля — 400 со всеми причинами, ничего не сохранено', async () => {
    const res = await api()
      .put('/ai-seller/profile')
      .set(as('session-a'))
      .send({ ...profile, addressForm: 'x', languages: [] })
      .expect(400);
    expect(res.body.message).toContain('Обращение');
    expect(res.body.message).toContain('Языки');
    expect(profiles.rows.size).toBe(0);
  });

  it('сохраняет свою организацию с автором; журнал знает, что было и что стало', async () => {
    await api().put('/ai-seller/profile').set(as('session-a')).send(profile).expect(200);
    const row = profiles.rows.get(ORG_A)!;
    expect(row).toMatchObject({ addressForm: 'INFORMAL', updatedBy: USER_A });
    expect(profiles.audits).toHaveLength(1);
    const res = await api().get('/ai-seller/profile').set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({ saved: true, profile: { botName: 'Айгерим' } });
  });

  it('другая организация сохраняет свой профиль, а не чужой', async () => {
    await api().put('/ai-seller/profile').set(as('session-b')).send(profile).expect(200);
    expect([...profiles.rows.keys()]).toEqual([ORG_B]);
  });
});

describe('«Применить» (П8)', () => {
  it('без сохранённого профиля — 409', async () => {
    await api().post('/ai-seller/apply').set(as('session-a')).expect(409);
    expect(connection.seller.ops()).toEqual([]);
  });

  it('отправляет продавцу профиль полями и факты объекта; помечает доставленное', async () => {
    await api().put('/ai-seller/profile').set(as('session-a')).send(profile).expect(200);
    const res = await api().post('/ai-seller/apply').set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({ profileApplied: true, factsApplied: true });
    expect(connection.seller.ops()).toEqual(['putProfile', 'putFacts']);
    const [profileCall, factsCall] = connection.seller.calls;
    expect(profileCall!.args[0]).toMatchObject({ address_form: 'informal', bot_name: 'Айгерим' });
    expect(factsCall!.args[0]).toMatchObject({
      source: 'platform:facts',
      prices: [{ category_code: 'DBL', price_text: '15 000 ₸' }],
    });
    const row = profiles.rows.get(ORG_A)!;
    expect(row.profileAppliedAt?.getTime()).toBe(row.updatedAt.getTime());
    expect(row.factsHash).toMatch(/^[0-9a-f]{64}$/);
    const status = await api().get('/ai-seller/status').set(as('session-a')).expect(200);
    expect(status.body).toMatchObject({ profile: { applied: true }, facts: { applied: true } });
  });

  it('продавец недоступен — 503 со словами, профиль сохранён, ошибка запомнена для повтора', async () => {
    await api().put('/ai-seller/profile').set(as('session-a')).send(profile).expect(200);
    connection.seller.failWith = unavailable();
    const res = await api().post('/ai-seller/apply').set(as('session-a')).expect(503);
    expect(res.body.message).toMatch(/недоступен/);
    const row = profiles.rows.get(ORG_A)!;
    expect(row.lastError).toMatch(/недоступен/);
    expect(row.profileAppliedAt).toBeNull();
  });

  it('продавец отклонил поле — 422 с его причиной', async () => {
    await api().put('/ai-seller/profile').set(as('session-a')).send(profile).expect(200);
    connection.seller.failWith = rejected(422, 'в поле найдены инструкции для модели');
    const res = await api().post('/ai-seller/apply').set(as('session-a')).expect(422);
    expect(res.body.message).toBe('ИИ-продавец отклонил: в поле найдены инструкции для модели');
  });

  it('другая организация применить не может', async () => {
    await api().put('/ai-seller/profile').set(as('session-b')).send(profile).expect(200);
    await api().post('/ai-seller/apply').set(as('session-b')).expect(403);
    expect(connection.seller.ops()).toEqual([]);
  });

  it('продавец не подключён — 503 и ни одного вызова', async () => {
    connection.settings = { ...baseConfig(), baseUrl: null };
    await api().put('/ai-seller/profile').set(as('session-a')).send(profile).expect(200);
    const res = await api().post('/ai-seller/apply').set(as('session-a')).expect(503);
    expect(res.body.message).toMatch(/не подключён/);
  });
});

describe('данные объекта для продавца', () => {
  it('отдаёт ровно те факты, что уйдут продавцу, и отпечаток', async () => {
    const res = await api().get('/ai-seller/facts').set(as('session-a')).expect(200);
    expect(res.body.facts).toMatchObject({
      property: { name: 'Тестовый хостел', check_in_time: '14:00' },
      rate_plan: { code: 'BASE' },
    });
    expect(res.body.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.applied).toBe(false);
    expect(facts.asked[0]?.organizationId).toBe(ORG_A);
  });

  it('объекта у организации нет — 404', async () => {
    facts.source = null;
    await api().get('/ai-seller/facts').set(as('session-a')).expect(404);
  });
});

describe('диалоги, знания, сводка, песочница (П7)', () => {
  it('список диалогов: режим и предел уходят продавцу, ответ — в словах стойки', async () => {
    connection.seller.replies.listConversations = {
      items: [
        {
          id: CONV,
          channel: 'widget',
          client_name: 'А***',
          mode: 'needs_human',
          stage: 'qualifying',
          last_activity_at: '2026-09-24T09:00:00+00:00',
          messages: 4,
          has_contact: true,
        },
      ],
    };
    const res = await api()
      .get('/ai-seller/conversations?mode=needs_human&limit=30')
      .set(as('session-a'))
      .expect(200);
    expect(connection.seller.calls[0]).toEqual({
      op: 'listConversations',
      args: [{ mode: 'needs_human', limit: 30 }],
    });
    expect(res.body).toEqual({
      items: [
        {
          id: CONV,
          channel: 'widget',
          clientName: 'А***',
          mode: 'needs_human',
          stage: 'qualifying',
          lastActivityAt: '2026-09-24T09:00:00+00:00',
          messages: 4,
          hasContact: true,
        },
      ],
    });
  });

  it('неизвестный режим — 400, продавец не спрошен', async () => {
    await api().get('/ai-seller/conversations?mode=all').set(as('session-a')).expect(400);
    expect(connection.seller.ops()).toEqual([]);
  });

  it('карточка — по UUID; не UUID — 400; нет у продавца — 404', async () => {
    connection.seller.replies.conversation = {
      id: CONV,
      mode: 'bot_active',
      stage: 'new',
      lead_data: { dates: '1–3 окт' },
      contact: { name: 'Гость Тестов', phone: null, email: null, channel: 'widget', external_id: 'x' },
      messages: [{ role: 'user', text: 'Есть места?', at: '2026-09-24T09:00:00+00:00', sent_by_us: false }],
    };
    const res = await api().get(`/ai-seller/conversations/${CONV}`).set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({
      id: CONV,
      mode: 'bot_active',
      contact: { name: 'Гость Тестов', channel: 'widget' },
      messages: [{ role: 'user', text: 'Есть места?', sentByUs: false }],
    });
    await api().get('/ai-seller/conversations/abc').set(as('session-a')).expect(400);
    connection.seller.failWith = rejected(404, 'диалог не найден');
    await api().get(`/ai-seller/conversations/${CONV}`).set(as('session-a')).expect(404);
  });

  it('перехват, возврат и ответ идут продавцу; журнал платформы знает, кто, — без текста ответа', async () => {
    await api().post(`/ai-seller/conversations/${CONV}/takeover`).set(as('session-a')).expect(200);
    await api().post(`/ai-seller/conversations/${CONV}/release`).set(as('session-a')).expect(200);
    await api()
      .post(`/ai-seller/conversations/${CONV}/reply`)
      .set(as('session-a'))
      .send({ text: 'Здравствуйте, места есть' })
      .expect(200);
    expect(connection.seller.ops()).toEqual(['takeover', 'release', 'reply']);
    expect(connection.seller.calls[2]!.args).toEqual([CONV, 'Здравствуйте, места есть']);
    expect(audit.events.map((e) => e.action)).toEqual([
      'seller.conversation.takeover',
      'seller.conversation.release',
      'seller.conversation.reply',
    ]);
    expect(JSON.stringify(audit.events)).not.toContain('места есть');
  });

  it('пустой или слишком длинный ответ — 400', async () => {
    await api()
      .post(`/ai-seller/conversations/${CONV}/reply`)
      .set(as('session-a'))
      .send({ text: '   ' })
      .expect(400);
    await api()
      .post(`/ai-seller/conversations/${CONV}/reply`)
      .set(as('session-a'))
      .send({ text: 'я'.repeat(4001) })
      .expect(400);
    expect(connection.seller.ops()).toEqual([]);
  });

  it('знания: список и загрузка документа; чужой формат — 415', async () => {
    connection.seller.replies.knowledge = {
      items: [{ source: 'прайс.md', chunks: 3, created_at: '2026-09-24T09:00:00+00:00' }],
    };
    const list = await api().get('/ai-seller/knowledge').set(as('session-a')).expect(200);
    expect(list.body).toEqual({
      items: [{ source: 'прайс.md', chunks: 3, createdAt: '2026-09-24T09:00:00+00:00' }],
    });
    connection.seller.replies.uploadKnowledge = { status: 'ok', source: 'правила.md', created: true, chunks: 2 };
    const up = await api()
      .post('/ai-seller/knowledge')
      .set(as('session-a'))
      .attach('file', Buffer.from('# Правила'), { filename: 'правила.md', contentType: 'text/markdown' })
      .expect(201);
    expect(up.body).toEqual({ source: 'правила.md', created: true, chunks: 2 });
    const uploaded = connection.seller.calls.find((c) => c.op === 'uploadKnowledge')!;
    expect((uploaded.args[0] as { name: string }).name).toBe('правила.md');
    expect(audit.events.at(-1)).toMatchObject({ action: 'seller.knowledge.uploaded' });
    await api()
      .post('/ai-seller/knowledge')
      .set(as('session-a'))
      .attach('file', Buffer.from('MZ'), { filename: 'setup.exe', contentType: 'application/octet-stream' })
      .expect(415);
  });

  it('сводка и песочница', async () => {
    connection.seller.replies.summary = { hours: 24, dialogs: 5, replies: 12, leads: 2, sla_breaches: 0 };
    const summary = await api().get('/ai-seller/summary').set(as('session-a')).expect(200);
    expect(summary.body).toEqual({ hours: 24, dialogs: 5, replies: 12, leads: 2, slaBreaches: 0 });

    connection.seller.replies.sandbox = {
      status: 'ok',
      reply: 'Привет! Места есть.',
      needs_human: false,
      edits: [],
      reasons: [],
      conversation_id: CONV,
    };
    const res = await api()
      .post('/ai-seller/sandbox')
      .set(as('session-a'))
      .send({ text: 'Есть места на выходные?' })
      .expect(200);
    expect(res.body).toEqual({ reply: 'Привет! Места есть.', needsHuman: false, reasons: [] });
    const call = connection.seller.calls.find((c) => c.op === 'sandbox')!;
    expect(call.args[0]).toEqual({ externalId: `wetop-check-${USER_A}`, text: 'Есть места на выходные?' });
  });

  it('другая организация — 403 на всё, продавец не спрошен', async () => {
    for (const [method, path] of [
      ['get', '/ai-seller/conversations'],
      ['get', `/ai-seller/conversations/${CONV}`],
      ['post', `/ai-seller/conversations/${CONV}/takeover`],
      ['get', '/ai-seller/knowledge'],
      ['get', '/ai-seller/summary'],
      ['post', '/ai-seller/sandbox'],
    ] as const) {
      await api()[method](path).set(as('session-b')).send({ text: 'x' }).expect(403);
    }
    expect(connection.seller.ops()).toEqual([]);
  });

  it('продавец недоступен — 503 со словами, а не 500', async () => {
    connection.seller.failWith = unavailable();
    const res = await api().get('/ai-seller/conversations').set(as('session-a')).expect(503);
    expect(res.body.message).toMatch(/недоступен/);
  });
});

describe('код для сайта объекта', () => {
  it('тег чата продавца по публичному адресу, без подписи и без ключей', async () => {
    const res = await api().get('/ai-seller/embed').set(as('session-a')).expect(200);
    expect(res.body).toEqual({
      snippet: '<script async src="https://seller.example.invalid/widget/widget.js"></script>',
    });
  });

  it('публичного адреса нет — кода нет', async () => {
    connection.settings = { ...baseConfig(), publicUrl: null };
    const res = await api().get('/ai-seller/embed').set(as('session-a')).expect(200);
    expect(res.body).toEqual({ snippet: null });
  });
});
