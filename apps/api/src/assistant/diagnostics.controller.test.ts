import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { databaseTenant } from '../auth/request-context';
import { WebhookHealthService } from '../channels/webhook-health.service';
import { ExtensionsService } from '../platform/extensions.service';
import { AssistantController } from './assistant.controller';
import { DIAGNOSTICS_REPOSITORY, type DiagnosticsRepository } from './diagnostics.repository';
import { DiagnosticsService } from './diagnostics.service';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
  type RequesterFacts,
} from './requester-context.repository';
import { RequesterContextService } from './requester-context.service';
import { USER_ERRORS_REPOSITORY } from './user-errors.repository';

/**
 * S5: `GET /assistant/integrations` и `GET /assistant/reservation` — диагностика для помощника поддержки.
 * Своя организация читается, чужая — 404, каналы у неподключённой организации — `null`, в ответе нет ни имени
 * гостя, ни телефона, ни заметок, ни сумм, ни ключей. Люди, организации и брони вымышленные (ADR-010).
 */
const KEY = 'assistant-read-key-for-run';
const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '9f8e7d6c-5b4a-4392-8171-000000000000';
const OWNER_A = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER_B = '33333333-3333-4333-8333-333333333333';

const facts: RequesterFacts = {
  role: 'OWNER',
  platformAdmin: false,
  organization: { name: 'Гостиница А', status: 'ACTIVE', trialEndsAt: null },
  businesses: [],
};
const members = new Set([`${OWNER_A}|${ORG_A}`, `${OWNER_B}|${ORG_B}`]);
const membership: RequesterContextRepository = {
  async facts(userId, organizationId) {
    return members.has(`${userId}|${organizationId}`) ? facts : null;
  },
};

const seenTenants: Array<string | null> = [];
const card = {
  confirmationNumber: 'R-42',
  source: 'OTA',
  channel: 'Booking.com',
  status: 'CONFIRMED',
  arrivalDate: '2099-10-02',
  departureDate: '2099-10-05',
  adults: 2,
  children: 0,
  currency: 'KZT',
  totalAmountMinor: '4500000',
  notes: 'позвонить гостю',
  primaryGuest: { id: 'g-1', label: 'Тестовый Гость', citizenship: 'KZ', phone: '+77770000000' },
  items: [
    {
      id: 'i-1',
      accommodationTypeCode: 'STD',
      accommodationTypeName: 'Стандарт',
      arrivalDate: '2099-10-02',
      departureDate: '2099-10-05',
      status: 'CONFIRMED',
      priceMinor: '4500000',
      ratePlanCode: null,
      ratePlanName: null,
      adults: 2,
      children: 0,
      unitCode: null,
      unitHousekeepingStatus: null,
      guests: [{ id: 'g-1', label: 'Тестовый Гость', isPrimary: true }],
    },
  ],
};
const repo: DiagnosticsRepository = {
  async integrationFacts(organizationId) {
    seenTenants.push(databaseTenant());
    if (organizationId !== ORG_A) return null;
    return {
      propertyMapped: true,
      categoriesTotal: 5,
      categoriesMapped: 4,
      ratePlansMapped: 2,
      lastEventAt: new Date(Date.now() - 5 * 60_000),
      outbox: { pending: 1, failed: 0, oldestPendingAt: new Date(Date.now() - 2 * 60_000) },
    };
  },
  async reservationCard(organizationId, number) {
    seenTenants.push(databaseTenant());
    return organizationId === ORG_A && number === 'R-42' ? { card, timezone: 'Asia/Almaty' } : null;
  },
};

let app: INestApplication;
beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    controllers: [AssistantController],
    providers: [
      { provide: AuthService, useValue: { whoami: async () => null } },
      { provide: USER_ERRORS_REPOSITORY, useValue: {} },
      { provide: ExtensionsService, useValue: {} },
      { provide: REQUESTER_CONTEXT_REPOSITORY, useValue: membership },
      RequesterContextService,
      { provide: DIAGNOSTICS_REPOSITORY, useValue: repo },
      {
        provide: WebhookHealthService,
        useValue: {
          snapshot: () => ({ webhookSuspect: true, suspectReason: 'нет событий', callbackReachable: false, callbackProbedUrl: 'https://secret.example/hook' }),
        },
      },
      DiagnosticsService,
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
  seenTenants.length = 0;
});

function get(path: string, keyValue: string | null = KEY) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('ASSISTANT_READ_KEY', KEY);
  vi.stubEnv('SERVICE_API_KEY', 'service-key-for-run');
  // ключ Channex — только если тест не задал свой (проверка NO_KEY ставит пустой)
  if (process.env.CHANNEX_API_KEY === undefined) vi.stubEnv('CHANNEX_API_KEY', 'channex-key-for-run');
  const req = request(app.getHttpServer()).get(path);
  return keyValue ? req.set('x-wetop-service-key', keyValue) : req;
}
const integrations = (u: string, o: string, k: string | null = KEY) =>
  get(`/assistant/integrations?userId=${u}&organizationId=${o}`, k);
const reservation = (u: string, o: string, n: string, k: string | null = KEY) =>
  get(`/assistant/reservation?userId=${u}&organizationId=${o}&number=${encodeURIComponent(n)}`, k);

describe('GET /assistant/integrations (S5)', () => {
  it('организация с каналами: состояние словом, сопоставления, очередь, webhook — без ключей и адресов', async () => {
    const res = await integrations(OWNER_A, ORG_A).expect(200);
    expect(res.body.channex).toMatchObject({
      state: 'ATTENTION',
      categories: { mapped: 4, total: 5 },
      ratePlansMapped: 2,
      outbox: { pending: 1, failed: 0 },
      webhook: { suspect: true, reachable: false },
    });
    expect(res.body.channex.problems).toEqual(['CATEGORIES_UNMAPPED', 'WEBHOOK_SUSPECT', 'WEBHOOK_UNREACHABLE']);
    const text = JSON.stringify(res.body).toLowerCase();
    for (const word of ['secret.example', 'channex-key', 'url', 'token', 'нет событий']) expect(text).not.toContain(word);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('организация без подключённых каналов — channex: null, а не «всё сломано»', async () => {
    const res = await integrations(OWNER_B, ORG_B).expect(200);
    expect(res.body).toEqual({ channex: null });
  });

  it('без ключа Channex в окружении — NO_KEY', async () => {
    vi.stubEnv('CHANNEX_API_KEY', '');
    const res = await integrations(OWNER_A, ORG_A).expect(200);
    expect(res.body.channex.state).toBe('NO_KEY');
  });

  it('чужая пара «человек, организация» — 404, репозиторий не спрашивается', async () => {
    await integrations(OWNER_A, ORG_B).expect(404);
    await integrations(OWNER_B, ORG_A).expect(404);
    expect(seenTenants).toEqual([]);
  });

  it('чтение идёт от имени организации запроса', async () => {
    await integrations(OWNER_A, ORG_A).expect(200);
    expect(seenTenants).toEqual([ORG_A]);
  });

  it('без ключа — 401, чужой ключ — 401, кривые id — 400', async () => {
    await integrations(OWNER_A, ORG_A, null).expect(401);
    await integrations(OWNER_A, ORG_A, 'another-key').expect(401);
    await get('/assistant/integrations?userId=1&organizationId=2').expect(400);
  });
});

describe('GET /assistant/reservation (S5)', () => {
  it('своя бронь: статус, даты, ночи, проживания без ячейки — и ничего личного', async () => {
    const res = await reservation(OWNER_A, ORG_A, 'R-42').expect(200);
    expect(res.body).toMatchObject({
      number: 'R-42',
      status: 'CONFIRMED',
      nights: 3,
      source: 'OTA',
      channel: 'Booking.com',
      guests: { adults: 2, children: 0 },
      problems: ['UNASSIGNED_ITEMS'],
    });
    expect(res.body.items).toEqual([
      { category: 'Стандарт', status: 'CONFIRMED', unitAssigned: false, unitCode: null, housekeeping: null },
    ]);
    const text = JSON.stringify(res.body);
    for (const banned of ['Тестовый', '7777', 'позвонить', 'g-1', 'i-1', 'KZ', '4500000', 'notes', 'primaryGuest', 'phone'])
      expect(text).not.toContain(banned);
  });

  it('чужая организация или несуществующий номер — 404 без различения', async () => {
    const foreign = await reservation(OWNER_B, ORG_B, 'R-42').expect(404);
    const missing = await reservation(OWNER_A, ORG_A, 'R-404').expect(404);
    expect(foreign.body.message).toBe(missing.body.message);
  });

  it('человека нет в организации — 404 до обращения к броням', async () => {
    await reservation(OWNER_A, ORG_B, 'R-42').expect(404);
    expect(seenTenants).toEqual([]);
  });

  it('номер брони проверяется: пробелы, пустое, слишком длинное — 400', async () => {
    await reservation(OWNER_A, ORG_A, 'R 42').expect(400);
    await reservation(OWNER_A, ORG_A, '').expect(400);
    await reservation(OWNER_A, ORG_A, 'x'.repeat(41)).expect(400);
    expect(seenTenants).toEqual([]);
  });

  it('без ключа — 401', async () => {
    await reservation(OWNER_A, ORG_A, 'R-42', null).expect(401);
  });
});
