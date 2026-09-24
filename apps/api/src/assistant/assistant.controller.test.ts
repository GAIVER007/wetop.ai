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
