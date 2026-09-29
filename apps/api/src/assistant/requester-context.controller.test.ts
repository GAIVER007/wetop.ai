import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { databaseTenant } from '../auth/request-context';
import { ExtensionsService } from '../platform/extensions.service';
import { AssistantController } from './assistant.controller';
import {
  REQUESTER_CONTEXT_REPOSITORY,
  type RequesterContextRepository,
  type RequesterFacts,
} from './requester-context.repository';
import { RequesterContextService, requesterRef } from './requester-context.service';
import { USER_ERRORS_REPOSITORY } from './user-errors.repository';

/**
 * S4: `GET /assistant/requester` — контекст обратившегося для помощника поддержки. Матрица изоляции: свой ответ,
 * чужая организация, чужой филиал не виден, роль и статус аккаунта считает сервер, личного в ответе нет.
 * Люди и организации вымышленные (ADR-010).
 */
const KEY = 'assistant-read-key-for-run';
const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '9f8e7d6c-5b4a-4392-8171-000000000000';
const OWNER_A = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const STAFF_A = '11111111-1111-4111-8111-111111111111';
const ADMIN_A = '22222222-2222-4222-8222-222222222222';
const OWNER_B = '33333333-3333-4333-8333-333333333333';

const soon = new Date(Date.now() + 5 * 86_400_000);
const past = new Date(Date.now() - 5 * 86_400_000);

interface Row {
  facts: RequesterFacts;
}
const members = new Map<string, Row>();
const key = (u: string, o: string) => `${u}|${o}`;
members.set(key(OWNER_A, ORG_A), {
  facts: {
    role: 'OWNER',
    platformAdmin: false,
    organization: { name: 'Гостиница А', status: 'ACTIVE', trialEndsAt: null },
    businesses: [{ name: 'Бизнес А', vertical: 'HOSPITALITY', locations: [{ name: 'Филиал А1' }] }],
  },
});
members.set(key(STAFF_A, ORG_A), {
  facts: {
    role: 'STAFF',
    platformAdmin: false,
    organization: { name: 'Гостиница А', status: 'READ_ONLY', trialEndsAt: past },
    businesses: [{ name: 'Бизнес А', vertical: 'HOSPITALITY', locations: [{ name: 'Филиал А1' }] }],
  },
});
members.set(key(ADMIN_A, ORG_A), {
  facts: {
    role: 'OWNER',
    platformAdmin: true,
    organization: { name: 'Гостиница А', status: 'TRIAL', trialEndsAt: soon },
    businesses: [],
  },
});
members.set(key(OWNER_B, ORG_B), {
  facts: {
    role: 'OWNER',
    platformAdmin: false,
    organization: { name: 'Гостиница Б', status: 'ACTIVE', trialEndsAt: null },
    businesses: [{ name: 'Бизнес Б', vertical: 'BEAUTY', locations: [{ name: 'Филиал Б1' }] }],
  },
});

const seenOrganizations: Array<string | null | undefined> = [];
const repo: RequesterContextRepository = {
  async facts(userId, organizationId) {
    // чтение идёт от имени организации запроса: под RLS база сама не отдаст чужого
    seenOrganizations.push(databaseTenant());
    return members.get(key(userId, organizationId))?.facts ?? null;
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
      { provide: REQUESTER_CONTEXT_REPOSITORY, useValue: repo },
      RequesterContextService,
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
  seenOrganizations.length = 0;
});

function ask(userId: string, organizationId: string, keyValue: string | null = KEY) {
  vi.stubEnv('AUTH_REQUIRED', '1');
  vi.stubEnv('ASSISTANT_READ_KEY', KEY);
  vi.stubEnv('SERVICE_API_KEY', 'service-key-for-run');
  const req = request(app.getHttpServer()).get(
    `/assistant/requester?userId=${userId}&organizationId=${organizationId}`,
  );
  return keyValue ? req.set('x-wetop-service-key', keyValue) : req;
}

describe('GET /assistant/requester — матрица изоляции (S4)', () => {
  it('человек организации А получает только А: свои названия, роль и права', async () => {
    const res = await ask(OWNER_A, ORG_A).expect(200);
    expect(res.body.organization).toEqual({ displayName: 'Гостиница А' });
    expect(res.body.businesses).toEqual([
      { displayName: 'Бизнес А', vertical: 'HOSPITALITY', locations: [{ displayName: 'Филиал А1' }] },
    ]);
    expect(res.body.requester).toEqual({ ref: requesterRef(OWNER_A), role: 'owner', kind: 'TENANT_USER' });
    expect(res.body.scope).toBe('ORGANIZATION');
    expect(JSON.stringify(res.body)).not.toContain('Гостиница Б');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('подставить организацию Б под человека А нельзя: пары нет в членствах — 404', async () => {
    await ask(OWNER_A, ORG_B).expect(404);
    await ask(OWNER_B, ORG_A).expect(404);
  });

  it('главный администратор не получает чужую организацию: без членства — 404, как всем', async () => {
    await ask(ADMIN_A, ORG_B).expect(404);
  });

  it('главный администратор в своей организации — отдельный вид, не «ещё один пользователь»', async () => {
    const res = await ask(ADMIN_A, ORG_A).expect(200);
    expect(res.body.requester.kind).toBe('PLATFORM_ADMIN');
  });

  it('бизнес и филиал — только организации запроса', async () => {
    const res = await ask(OWNER_B, ORG_B).expect(200);
    expect(res.body.businesses).toHaveLength(1);
    expect(res.body.businesses[0].displayName).toBe('Бизнес Б');
    expect(JSON.stringify(res.body)).not.toContain('Филиал А1');
  });

  it('чтение идёт от имени организации запроса (RLS): чужая не подставляется', async () => {
    await ask(OWNER_A, ORG_A).expect(200);
    await ask(OWNER_B, ORG_B).expect(200);
    expect(seenOrganizations).toEqual([ORG_A, ORG_B]);
  });

  it('READ_ONLY определяется по сроку и по статусу: писать нельзя, причина названа', async () => {
    const res = await ask(STAFF_A, ORG_A).expect(200);
    expect(res.body.account).toMatchObject({ status: 'READ_ONLY', canMutate: false });
    expect(res.body.account.reasonCode).toBeTypeOf('string');
  });

  it('TRIAL в срок — писать можно, срок виден', async () => {
    const res = await ask(ADMIN_A, ORG_A).expect(200);
    expect(res.body.account).toMatchObject({ status: 'TRIAL', canMutate: true });
    expect(res.body.account.trialEndsAt).toBe(soon.toISOString());
  });

  it('право false приходит как false, а не пропадает', async () => {
    const res = await ask(STAFF_A, ORG_A).expect(200);
    expect(res.body.permissions.settings).toBe(false);
    expect(res.body.permissions.owner).toBe(false);
    expect(res.body.permissions.desk).toBe(true);
  });

  it('в ответе нет почты, телефона, имени человека, ключей и внутренних id', async () => {
    for (const [user, org] of [[OWNER_A, ORG_A], [STAFF_A, ORG_A], [OWNER_B, ORG_B]] as const) {
      const text = JSON.stringify((await ask(user, org).expect(200)).body);
      for (const id of [user, org, ORG_A, ORG_B]) expect(text).not.toContain(id);
      for (const word of ['email', 'phone', 'token', 'secret', 'password', 'cookie', '@']) {
        expect(text.toLowerCase()).not.toContain(word);
      }
    }
  });

  it('без ключа — 401, чужой и служебно-узкий ключи не годятся', async () => {
    await ask(OWNER_A, ORG_A, null).expect(401);
    await ask(OWNER_A, ORG_A, 'another-key').expect(401);
  });

  it('кривые идентификаторы — 400, в базу не идём', async () => {
    vi.stubEnv('AUTH_REQUIRED', '1');
    vi.stubEnv('ASSISTANT_READ_KEY', KEY);
    await request(app.getHttpServer())
      .get('/assistant/requester?userId=1&organizationId=2')
      .set('x-wetop-service-key', KEY)
      .expect(400);
    expect(seenOrganizations).toEqual([]);
  });
});
