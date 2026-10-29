import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { PLATFORM_ADMIN_ONLY } from './admin';
import {
  CLIENT_CARD_REPOSITORY,
  ClientCardController,
  TRIAL_EXTEND_MESSAGE,
  TRIAL_NOT_FOR_PAYING,
  trialExtendedUntil,
  type ClientCardRow,
} from './client-card.controller';

/**
 * Карточка клиента в кабинете руководителя (план 2026-10-29-owner-cabinet-full.md, срез 3; владелец 29.10.2026:
 * «прорабатывай остальные экраны… чтобы я вошёл и видел всё, что должно быть у админа»): люди, филиалы, журнал
 * действий и «продлить пробный». Только главному администратору.
 */
const ORG = '6e3a2b0f-9d8c-4f4b-b2a1-7c0d3e5f9a11';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const NOW = new Date('2026-10-29T10:00:00.000Z');

let row: ClientCardRow;
const extended: Array<{ organizationId: string; until: string; by: string | null }> = [];
const repo = {
  async card(id: string) {
    return id === ORG ? row : null;
  },
  async extendTrial(input: { organizationId: string; until: Date; by: string | null }) {
    extended.push({ organizationId: input.organizationId, until: input.until.toISOString(), by: input.by });
    row = { ...row, status: 'TRIAL', trialEndsAt: input.until };
  },
};

let app: INestApplication;
beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  const users: Record<string, { id: string; role: 'OWNER'; platformAdmin: boolean }> = {
    'session-admin': { id: ADMIN, role: 'OWNER', platformAdmin: true },
    'session-owner': { id: OWNER, role: 'OWNER', platformAdmin: false },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? { user: { ...who, organizationId: ORG, email: 'x@example.invalid', name: null }, organization: null, expiresAt: '2026-12-26T00:00:00.000Z' }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [ClientCardController],
    providers: [
      { provide: CLIENT_CARD_REPOSITORY, useValue: repo },
      { provide: AuthService, useValue: auth },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_INTERCEPTOR, useClass: AuthorInterceptor },
    ],
  }).compile();
  app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
});
afterAll(async () => {
  vi.useRealTimers();
  await app.close();
});
beforeEach(() => {
  vi.stubEnv('AUTH_REQUIRED', '1');
  extended.length = 0;
  row = {
    id: ORG,
    name: 'Клиент',
    status: 'TRIAL',
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    trialEndsAt: new Date('2026-10-27T00:00:00.000Z'),
    members: [
      { email: 'boss@example.invalid', name: 'Владелец', role: 'OWNER', lastLoginAt: new Date('2026-10-28T08:00:00.000Z') },
      { email: 'desk@example.invalid', name: null, role: 'STAFF', lastLoginAt: null },
    ],
    locations: [{ name: 'Центр', business: 'Салон', vertical: 'BEAUTY' }],
    journal: [
      { at: new Date('2026-10-21T09:00:00.000Z'), action: 'organization.status_changed', by: 'a@example.invalid', after: { status: 'ACTIVE', note: 'Счёт 1' } },
      { at: new Date('2026-10-20T09:00:00.000Z'), action: 'organization.created', by: null, after: null },
    ],
  };
});
const api = () => request(app.getHttpServer());
const as = (s: string) => ({ 'x-wetop-session': s });

describe('trialExtendedUntil', () => {
  it('срок уже прошёл: считаем от сегодня; ещё идёт: от конца срока', () => {
    expect(trialExtendedUntil(new Date('2026-10-27T00:00:00.000Z'), NOW, 7).toISOString()).toBe('2026-11-05T10:00:00.000Z');
    expect(trialExtendedUntil(new Date('2026-11-01T00:00:00.000Z'), NOW, 7).toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(trialExtendedUntil(null, NOW, 1).toISOString()).toBe('2026-10-30T10:00:00.000Z');
  });
});

describe('GET /platform/organizations/:id/card', () => {
  it('без отметки главного администратора 403, без входа 401', async () => {
    const res = await api().get(`/platform/organizations/${ORG}/card`).set(as('session-owner')).expect(403);
    expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    await api().get(`/platform/organizations/${ORG}/card`).expect(401);
  });

  it('люди, филиалы и журнал действий; нет такой: 404, не идентификатор: 400', async () => {
    const res = await api().get(`/platform/organizations/${ORG}/card`).set(as('session-admin')).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ id: ORG, name: 'Клиент', status: 'TRIAL', trialEndsAt: '2026-10-27T00:00:00.000Z' });
    expect(res.body.members).toEqual([
      { email: 'boss@example.invalid', name: 'Владелец', owner: true, lastLoginAt: '2026-10-28T08:00:00.000Z' },
      { email: 'desk@example.invalid', name: null, owner: false, lastLoginAt: null },
    ]);
    expect(res.body.locations).toEqual([{ name: 'Центр', business: 'Салон', vertical: 'BEAUTY' }]);
    expect(res.body.journal[0]).toEqual({
      at: '2026-10-21T09:00:00.000Z',
      action: 'organization.status_changed',
      by: 'a@example.invalid',
      status: 'ACTIVE',
      note: 'Счёт 1',
    });
    await api().get('/platform/organizations/2b1c0a9e-1111-4a53-9b7e-2f1d7a9c0a11/card').set(as('session-admin')).expect(404);
    await api().get('/platform/organizations/abc/card').set(as('session-admin')).expect(400);
  });
});

describe('PUT /platform/organizations/:id/trial', () => {
  it('продлевает пробный на 1–30 дней от сегодня, если срок прошёл; автор в журнале', async () => {
    const res = await api().put(`/platform/organizations/${ORG}/trial`).set(as('session-admin')).send({ days: 7 }).expect(200);
    expect(extended).toEqual([{ organizationId: ORG, until: '2026-11-05T10:00:00.000Z', by: ADMIN }]);
    expect(res.body).toMatchObject({ status: 'TRIAL', trialEndsAt: '2026-11-05T10:00:00.000Z' });
  });

  it('из «только чтения» снова пробный', async () => {
    row = { ...row, status: 'READ_ONLY' };
    await api().put(`/platform/organizations/${ORG}/trial`).set(as('session-admin')).send({ days: 3 }).expect(200);
    expect(extended).toHaveLength(1);
  });

  it('дней не 1–30: 400; платит или в архиве: 409, ничего не изменено', async () => {
    for (const days of [0, 31, 2.5, '7', null]) {
      const res = await api().put(`/platform/organizations/${ORG}/trial`).set(as('session-admin')).send({ days }).expect(400);
      expect(res.body.message).toBe(TRIAL_EXTEND_MESSAGE);
    }
    for (const status of ['ACTIVE', 'SUSPENDED'] as const) {
      row = { ...row, status };
      const res = await api().put(`/platform/organizations/${ORG}/trial`).set(as('session-admin')).send({ days: 7 }).expect(409);
      expect(res.body.message).toBe(TRIAL_NOT_FOR_PAYING);
    }
    expect(extended).toHaveLength(0);
  });

  it('владелец организации не продлевает: 403', async () => {
    await api().put(`/platform/organizations/${ORG}/trial`).set(as('session-owner')).send({ days: 7 }).expect(403);
    expect(extended).toHaveLength(0);
  });
});
