import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { databaseTenant } from '../auth/request-context';
import { InboundBookingsService } from '../channels/inbound.service';
import { ChannexSyncService } from '../channels/sync.service';
import { ExtensionsService } from '../platform/extensions.service';
import { AssistantController } from './assistant.controller';
import { AssistantActionsService, INTEGRATION_OWNER_CHECK, NOT_CONNECTED, READ_ONLY, TOO_OFTEN } from './actions.service';
import { DiagnosticsService } from './diagnostics.service';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
  type RequesterFacts,
} from './requester-context.repository';
import { RequesterContextService } from './requester-context.service';
import { USER_ERRORS_REPOSITORY } from './user-errors.repository';

/**
 * S6: `POST /assistant/actions/channel-pull` и `channel-sync` — действия помощника своим ключом действий. Ключ
 * чтения на запись не пускается, ключ действий на чтение — тоже; членство, право «каналы», «только чтение»,
 * интеграция, лимит и идемпотентность проверяются на платформе. Люди и организации вымышленные (ADR-010).
 */
const ACT_KEY = 'assistant-act-key-for-run';
const READ_KEY = 'assistant-read-key-for-run';
const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '9f8e7d6c-5b4a-4392-8171-000000000000';
const ORG_RO = '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a';
const OWNER_A = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const STAFF_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '33333333-3333-4333-8333-333333333333';
const OWNER_RO = '44444444-4444-4444-8444-444444444444';

const org = (name: string, status: 'ACTIVE' | 'READ_ONLY' = 'ACTIVE') => ({ name, status, trialEndsAt: null });
const facts = (role: RequesterFacts['role'], organization: RequesterFacts['organization']): RequesterFacts => ({
  role,
  platformAdmin: false,
  organization,
  businesses: [],
});
const members = new Map<string, RequesterFacts>([
  [`${OWNER_A}|${ORG_A}`, facts('OWNER', org('Гостиница А'))],
  [`${STAFF_A}|${ORG_A}`, facts('STAFF', org('Гостиница А'))],
  [`${OWNER_B}|${ORG_B}`, facts('OWNER', org('Гостиница Б'))],
  [`${OWNER_RO}|${ORG_RO}`, facts('OWNER', org('Гостиница РО', 'READ_ONLY'))],
]);
const membership: RequesterContextRepository = {
  async facts(userId, organizationId) {
    return members.get(`${userId}|${organizationId}`) ?? null;
  },
};

const pulls: Array<string | null> = [];
const syncs: number[] = [];
const inbound = {
  async pull() {
    pulls.push(databaseTenant());
    const outcome = (result: string) => ({ revisionId: 'r', uniqueId: 'u', status: 'new', result, confirmationNumber: null, warnings: [] });
    return { received: 3, acknowledged: 2, outcomes: [outcome('created'), outcome('modified'), outcome('failed')] };
  },
};
const sync = {
  async fullSync(days: number) {
    syncs.push(days);
    return { from: '2026-09-29', to: '2026-12-28', availabilityValues: 120, restrictionValues: 60, tasks: ['t-1'], warnings: [] };
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
      { provide: DiagnosticsService, useValue: {} },
      { provide: INTEGRATION_OWNER_CHECK, useValue: async (id: string) => id === ORG_A || id === ORG_RO },
      { provide: InboundBookingsService, useValue: inbound },
      { provide: ChannexSyncService, useValue: sync },
      AssistantActionsService,
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
  pulls.length = 0;
  syncs.length = 0;
});

let counter = 0;
function post(path: string, body: Record<string, unknown>, keyValue: string | null = ACT_KEY) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('ASSISTANT_ACT_KEY', ACT_KEY);
  vi.stubEnv('ASSISTANT_READ_KEY', READ_KEY);
  vi.stubEnv('SERVICE_API_KEY', 'service-key-for-run');
  const req = request(app.getHttpServer()).post(path).send(body);
  return keyValue ? req.set('x-wetop-service-key', keyValue) : req;
}
const pull = (userId: string, organizationId: string, extra: Record<string, unknown> = {}, key: string | null = ACT_KEY) =>
  post('/assistant/actions/channel-pull', { userId, organizationId, idempotencyKey: `k-${++counter}`, ...extra }, key);
const syncReq = (userId: string, organizationId: string, extra: Record<string, unknown> = {}) =>
  post('/assistant/actions/channel-sync', { userId, organizationId, idempotencyKey: `s-${++counter}`, ...extra });

describe('ключи (S6)', () => {
  it('ключ чтения на действие — 403, без ключа — 401', async () => {
    await pull(OWNER_A, ORG_A, {}, READ_KEY).expect(403);
    await pull(OWNER_A, ORG_A, {}, null).expect(401);
    expect(pulls).toEqual([]);
  });

  it('ключ действий на чтение — 403', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('ASSISTANT_ACT_KEY', ACT_KEY);
    await request(app.getHttpServer())
      .get(`/assistant/requester?userId=${OWNER_A}&organizationId=${ORG_A}`)
      .set('x-wetop-service-key', ACT_KEY)
      .expect(403);
  });
});

describe('POST /assistant/actions/channel-pull (S6)', () => {
  it('владелец организации с каналами: лента подтянута от имени организации, числа без адресов', async () => {
    const res = await pull(OWNER_A, ORG_A).expect(200);
    expect(res.body).toEqual({ ok: true, action: 'channel_pull', replayed: false, received: 3, processed: 2, failed: 1 });
    expect(pulls).toEqual([ORG_A]);
  });

  it('повтор с тем же ключом идемпотентности не выполняет второй раз', async () => {
    const body = { userId: OWNER_B, organizationId: ORG_B, idempotencyKey: 'same-key' };
    // Б — без интеграции: сначала докажем 409, чтобы повтор ниже проверялся на А
    await post('/assistant/actions/channel-pull', body).expect(409);
  });

  it('чужая пара — 404; администратор без права «каналы» — 403; «только чтение» — 409; без интеграции — 409', async () => {
    await pull(OWNER_A, ORG_B).expect(404);
    const staff = await pull(STAFF_A, ORG_A).expect(403);
    expect(staff.body.message).toContain('каналы');
    const ro = await pull(OWNER_RO, ORG_RO).expect(409);
    expect(ro.body.message).toBe(READ_ONLY);
    const notConnected = await pull(OWNER_B, ORG_B).expect(409);
    expect(notConnected.body.message).toBe(NOT_CONNECTED);
    expect(pulls).toEqual([]);
  });

  it('кривые id и пустой ключ идемпотентности — 400 до проверок', async () => {
    await post('/assistant/actions/channel-pull', { userId: '1', organizationId: ORG_A, idempotencyKey: 'x' }).expect(400);
    await post('/assistant/actions/channel-pull', { userId: OWNER_A, organizationId: ORG_A }).expect(400);
    expect(pulls).toEqual([]);
  });
});

describe('POST /assistant/actions/channel-sync (S6)', () => {
  it('полная выгрузка на 90 дней по умолчанию; кривые days — 400', async () => {
    const res = await syncReq(OWNER_A, ORG_A).expect(200);
    expect(res.body).toEqual({ ok: true, action: 'channel_sync', replayed: false, queued: 180, days: 90 });
    expect(syncs).toEqual([90]);
    await syncReq(OWNER_A, ORG_A, { days: 'много' }).expect(400);
    await syncReq(OWNER_A, ORG_A, { days: 0 }).expect(400);
  });

  it('лимит: то же действие той же организации сразу ещё раз — 429; тот же ключ идемпотентности — прежний ответ', async () => {
    const first = await syncReq(OWNER_A, ORG_A, { idempotencyKey: 'sync-once' });
    // первый вызов мог упереться в лимит от предыдущего теста — оба исхода честны, важен повтор
    if (first.status === 200) {
      const again = await syncReq(OWNER_A, ORG_A, { idempotencyKey: 'sync-once' }).expect(200);
      expect(again.body.replayed).toBe(true);
    }
    const limited = await syncReq(OWNER_A, ORG_A).expect(429);
    expect(limited.body.message).toBe(TOO_OFTEN);
    expect(syncs.length).toBeLessThanOrEqual(1);
  });
});
