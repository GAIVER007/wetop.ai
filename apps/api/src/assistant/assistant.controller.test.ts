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
      role: '',
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
    expect(res.body).toEqual([
      { at: '2026-09-24T09:12:03.120Z', section: 'Брони', status: 400, message: 'adults — целое ≥ 1' },
      { at: '2026-09-24T09:10:00.000Z', section: 'Шахматка', status: 503, message: 'Нет связи с базой' },
    ]);
    expect(userErrors.queries).toEqual([
      { userId: USER_ID, organizationId: ORG_ID, since: new Date('2026-09-24T00:00:00.000Z'), limit: 5 },
    ]);
    expect(res.headers['cache-control']).toBe('no-store');
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

