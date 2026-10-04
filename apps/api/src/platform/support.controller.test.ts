import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assistant } from '@pms/integrations';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { FakeAudit, FakeSeller } from '../ai-seller/fakes';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { PLATFORM_ADMIN_ONLY } from './platform.controller';
import { SUPPORT_AUDIT } from './support.audit';
import {
  SUPPORT_CONNECTION,
  type SupportConfig,
  type SupportConnection,
  type SupportPort,
} from './support.connection';
import { SupportController } from './support.controller';
import { SUPPORT_SANDBOX_PER_HOUR } from './support.service';
import { SupportKnowledgeService } from './support-kb.service';
import { SUPPORT_NOT_CONNECTED, SUPPORT_PROMPT_MAX, SupportService } from './support.service';

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3). Настоящие замок и
 * автор запроса, подставной помощник и хранилище организаций. Открыт только главному администратору: владелец
 * организации и служебный ключ не получают ни одного вызова помощника. Адреса и ключа помощника в ответах нет.
 */
const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const CONV = '3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c';
const SERVICE_KEY = 'platform-test-service-key-0123456789';
const PANEL_KEY = 'assistant-panel-key-for-run-0123456789';
const PANEL_URL = 'http://assistant:8000/p0123456789ab';

class FakeSupportConnection implements SupportConnection {
  configured = true;
  bot = new FakeSeller();
  config(): SupportConfig {
    return this.configured
      ? { baseUrl: PANEL_URL, serviceKey: PANEL_KEY }
      : { baseUrl: null, serviceKey: null };
  }
  client(): SupportPort | null {
    return this.configured ? this.bot : null;
  }
}

class FakeOrganizations implements Pick<ExtensionsRepository, 'organization'> {
  asked: string[] = [];
  async organization(id: string): Promise<OrganizationSummary | null> {
    this.asked.push(id);
    return id === ORG
      ? {
          id: ORG,
          name: 'Хостел «Пример»',
          status: 'ACTIVE',
          trialEndsAt: null,
          createdAt: new Date('2026-09-20T00:00:00.000Z'),
          members: 2,
          owners: ['vladelec@example.invalid'],
          aiSeller: null,
        }
      : null;
  }
}

const connection = new FakeSupportConnection();
const organizations = new FakeOrganizations();
let audit = new FakeAudit();
let app: INestApplication;

beforeAll(async () => {
  const users: Record<string, { id: string; role: 'OWNER' | 'STAFF'; platformAdmin: boolean }> = {
    'session-admin': { id: ADMIN, role: 'OWNER', platformAdmin: true },
    'session-owner': { id: OWNER, role: 'OWNER', platformAdmin: false },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? {
            user: {
              ...who,
              organizationId: ORG,
              email: `${who.id.slice(0, 4)}@example.invalid`,
              name: null,
            },
            organization: null,
            expiresAt: '2026-09-26T00:00:00.000Z',
          }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [SupportController],
    providers: [
      SupportService,
      SupportKnowledgeService,
      { provide: SUPPORT_CONNECTION, useValue: connection },
      { provide: EXTENSIONS_REPOSITORY, useValue: organizations },
      { provide: SUPPORT_AUDIT, useFactory: () => audit },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  audit = moduleRef.get(SUPPORT_AUDIT);
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
  connection.configured = true;
  connection.bot = new FakeSeller();
  organizations.asked = [];
  audit.events = [];
});

const api = () => request(app.getHttpServer());
const as = (session: string) => ({ 'x-wetop-session': session });

describe('только главный администратор', () => {
  it('владелец организации получает 403 на всё, помощника не спрашиваем', async () => {
    const owner = as('session-owner');
    // по одному: supertest поднимает сервер на каждый запрос, созданные разом мешают друг другу
    const refused = [
      () => api().get('/platform/support/status').set(owner),
      () => api().get('/platform/support/conversations').set(owner),
      () => api().get(`/platform/support/conversations/${CONV}`).set(owner),
      () => api().post(`/platform/support/conversations/${CONV}/takeover`).set(owner),
      () =>
        api()
          .post(`/platform/support/conversations/${CONV}/reply`)
          .set(owner)
          .send({ text: 'Здравствуйте' }),
      () => api().get('/platform/support/knowledge').set(owner),
      () =>
        api()
          .post('/platform/support/knowledge')
          .set(owner)
          .attach('file', Buffer.from('# Ошибки'), 'ошибки.md'),
      () => api().get('/platform/support/summary').set(owner),
      () => api().get('/platform/support/prompt').set(owner),
      () => api().put('/platform/support/prompt').set(owner).send({ text: 'Новые правила' }),
      () => api().get('/platform/support/settings').set(owner),
      () => api().put('/platform/support/settings/model').set(owner).send({ model: 'б' }),
      () => api().post('/platform/support/sandbox').set(owner).send({ text: 'Привет' }),
    ];
    for (const send of refused) {
      const res = await send().expect(403);
      expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    }
    expect(connection.bot.calls).toEqual([]);
    expect(audit.events).toEqual([]);
  });

  it('служебный ключ раздел не открывает: он не человек и не главный администратор', async () => {
    await api()
      .get('/platform/support/conversations')
      .set('x-wetop-service-key', SERVICE_KEY)
      .expect(403);
    expect(connection.bot.calls).toEqual([]);
  });
});

describe('помощник не подключён', () => {
  it('состояние так и говорит; остальное — 503 словами, без вызова помощника', async () => {
    connection.configured = false;
    const status = await api().get('/platform/support/status').set(as('session-admin')).expect(200);
    expect(status.body).toEqual({ state: 'not-configured' });
    const list = await api()
      .get('/platform/support/conversations')
      .set(as('session-admin'))
      .expect(503);
    expect(list.body.message).toBe(SUPPORT_NOT_CONNECTED);
  });

  it('подключён — «ready», и ни адреса, ни ключа помощника в ответе', async () => {
    const status = await api().get('/platform/support/status').set(as('session-admin')).expect(200);
    expect(status.body).toEqual({ state: 'ready' });
    expect(JSON.stringify(status.body)).not.toContain(PANEL_KEY);
    expect(JSON.stringify(status.body)).not.toContain('assistant:8000');
  });
});

describe('диалоги', () => {
  it('список: отбор уходит помощнику, ответ — в словах стойки', async () => {
    connection.bot.replies.listConversations = {
      items: [
        {
          id: CONV,
          channel: 'widget',
          client_name: 'd***',
          mode: 'needs_human',
          stage: 'new',
          last_activity_at: '2026-09-25T09:00:00+00:00',
          messages: 4,
          has_contact: false,
        },
      ],
    };
    const res = await api()
      .get('/platform/support/conversations?mode=needs_human&limit=20')
      .set(as('session-admin'))
      .expect(200);
    expect(connection.bot.calls).toEqual([
      { op: 'listConversations', args: [{ mode: 'needs_human', limit: 20 }] },
    ]);
    expect(res.body.items[0]).toEqual({
      id: CONV,
      channel: 'widget',
      clientName: 'd***',
      mode: 'needs_human',
      stage: 'new',
      lastActivityAt: '2026-09-25T09:00:00+00:00',
      messages: 4,
      hasContact: false,
    });
    await api()
      .get('/platform/support/conversations?mode=spam')
      .set(as('session-admin'))
      .expect(400);
  });

  it('карточка: кто пишет — почта, организация названием и роль из подписи стойки', async () => {
    connection.bot.replies.conversation = {
      id: CONV,
      mode: 'needs_human',
      stage: 'new',
      // так бот хранит подпись вошедшего (`apps/ai-seller/src/channels/widget_store.py`)
      lead_data: {
        platform_user: {
          user_id: OWNER,
          email: 'dana@example.invalid',
          org_id: ORG.toUpperCase(),
          role: 'staff',
        },
      },
      contact: {
        name: 'dana@example.invalid',
        phone: null,
        email: null,
        channel: 'widget',
        external_id: `platform:${OWNER}`,
      },
      messages: [
        {
          role: 'user',
          text: 'Не открывается шахматка',
          at: '2026-09-25T09:00:00+00:00',
          sent_by_us: false,
        },
      ],
    };
    const res = await api()
      .get(`/platform/support/conversations/${CONV}`)
      .set(as('session-admin'))
      .expect(200);
    expect(res.body.platformUser).toEqual({
      userId: OWNER,
      email: 'dana@example.invalid',
      organizationId: ORG,
      organizationName: 'Хостел «Пример»',
      role: 'staff',
    });
    expect(res.body.messages).toEqual([
      {
        role: 'user',
        text: 'Не открывается шахматка',
        at: '2026-09-25T09:00:00+00:00',
        sentByUs: false,
      },
    ]);
    expect(organizations.asked).toEqual([ORG]);
  });

  it('карточка анонимного посетителя wetop.ai — «кто пишет» пусто, организацию не ищем', async () => {
    connection.bot.replies.conversation = {
      id: CONV,
      mode: 'bot_active',
      stage: 'new',
      lead_data: {},
      contact: {},
      messages: [],
    };
    const res = await api()
      .get(`/platform/support/conversations/${CONV}`)
      .set(as('session-admin'))
      .expect(200);
    expect(res.body.platformUser).toBeNull();
    expect(organizations.asked).toEqual([]);
    await api().get('/platform/support/conversations/не-id').set(as('session-admin')).expect(400);
  });

  it('перехват, ответ, возврат — помощнику и в журнал; текста ответа в журнале нет', async () => {
    connection.bot.replies.takeover = {
      status: 'ok',
      mode: 'owner_takeover',
      previous_mode: 'needs_human',
    };
    const admin = as('session-admin');
    const took = await api()
      .post(`/platform/support/conversations/${CONV}/takeover`)
      .set(admin)
      .expect(200);
    expect(took.body).toEqual({ mode: 'owner_takeover', previousMode: 'needs_human' });
    await api()
      .post(`/platform/support/conversations/${CONV}/reply`)
      .set(admin)
      .send({ text: '  Смотрю  ' })
      .expect(200);
    await api().post(`/platform/support/conversations/${CONV}/release`).set(admin).expect(200);
    await api()
      .post(`/platform/support/conversations/${CONV}/reply`)
      .set(admin)
      .send({ text: ' ' })
      .expect(400);
    expect(connection.bot.calls).toEqual([
      { op: 'takeover', args: [CONV] },
      { op: 'reply', args: [CONV, 'Смотрю'] },
      { op: 'release', args: [CONV] },
    ]);
    expect(audit.events.map((e) => [e.entityType, e.action, e.after])).toEqual([
      [
        'SupportConversation',
        'support.conversation.takeover',
        { mode: 'owner_takeover', previousMode: 'needs_human' },
      ],
      ['SupportConversation', 'support.conversation.reply', { length: 6 }],
      ['SupportConversation', 'support.conversation.release', { mode: null, previousMode: null }],
    ]);
  });
});

describe('знания, сводка и отказы помощника', () => {
  it('знания: список и загрузка файлом; не тот формат — 415 без вызова; загрузка — в журнал', async () => {
    connection.bot.replies.knowledge = {
      items: [{ source: 'ошибки.md', chunks: 3, created_at: '2026-09-25T06:00:00+00:00' }],
    };
    connection.bot.replies.uploadKnowledge = {
      status: 'ok',
      source: 'ошибки.md',
      created: true,
      chunks: 3,
    };
    const admin = as('session-admin');
    const list = await api().get('/platform/support/knowledge').set(admin).expect(200);
    expect(list.body.items).toEqual([
      { source: 'ошибки.md', chunks: 3, createdAt: '2026-09-25T06:00:00+00:00' },
    ]);
    await api()
      .post('/platform/support/knowledge')
      .set(admin)
      .attach('file', Buffer.from('x'), 'вирус.exe')
      .expect(415);
    const up = await api()
      .post('/platform/support/knowledge')
      .set(admin)
      .attach('file', Buffer.from('# Справочник ошибок'), 'ошибки.md')
      .expect(201);
    expect(up.body).toEqual({ source: 'ошибки.md', created: true, chunks: 3 });
    expect(connection.bot.ops()).toEqual(['knowledge', 'uploadKnowledge']);
    expect(audit.events).toEqual([
      {
        entityType: 'SupportKnowledge',
        entityId: 'assistant',
        action: 'support.knowledge.uploaded',
        after: { name: 'ошибки.md', size: 35 },
      },
    ]);
  });

  it('сводка за сутки', async () => {
    connection.bot.replies.summary = {
      hours: 24,
      dialogs: 7,
      replies: 12,
      leads: 0,
      sla_breaches: 1,
    };
    const res = await api().get('/platform/support/summary').set(as('session-admin')).expect(200);
    expect(res.body).toEqual({ hours: 24, dialogs: 7, replies: 12, leads: 0, slaBreaches: 1 });
  });

  it('отказ помощника — его словами и с его именем; недоступен — 503; не нашёл — 404', async () => {
    const admin = as('session-admin');
    connection.bot.failWith = new assistant.BotRejectedError(
      403,
      'Служебному ключу этот маршрут закрыт',
      [],
      assistant.SUPPORT_BOT,
    );
    const closed = await api().get('/platform/support/summary').set(admin).expect(503);
    expect(closed.body.message).toBe('ИИ-помощник: Служебному ключу этот маршрут закрыт');
    connection.bot.failWith = new assistant.BotUnavailableError('ИИ-помощник не ответил вовремя');
    const down = await api().get('/platform/support/conversations').set(admin).expect(503);
    expect(down.body.message).toBe('ИИ-помощник не ответил вовремя');
    connection.bot.failWith = new assistant.BotRejectedError(
      404,
      'диалог не найден',
      [],
      assistant.SUPPORT_BOT,
    );
    await api().get(`/platform/support/conversations/${CONV}`).set(admin).expect(404);
    connection.bot.failWith = new assistant.BotRejectedError(
      422,
      'слишком длинно',
      [],
      assistant.SUPPORT_BOT,
    );
    const bad = await api()
      .post(`/platform/support/conversations/${CONV}/reply`)
      .set(admin)
      .send({ text: 'Да' })
      .expect(422);
    expect(bad.body.message).toBe('ИИ-помощник отклонил: слишком длинно');
  });
});

describe('настройка помощника (ADR-084)', () => {
  it('правила: читать и сохранять; пусто или слишком длинно — 400 без вызова; в журнал — длина, не текст', async () => {
    connection.bot.replies.prompt = { text: 'Ты — помощник WETOP.' };
    connection.bot.replies.putPrompt = { status: 'ok', length: 22 };
    const admin = as('session-admin');
    const read = await api().get('/platform/support/prompt').set(admin).expect(200);
    expect(read.body).toEqual({ text: 'Ты — помощник WETOP.' });
    await api().put('/platform/support/prompt').set(admin).send({ text: '   ' }).expect(400);
    const long = await api()
      .put('/platform/support/prompt')
      .set(admin)
      .send({ text: 'я'.repeat(SUPPORT_PROMPT_MAX + 1) })
      .expect(400);
    expect(long.body.message).toBe(`Правила: не длиннее ${SUPPORT_PROMPT_MAX} знаков`);
    const saved = await api()
      .put('/platform/support/prompt')
      .set(admin)
      .send({ text: '\nТы — помощник WETOP. Отвечай коротко.\n' })
      .expect(200);
    expect(saved.body).toEqual({ length: 37 });
    expect(connection.bot.calls).toEqual([
      { op: 'prompt', args: [] },
      { op: 'putPrompt', args: ['Ты — помощник WETOP. Отвечай коротко.'] },
    ]);
    expect(audit.events).toEqual([
      {
        entityType: 'SupportAssistant',
        entityId: 'assistant',
        action: 'support.prompt.updated',
        after: { length: 37 },
      },
    ]);
  });

  it('модель: список и текущая — без прочих настроек бота; смена — в журнал с прежней', async () => {
    connection.bot.replies.settings = {
      models: ['модель-а', 'модель-б'],
      model: 'модель-а',
      values: { sla_seconds: 900 },
    };
    connection.bot.replies.putModel = { status: 'ok', model: 'модель-б', previous: 'модель-а' };
    const admin = as('session-admin');
    const read = await api().get('/platform/support/settings').set(admin).expect(200);
    expect(read.body).toEqual({ models: ['модель-а', 'модель-б'], model: 'модель-а' });
    await api().put('/platform/support/settings/model').set(admin).send({ model: ' ' }).expect(400);
    const changed = await api()
      .put('/platform/support/settings/model')
      .set(admin)
      .send({ model: 'модель-б' })
      .expect(200);
    expect(changed.body).toEqual({ model: 'модель-б', previous: 'модель-а' });
    expect(audit.events).toEqual([
      {
        entityType: 'SupportAssistant',
        entityId: 'assistant',
        action: 'support.model.changed',
        after: { model: 'модель-б', previous: 'модель-а' },
      },
    ]);
  });

  it('модели не из списка бот отказывает — его словами с именем', async () => {
    connection.bot.failOn.putModel = new assistant.BotRejectedError(
      400,
      'модель не из списка разрешённых',
      [],
      assistant.SUPPORT_BOT,
    );
    const res = await api()
      .put('/platform/support/settings/model')
      .set(as('session-admin'))
      .send({ model: 'чужая' })
      .expect(422);
    expect(res.body.message).toBe('ИИ-помощник отклонил: модель не из списка разрешённых');
    expect(audit.events).toEqual([]);
  });

  it('«Проверка»: у главного администратора свой разговор в песочнице помощника', async () => {
    connection.bot.replies.sandbox = {
      status: 'ok',
      reply: 'Здравствуйте! Чем помочь?',
      needs_human: false,
      reasons: [],
    };
    const res = await api()
      .post('/platform/support/sandbox')
      .set(as('session-admin'))
      .send({ text: ' Привет ' })
      .expect(200);
    expect(res.body).toEqual({
      reply: 'Здравствуйте! Чем помочь?',
      needsHuman: false,
      reasons: [],
    });
    expect(connection.bot.calls).toEqual([
      { op: 'sandbox', args: [{ externalId: `wetop-support-check-${ADMIN}`, text: 'Привет' }] },
    ]);
    await api()
      .post('/platform/support/sandbox')
      .set(as('session-admin'))
      .send({ text: '' })
      .expect(400);
  });
});

describe('очередь техподдержки (S1)', () => {
  const NOW = Date.parse('2026-09-29T10:00:00.000Z');
  const row = (id: string, extra: Record<string, unknown>) => ({
    id,
    channel: 'widget',
    client_name: '—',
    mode: 'bot_active',
    stage: 'new',
    last_activity_at: '2026-09-29T09:50:00+00:00',
    started_at: '2026-09-29T09:40:00+00:00',
    messages: 2,
    has_contact: false,
    last_message: { role: 'assistant', text: 'Откройте «Настройки»', at: '2026-09-29T09:50:00+00:00' },
    waiting_since: null,
    closed: false,
    ...extra,
  });
  const A = '11111111-1111-4111-8111-111111111111';
  const B = '22222222-2222-4222-8222-222222222222';
  const C = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  it('открытые: без пустых, срочные первыми, дольше ждущие раньше; числа очереди из той же выборки', async () => {
    connection.bot.replies.listConversations = {
      items: [
        row(A, {}),
        row(B, {
          waiting_since: '2026-09-29T09:55:00+00:00',
          last_message: { role: 'user', text: 'Алло?', at: '2026-09-29T09:58:00+00:00' },
        }),
        row(C, {
          mode: 'needs_human',
          started_at: '2026-09-27T09:00:00+00:00',
          waiting_since: '2026-09-29T09:57:00+00:00',
          last_message: { role: 'user', text: 'Позовите человека', at: '2026-09-29T09:57:00+00:00' },
        }),
      ],
    };
    const res = await api().get('/platform/support/queue').set(as('session-admin')).expect(200);
    expect(connection.bot.calls).toEqual([
      { op: 'listConversations', args: [{ nonempty: true, closed: false, limit: 200, excludeSandbox: true }] },
    ]);
    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([C, B, A]);
    expect(res.body.items[0]).toMatchObject({
      id: C,
      mode: 'needs_human',
      priority: 'urgent',
      waitingSince: '2026-09-29T09:57:00+00:00',
      lastMessage: { role: 'user', text: 'Позовите человека', at: '2026-09-29T09:57:00+00:00' },
      closed: false,
    });
    expect(res.body.items[1].priority).toBe('waiting');
    expect(res.body.items[2].priority).toBe('normal');
    expect(res.body.counts).toEqual({
      open: 3,
      new: 2,
      waiting: 2,
      needs_human: 1,
      owner_takeover: 0,
      bot_active: 2,
      capped: false,
    });
  });

  afterEach(() => vi.useRealTimers());

  it('отбор очереди — у помощника в SQL, числа — из выборки открытых; чужой отбор — 400 без вызова', async () => {
    connection.bot.replies.listConversations = { items: [] };
    const admin = as('session-admin');
    await api().get('/platform/support/queue?queue=waiting').set(admin).expect(200);
    await api().get('/platform/support/queue?queue=needs_human').set(admin).expect(200);
    await api().get('/platform/support/queue?queue=closed').set(admin).expect(200);
    expect(connection.bot.calls.map((c) => c.args[0])).toEqual([
      { nonempty: true, closed: false, limit: 200, excludeSandbox: true },
      { nonempty: true, closed: false, limit: 100, excludeSandbox: true, queue: 'waiting' },
      { nonempty: true, closed: false, limit: 200, excludeSandbox: true },
      { nonempty: true, closed: false, limit: 100, excludeSandbox: true, mode: 'needs_human' },
      { nonempty: true, closed: false, limit: 200, excludeSandbox: true },
      { nonempty: true, closed: true, limit: 100, excludeSandbox: true },
    ]);
    connection.bot.calls = [];
    await api().get('/platform/support/queue?queue=spam').set(admin).expect(400);
    expect(connection.bot.calls).toEqual([]);
    await api().get('/platform/support/queue').set(as('session-owner')).expect(403);
  });

  it('категория отбирает строки внутри статуса; числа по строкам статуса; чужая даёт 400', async () => {
    connection.bot.replies.listConversations = {
      items: [
        row(A, { first_message: { role: 'user', text: 'Верните деньги за подписку', at: null } }),
        row(B, { first_message: { role: 'user', text: 'Не сохраняется бронь, ошибка', at: null } }),
        row(C, { first_message: null }),
      ],
    };
    const admin = as('session-admin');
    const all = await api().get('/platform/support/queue').set(admin).expect(200);
    expect(all.body.items.map((i: { category: string }) => i.category).sort()).toEqual([
      'error',
      'other',
      'payment',
    ]);
    expect(all.body.categoryCounts).toEqual({
      all: 3,
      platform: 0,
      error: 1,
      payment: 1,
      access: 0,
      other: 1,
    });
    expect(all.body.category).toBe('all');

    const money = await api()
      .get('/platform/support/queue?category=payment')
      .set(admin)
      .expect(200);
    expect(money.body.items.map((i: { id: string }) => i.id)).toEqual([A]);
    // Отбор делает платформа словами, помощнику про категорию знать нечего
    expect(connection.bot.calls.every((c) => !('category' in (c.args[0] as object)))).toBe(true);

    connection.bot.calls = [];
    await api().get('/platform/support/queue?category=деньги').set(admin).expect(400);
    expect(connection.bot.calls).toEqual([]);
  });

  it('закрыть обращение — помощнику и в журнал; карточка говорит, закрыт ли диалог', async () => {
    const admin = as('session-admin');
    await api().post(`/platform/support/conversations/${CONV}/close`).set(admin).expect(200);
    expect(connection.bot.calls).toEqual([{ op: 'close', args: [CONV] }]);
    expect(audit.events.map((e) => [e.entityType, e.action])).toEqual([
      ['SupportConversation', 'support.conversation.close'],
    ]);
    await api().post('/platform/support/conversations/не-id/close').set(admin).expect(400);
    await api()
      .post(`/platform/support/conversations/${CONV}/close`)
      .set(as('session-owner'))
      .expect(403);

    connection.bot.replies.conversation = {
      id: CONV,
      mode: 'bot_active',
      stage: 'new',
      closed: true,
      lead_data: {},
      contact: {},
      messages: [],
    };
    const card = await api().get(`/platform/support/conversations/${CONV}`).set(admin).expect(200);
    expect(card.body.closed).toBe(true);
  });
});

describe('предел песочницы помощника (аудит 30.09.2026)', () => {
  it('не больше SUPPORT_SANDBOX_PER_HOUR в час на администратора, сверх — 429 без хода к помощнику', async () => {
    // 🔴 На коде до правки предела не было: все вызовы отвечали 200
    connection.bot.replies.sandbox = { status: 'ok', reply: 'Да', needs_human: false, reasons: [] };
    let ok = 0;
    let tooOften = false;
    for (let i = 0; i <= SUPPORT_SANDBOX_PER_HOUR; i += 1) {
      const res = await api().post('/platform/support/sandbox').set(as('session-admin')).send({ text: 'Привет' });
      if (res.status === 429) {
        tooOften = true;
        break;
      }
      expect(res.status).toBe(200);
      ok += 1;
    }
    expect(tooOften).toBe(true);
    expect(ok).toBeGreaterThan(0);
    expect(connection.bot.calls.filter((c) => c.op === 'sandbox')).toHaveLength(ok);
  });
});
