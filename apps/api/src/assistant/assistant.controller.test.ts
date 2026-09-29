import 'reflect-metadata';
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AssistantController } from './assistant.controller';
import { ExtensionsService } from '../platform/extensions.service';
import { RequesterContextService } from './requester-context.service';
import {
  USER_ERRORS_REPOSITORY,
  type UserErrorRecord,
  type UserErrorsQuery,
  type UserErrorsRepository,
} from './user-errors.repository';

/**
 * `GET /assistant/identity` (ТЗ П1): подпись вошедшего для тега виджета помощника. Настоящий замок
 * `SessionGuard` и подставной вход: автора подписи ставит замок по сессии (`request.user`), а не
 * `currentActor()` — стойка ходит в API заголовком `x-wetop-session`, и для её запросов тот пуст
 * (план `plans/ai-assistant-seller-2026-09-24.md`, расхождение 1).
 */

const SECRET = 'секрет-подписи-для-прогона';
const USER = {
  id: '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11',
  email: 'admin@example.invalid',
  name: 'Айгуль Тестова',
  organizationId: '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00',
  // сотрудник, а не владелец: в подписи роль строчными — `staff` (ADR-083, было пусто по ADR-081 Q-178)
  role: 'STAFF' as const,
  platformAdmin: false,
};

let app: INestApplication;

class FakeUserErrors implements UserErrorsRepository {
  queries: UserErrorsQuery[] = [];
  rows: UserErrorRecord[] = [];
  async record(): Promise<void> {}
  async list(query: UserErrorsQuery): Promise<UserErrorRecord[]> {
    this.queries.push(query);
    return this.rows;
  }
  async deleteBefore(): Promise<number> {
    return 0;
  }
}
const userErrors = new FakeUserErrors();

/** Подставные организации для `GET /assistant/organization` (С5, Q-187) */
const orgCards = new Map<string, unknown>();
const extensions = {
  organizationCard: async (id: string) => orgCards.get(id) ?? null,
};

/** Подставной контекст обратившегося (S4): вызовы запоминаем, чтобы видеть, что ушло на сервер */
const contextCalls: Array<{ userId: string; organizationId: string }> = [];
const contexts = new Map<string, unknown>();
const requesterContext = {
  context: async (userId: string, organizationId: string) => {
    contextCalls.push({ userId, organizationId });
    return contexts.get(`${userId}:${organizationId}`) ?? null;
  },
};

beforeAll(async () => {
  const auth = {
    whoami: vi.fn(async (token: string) =>
      token === 'good-session'
        ? { user: USER, organization: null, expiresAt: '2026-09-25T00:00:00.000Z' }
        : null,
    ),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [AssistantController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: USER_ERRORS_REPOSITORY, useValue: userErrors },
      { provide: ExtensionsService, useValue: extensions },
      { provide: RequesterContextService, useValue: requesterContext },
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app.close();
});

afterEach(() => {
  vi.unstubAllEnvs();
  userErrors.queries = [];
  userErrors.rows = [];
  orgCards.clear();
  contextCalls.length = 0;
  contexts.clear();
});

function decode(token: string) {
  const [body, signature] = token.split('.');
  const raw = Buffer.from(body!, 'base64url');
  return {
    fields: raw.toString('utf8').split('|'),
    valid: createHmac('sha256', SECRET).update(raw).digest('hex') === signature,
  };
}

describe('GET /assistant/identity — подпись вошедшего (ТЗ П1)', () => {
  it('вошедшему отдаёт токен, который сходится с общим секретом и несёт поля сессии', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    const before = Math.floor(Date.now() / 1000);
    const res = await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-session', 'good-session')
      .expect(200);
    const after = Math.floor(Date.now() / 1000);

    const { fields, valid } = decode(res.body.token);
    expect(valid).toBe(true);
    const [userId, email, organizationId, role, issuedAt] = fields;
    expect({ userId, email, organizationId, role }).toEqual({
      userId: USER.id,
      email: USER.email,
      organizationId: USER.organizationId,
      role: 'staff',
    });
    expect(Number(issuedAt)).toBeGreaterThanOrEqual(before);
    expect(Number(issuedAt)).toBeLessThanOrEqual(after);
    expect(res.body.expiresAt).toBe(new Date((Number(issuedAt) + 43_200) * 1000).toISOString());
  });

  it('ответ не кэшируется: в подписи почта человека', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    const res = await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-session', 'good-session')
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('без сессии при включённом замке — 401', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    await request(app.getHttpServer()).get('/assistant/identity').expect(401);
  });

  it('без сессии при выключенном замке — тоже 401: подпись выдаётся только человеку', async () => {
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    const res = await request(app.getHttpServer()).get('/assistant/identity').expect(401);
    expect(res.body.message).toMatch(/вошедш/);
  });

  it('служебный ключ — не человек: подписи нет', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    vi.stubEnv('SERVICE_API_KEY', 'service-key-for-run');
    await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-service-key', 'service-key-for-run')
      .expect(401);
  });

  it('при выключенном замке вошедший тоже получает подпись: автора узнаёт замок и без AUTH_REQUIRED', async () => {
    vi.stubEnv('WIDGET_IDENTITY_SECRET', SECRET);
    const res = await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-session', 'good-session')
      .expect(200);
    expect(decode(res.body.token).fields[0]).toBe(USER.id);
  });

  it('секрет не вписан — 503, а не подпись пустым ключом', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('WIDGET_IDENTITY_SECRET', '');
    const res = await request(app.getHttpServer())
      .get('/assistant/identity')
      .set('x-wetop-session', 'good-session')
      .expect(503);
    expect(JSON.stringify(res.body)).not.toContain(USER.email);
  });
});

/**
 * `GET /assistant/errors` (ТЗ П4): ошибки, которые API отдал человеку (DATA_MODEL §14), — только по ключу помощника
 * `ASSISTANT_READ_KEY` или служебному. Ключ сверяет и сам адрес, не только замок: при выключенном `AUTH_REQUIRED` замок
 * пускает всех, а вошедший человек проходит его сессией — и прочёл бы чужие ошибки, подставив `userId`.
 */
describe('GET /assistant/errors — ошибки человека для помощника (ТЗ П4)', () => {
  const ASSISTANT_KEY = 'assistant-read-key-for-run';
  const USER_ID = USER.id;
  const ORG_ID = USER.organizationId;
  const query = `userId=${USER_ID}&organizationId=${ORG_ID}`;

  function withKeys() {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('ASSISTANT_READ_KEY', ASSISTANT_KEY);
    vi.stubEnv('GUARD_READ_KEY', 'guard-read-key-for-run');
    vi.stubEnv('SERVICE_API_KEY', 'service-key-for-run');
  }

  it('по ключу помощника отдаёт время, раздел, код и текст — новые сверху, как отдало хранилище', async () => {
    withKeys();
    userErrors.rows = [
      {
        at: new Date('2026-09-24T09:12:03.120Z'),
        userId: USER_ID,
        organizationId: ORG_ID,
        method: 'POST',
        route: '/reservations',
        status: 400,
        message: 'adults — целое ≥ 1',
        requestId: '11111111-1111-4111-8111-111111111111',
      },
      {
        at: new Date('2026-09-24T09:10:00.000Z'),
        userId: USER_ID,
        organizationId: ORG_ID,
        method: 'GET',
        route: '/chessboard',
        status: 503,
        message: 'Нет связи с базой',
        requestId: '22222222-2222-4222-8222-222222222222',
      },
    ];
    const res = await request(app.getHttpServer())
      .get(`/assistant/errors?${query}&since=2026-09-24T00:00:00.000Z&limit=5`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    // Обёртка — `items`, а не голый список и не `errors`: бот считает непустое поле `errors` в теле отказом
    // (ТЗ ред. 1, П4; `apps/ai-seller/src/integrations/wetop.py`, `recent_for_user`)
    expect(res.body).toEqual({
      items: [
        { at: '2026-09-24T09:12:03.120Z', section: 'Брони', status: 400, message: 'adults — целое ≥ 1' },
        { at: '2026-09-24T09:10:00.000Z', section: 'Шахматка', status: 503, message: 'Нет связи с базой' },
      ],
    });
    expect(res.body).not.toHaveProperty('errors');
    expect(userErrors.queries).toEqual([
      { userId: USER_ID, organizationId: ORG_ID, since: new Date('2026-09-24T00:00:00.000Z'), limit: 5 },
    ]);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('ошибок не было — пустой `items`, а не пустое тело', async () => {
    withKeys();
    const res = await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('`since` так, как его шлёт бот: Python `isoformat()` с микросекундами и смещением', async () => {
    withKeys();
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}&since=${encodeURIComponent('2026-09-24T09:00:00.123456+00:00')}&limit=5`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    expect(userErrors.queries[0]!.since.toISOString()).toBe('2026-09-24T09:00:00.123Z');
  });

  it('по умолчанию — за сутки и не больше 20 строк; больше 50 не отдаёт', async () => {
    withKeys();
    const before = Date.now();
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}&limit=500`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    const [first, second] = userErrors.queries;
    expect(first!.limit).toBe(20);
    expect(Math.abs(first!.since.getTime() - (before - 86_400_000))).toBeLessThan(5_000);
    expect(second!.limit).toBe(50);
  });

  it('userId и organizationId обязательны и должны быть UUID; since — дата', async () => {
    withKeys();
    for (const bad of [
      `organizationId=${ORG_ID}`,
      `userId=${USER_ID}`,
      `userId=42&organizationId=${ORG_ID}`,
      `${query}&since=вчера`,
      `${query}&limit=много`,
    ]) {
      await request(app.getHttpServer())
        .get(`/assistant/errors?${bad}`)
        .set('x-wetop-service-key', ASSISTANT_KEY)
        .expect(400);
    }
    expect(userErrors.queries).toHaveLength(0);
  });

  it('служебный ключ владельца тоже читает', async () => {
    withKeys();
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', 'service-key-for-run')
      .expect(200);
  });

  it('ключ дежурного агента — 403: ошибки человека не его', async () => {
    withKeys();
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', 'guard-read-key-for-run')
      .expect(403);
    expect(userErrors.queries).toHaveLength(0);
  });

  it('вошедший человек без ключа не читает даже свои ошибки через этот адрес', async () => {
    withKeys();
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-session', 'good-session')
      .expect(403);
    expect(userErrors.queries).toHaveLength(0);
  });

  it('при выключенном замке без ключа — отказ, а не чужие ошибки', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', ASSISTANT_KEY);
    await request(app.getHttpServer()).get(`/assistant/errors?${query}`).expect(401);
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', 'not-the-key')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', ASSISTANT_KEY)
      .expect(200);
    expect(userErrors.queries).toHaveLength(1);
  });

  it('ключ помощника не задан в окружении — адрес закрыт для всех, кроме служебного ключа', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', '');
    await request(app.getHttpServer())
      .get(`/assistant/errors?${query}`)
      .set('x-wetop-service-key', '')
      .expect(401);
    expect(userErrors.queries).toHaveLength(0);
  });
});

describe('GET /assistant/organization — клиент и подписка для техподдержки (С5, Q-187)', () => {
  const CARD = {
    id: USER.organizationId,
    name: 'Гостиница А',
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    aiSeller: { access: 'active', status: 'PAID', activeUntil: '2026-12-31', daysLeft: 97 },
  };
  const ask = (id: string, key?: string) => {
    let r = request(app.getHttpServer()).get('/assistant/organization').query({ id });
    if (key) r = r.set('x-wetop-service-key', key);
    return r;
  };

  it('по узкому ключу помощника: название, статус и срок расширения — без почт и денег', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', 'assistant-key-123');
    orgCards.set(USER.organizationId, CARD);
    const res = await ask(USER.organizationId, 'assistant-key-123').expect(200);
    expect(res.body).toEqual(CARD);
    expect(res.text).not.toContain('@');
  });

  it('без ключа — 401; чужим ключом — 403; кривой id — 400; неизвестная организация — 404', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', 'assistant-key-123');
    vi.stubEnv('GUARD_READ_KEY', 'guard-key-456');
    await ask(USER.organizationId).expect(401);
    await ask(USER.organizationId, 'guard-key-456').expect(403);
    await ask('hotel-a', 'assistant-key-123').expect(400);
    await ask('9f8e7d6c-5b4a-4392-8171-000000000000', 'assistant-key-123').expect(404);
  });
});

describe('GET /assistant/requester-context — кто спрашивает (S4)', () => {
  const USER_ID = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
  const ORG_ID = USER.organizationId;
  const CONTEXT = { role: { code: 'STAFF' }, organization: { name: 'Гостиница А' } };
  const ask = (query: Record<string, string>, key?: string) => {
    let r = request(app.getHttpServer()).get('/assistant/requester-context').query(query);
    if (key) r = r.set('x-wetop-service-key', key);
    return r;
  };

  it('по узкому ключу помощника отдаёт контекст этой пары и ничего больше', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', 'assistant-key-123');
    contexts.set(`${USER_ID}:${ORG_ID}`, CONTEXT);
    const res = await ask({ userId: USER_ID, organizationId: ORG_ID }, 'assistant-key-123').expect(200);
    expect(res.body).toEqual(CONTEXT);
    expect(contextCalls).toEqual([{ userId: USER_ID, organizationId: ORG_ID }]);
  });

  it('без ключа — 401; чужим узким ключом — 403; кривые id — 400; в сервис ничего не уходит', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', 'assistant-key-123');
    vi.stubEnv('GUARD_READ_KEY', 'guard-key-456');
    const ids = { userId: USER_ID, organizationId: ORG_ID };
    await ask(ids).expect(401);
    await ask(ids, 'guard-key-456').expect(403);
    await ask({ userId: 'me', organizationId: ORG_ID }, 'assistant-key-123').expect(400);
    await ask({ userId: USER_ID }, 'assistant-key-123').expect(400);
    expect(contextCalls).toEqual([]);
  });

  it('пара без членства — 404: чужой человек или чужая организация контекста не получают', async () => {
    vi.stubEnv('ASSISTANT_READ_KEY', 'assistant-key-123');
    await ask({ userId: USER_ID, organizationId: ORG_ID }, 'assistant-key-123').expect(404);
  });
});
