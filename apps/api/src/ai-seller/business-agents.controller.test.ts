import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_SETUP_ITEMS, writeBlocked } from '@pms/domain';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import { ExtensionsService } from '../platform/extensions.service';
import { BusinessAgentsController } from './business-agents.controller';
import { BUSINESS_AGENTS } from './business-agents.repository';
import { AGENT_LOCATION_TAKEN, BusinessAgentsService } from './business-agents.service';
import { FakeBusinessAgents, FakeSellerExtensions } from './fakes';

/**
 * Business Agents (SA2, plans/business-ai-seller-sa2-2026-09-30.md §3, §5): создание черновика и страница состояния.
 * Настоящие замок, автор и перехватчик запроса; подставные хранилище и расширение. Организацию и автора называет вошедший,
 * тело запроса их не несёт, и это проверяется здесь же.
 */

const ORG_A = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ORG_B = '7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const USER_A = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const USER_B = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const USER_STAFF = '2d8e5e3a-6b6a-4c75-9d9a-4b3f9c1e2c33';
const USER_MANAGER = '3e9f6f4b-7c7b-4d86-8e0b-5c4a0d2f3d44';
const BIZ_A = 'aaaa0000-0000-4000-8000-00000000000a';
const LOC_A1 = 'aaaa1111-0000-4000-8000-0000000000a1';
const LOC_A2 = 'aaaa2222-0000-4000-8000-0000000000a2';
const BIZ_B = 'bbbb0000-0000-4000-8000-00000000000b';
const LOC_B1 = 'bbbb1111-0000-4000-8000-0000000000b1';
const KEY_1 = '11111111-aaaa-4aaa-8aaa-111111111111';
const KEY_2 = '22222222-bbbb-4bbb-8bbb-222222222222';

const repo = new FakeBusinessAgents();
const extensions = new FakeSellerExtensions();
let app: INestApplication;

beforeAll(async () => {
  const users: Record<string, { id: string; organizationId: string; role: 'OWNER' | 'MANAGER' | 'STAFF' }> = {
    'session-a': { id: USER_A, organizationId: ORG_A, role: 'OWNER' },
    'session-b': { id: USER_B, organizationId: ORG_B, role: 'OWNER' },
    'session-staff': { id: USER_STAFF, organizationId: ORG_A, role: 'STAFF' },
    'session-manager': { id: USER_MANAGER, organizationId: ORG_A, role: 'MANAGER' },
  };
  const auth = {
    whoami: vi.fn(async (token: string) => {
      const who = users[token];
      return who
        ? {
            user: { ...who, email: `${who.id.slice(0, 4)}@example.invalid`, name: null, platformAdmin: false },
            organization: null,
            expiresAt: '2026-10-25T00:00:00.000Z',
          }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [BusinessAgentsController],
    providers: [
      BusinessAgentsService,
      { provide: BUSINESS_AGENTS, useValue: repo },
      { provide: ExtensionsService, useValue: extensions },
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
  repo.agents.clear();
  repo.events = [];
  repo.businesses = new Map([
    [
      ORG_A,
      [
        {
          id: BIZ_A,
          name: 'Luxx Hotels',
          locations: [
            { id: LOC_A1, name: 'Алматы' },
            { id: LOC_A2, name: 'Астана' },
          ],
        },
      ],
    ],
    [ORG_B, [{ id: BIZ_B, name: 'Чужая сеть', locations: [{ id: LOC_B1, name: 'Шымкент' }] }]],
  ]);
  extensions.access = 'active';
  extensions.asked = [];
});

const as = (session: string) => ({ 'x-wetop-session': session });
const api = () => request(app.getHttpServer());
const create = (session: string, key: string | undefined, body: unknown) => {
  const req = api().post('/ai-seller/agents').set(as(session));
  return (key ? req.set('idempotency-key', key) : req).send(body as object);
};
const draft = (over: Record<string, unknown> = {}) => ({ name: 'AI-продавец Luxx', businessId: BIZ_A, locationId: LOC_A1, ...over });

describe('создание черновика', () => {
  it('владелец создаёт черновик: 201, состояние «Черновик», филиал и Business в ответе, список настройки', async () => {
    const res = await create('session-a', KEY_1, draft()).expect(201);
    expect(res.body).toMatchObject({
      id: KEY_1,
      name: 'AI-продавец Luxx',
      lifecycle: 'draft',
      business: { id: BIZ_A, name: 'Luxx Hotels' },
      location: { id: LOC_A1, name: 'Алматы' },
    });
    expect(res.body.setup).toEqual(AGENT_SETUP_ITEMS.map((i) => ({ ...i })));
    const saved = repo.agents.get(KEY_1)!;
    expect(saved.organizationId).toBe(ORG_A);
    expect(saved.createdBy).toBe(USER_A);
    expect(saved.scenario).toBe('sales');
    expect(saved.lifecycle).toBe('draft');
  });

  it('управляющий тоже может создать; сотрудник смены, нет', async () => {
    await create('session-manager', KEY_1, draft()).expect(201);
    await create('session-staff', KEY_2, draft({ locationId: LOC_A2 })).expect(403);
    expect(repo.agents.size).toBe(1);
  });

  it('организацию и автора называет вошедший: `organizationId` и `createdBy` из тела игнорируются', async () => {
    await create('session-a', KEY_1, draft({ organizationId: ORG_B, createdBy: USER_B })).expect(201);
    const saved = repo.agents.get(KEY_1)!;
    expect(saved.organizationId).toBe(ORG_A);
    expect(saved.createdBy).toBe(USER_A);
  });

  it('без действующего расширения, 403 словами, ничего не создано', async () => {
    extensions.access = 'off';
    const off = await create('session-a', KEY_1, draft()).expect(403);
    expect(off.body.message).toBe('Расширение «ИИ-продавец» не подключено.');
    extensions.access = 'expired';
    const expired = await create('session-a', KEY_1, draft()).expect(403);
    expect(expired.body.message).toBe('Срок расширения «ИИ-продавец» вышел.');
    expect(repo.agents.size).toBe(0);
  });

  it('чужой Business, чужой филиал, филиал не этого Business, несуществующий и снятый с показа, 404', async () => {
    await create('session-a', KEY_1, draft({ businessId: BIZ_B, locationId: LOC_B1 })).expect(404);
    await create('session-a', KEY_1, draft({ locationId: LOC_B1 })).expect(404);
    await create('session-a', KEY_1, draft({ businessId: BIZ_B })).expect(404);
    await create('session-a', KEY_1, draft({ locationId: 'cccc0000-0000-4000-8000-00000000000c' })).expect(404);
    repo.businesses.get(ORG_A)![0]!.locations[0]!.archived = true;
    await create('session-a', KEY_1, draft()).expect(404);
    repo.businesses.get(ORG_A)![0]!.locations[0]!.archived = false;
    repo.businesses.get(ORG_A)![0]!.archived = true;
    await create('session-a', KEY_1, draft()).expect(404);
    expect(repo.agents.size).toBe(0);
  });

  it('на филиале уже есть неархивный AI-продавец, 409 словами; архивный филиал не занимает', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    const second = await create('session-manager', KEY_2, draft({ name: 'Второй' })).expect(409);
    expect(second.body.message).toBe(AGENT_LOCATION_TAKEN);
    repo.agents.get(KEY_1)!.lifecycle = 'archived';
    await create('session-manager', KEY_2, draft({ name: 'Второй' })).expect(201);
  });

  it('второй филиал той же сети свободен, пока первый занят', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    await create('session-a', KEY_2, draft({ locationId: LOC_A2 })).expect(201);
  });

  it('ошибки ввода, 400 с полями: пустое название, не UUID', async () => {
    const res = await create('session-a', KEY_1, { name: '   ', businessId: 'x', locationId: LOC_A1 }).expect(400);
    expect(res.body.errors).toMatchObject({ name: expect.any(String), businessId: expect.any(String) });
    expect(res.body.errors.locationId).toBeUndefined();
  });

  it('без входа, 401', async () => {
    await api().post('/ai-seller/agents').set('idempotency-key', KEY_1).send(draft()).expect(401);
  });
});

describe('повтор: Idempotency-Key', () => {
  it('тот же запрос тем же человеком, тот же агент, второй записи нет, журнал не дописывается', async () => {
    const first = await create('session-a', KEY_1, draft()).expect(201);
    const again = await create('session-a', KEY_1, draft()).expect(201);
    expect(again.body.id).toBe(first.body.id);
    expect(repo.agents.size).toBe(1);
    expect(repo.events.filter((e) => e.action === 'agent.created')).toHaveLength(1);
  });

  it('журнал: где и в каком состоянии создан, названия нет', async () => {
    await create('session-a', KEY_1, draft({ name: 'Секретное имя' })).expect(201);
    expect(repo.events).toEqual([
      {
        entityId: KEY_1,
        action: 'agent.created',
        organizationId: ORG_A,
        userId: USER_A,
        after: { source: 'business-agent', businessId: BIZ_A, locationId: LOC_A1, lifecycle: 'draft' },
      },
    ]);
    expect(JSON.stringify(repo.events)).not.toContain('Секретное имя');
  });

  it('ключ чужой организации или чужого человека, 404 как несуществующий, чужой агент не отдаётся', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    const foreignOrg = await create('session-b', KEY_1, draft({ businessId: BIZ_B, locationId: LOC_B1 })).expect(404);
    expect(JSON.stringify(foreignOrg.body)).not.toContain('AI-продавец Luxx');
    await create('session-manager', KEY_1, draft()).expect(404);
    expect(repo.agents.size).toBe(1);
  });

  it('ключ, равный организации, рабочий продавец, а не результат создания: 404', async () => {
    repo.agents.set(ORG_A, {
      id: ORG_A,
      organizationId: ORG_A,
      createdBy: USER_A,
      name: 'Рабочий продавец',
      scenario: 'sales',
      lifecycle: 'active',
      locationId: LOC_A1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await create('session-a', ORG_A, draft({ locationId: LOC_A2 })).expect(404);
    expect(repo.agents.size).toBe(1);
  });

  it('нет ключа или он не UUID, 400', async () => {
    await create('session-a', undefined, draft()).expect(400);
    await create('session-a', 'not-a-uuid', draft()).expect(400);
    expect(repo.agents.size).toBe(0);
  });
});

describe('варианты создания', () => {
  it('Business → филиалы со словом «занят»; кнопка доступна, пока есть свободный', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    const res = await api().get('/ai-seller/agents/options').set(as('session-a')).expect(200);
    expect(res.body.canCreate).toBe(true);
    expect(res.body.reason).toBeNull();
    expect(res.body.businesses).toEqual([
      {
        id: BIZ_A,
        name: 'Luxx Hotels',
        locations: [
          { id: LOC_A1, name: 'Алматы', free: false, reason: 'Для этого филиала AI-продавец уже создан.' },
          { id: LOC_A2, name: 'Астана', free: true, reason: null },
        ],
      },
    ]);
    expect(JSON.stringify(res.body)).not.toContain('Чужая сеть');
  });

  it('единственный филиал занят, кнопка неактивна с причиной (для Luxx)', async () => {
    repo.businesses.get(ORG_A)![0]!.locations.pop();
    await create('session-a', KEY_1, draft()).expect(201);
    const res = await api().get('/ai-seller/agents/options').set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({
      canCreate: false,
      reason: 'Нет свободного филиала. Для этого филиала AI-продавец уже создан.',
    });
  });

  it('появился новый филиал, кнопка снова доступна сама', async () => {
    repo.businesses.get(ORG_A)![0]!.locations.pop();
    await create('session-a', KEY_1, draft()).expect(201);
    repo.businesses.get(ORG_A)![0]!.locations.push({ id: LOC_A2, name: 'Астана' });
    const res = await api().get('/ai-seller/agents/options').set(as('session-a')).expect(200);
    expect(res.body.canCreate).toBe(true);
  });

  it('сотрудник смены варианты видит, но создать не может: причина словами', async () => {
    const res = await api().get('/ai-seller/agents/options').set(as('session-staff')).expect(200);
    expect(res.body).toMatchObject({ canCreate: false, reason: 'Создавать агентов могут владелец и управляющий.' });
    expect(res.body.businesses).toHaveLength(1);
  });

  it('расширения нет, ни Business, ни филиалов не отдаётся, причина про расширение', async () => {
    extensions.access = 'off';
    const res = await api().get('/ai-seller/agents/options').set(as('session-a')).expect(200);
    expect(res.body).toMatchObject({ canCreate: false, reason: 'Расширение «ИИ-продавец» не подключено.', businesses: [] });
  });
});

describe('страница агента', () => {
  it('своего агента видят все роли с диалогами: филиал, Business, список настройки', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    for (const who of ['session-a', 'session-manager', 'session-staff']) {
      const res = await api().get(`/ai-seller/agents/${KEY_1}`).set(as(who)).expect(200);
      expect(res.body).toMatchObject({ id: KEY_1, lifecycle: 'draft', location: { name: 'Алматы' } });
      expect(res.body.setup.map((i: { done: boolean }) => i.done)).toEqual([true, false, false, false, false, false, false]);
    }
  });

  it('чужой, несуществующий и не-UUID, 404; рабочий продавец (id = организация), 404', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    await api().get(`/ai-seller/agents/${KEY_1}`).set(as('session-b')).expect(404);
    await api().get(`/ai-seller/agents/${KEY_2}`).set(as('session-a')).expect(404);
    await api().get('/ai-seller/agents/не-uuid').set(as('session-a')).expect(404);
    repo.agents.set(ORG_A, {
      id: ORG_A,
      organizationId: ORG_A,
      createdBy: USER_A,
      name: 'Рабочий',
      scenario: 'sales',
      lifecycle: 'active',
      locationId: LOC_A1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await api().get(`/ai-seller/agents/${ORG_A}`).set(as('session-a')).expect(404);
  });
});

describe('перевода из черновика нет ни в одном маршруте (Q-SA-16: /activate удалён до SA9)', () => {
  const NO_ROUTE = [
    ['POST', 'activate'],
    ['POST', 'launch'],
    ['POST', 'pause'],
    ['POST', 'archive'],
  ] as const;

  it.each(NO_ROUTE)('%s /ai-seller/agents/:id/%s, маршрута нет', async (_method, action) => {
    await create('session-a', KEY_1, draft()).expect(201);
    await api().post(`/ai-seller/agents/${KEY_1}/${action}`).set(as('session-a')).send({ lifecycle: 'active' }).expect(404);
    expect(repo.agents.get(KEY_1)!.lifecycle).toBe('draft');
  });

  it.each(['PATCH', 'PUT', 'POST', 'DELETE'] as const)('%s /ai-seller/agents/:id, менять агента этим маршрутом нельзя', async (method) => {
    await create('session-a', KEY_1, draft()).expect(201);
    const call = { PATCH: api().patch, PUT: api().put, POST: api().post, DELETE: api().delete }[method].bind(api());
    await call(`/ai-seller/agents/${KEY_1}`).set(as('session-a')).send({ lifecycle: 'active', locationId: LOC_A2 }).expect(404);
    const kept = repo.agents.get(KEY_1)!;
    expect(kept.lifecycle).toBe('draft');
    expect(kept.locationId).toBe(LOC_A1);
  });

  it('нового агента нельзя создать сразу рабочим: `lifecycle` из тела не читается', async () => {
    await create('session-a', KEY_1, draft({ lifecycle: 'active' })).expect(201);
    expect(repo.agents.get(KEY_1)!.lifecycle).toBe('draft');
    const res = await api().get(`/ai-seller/agents/${KEY_1}`).set(as('session-a')).expect(200);
    expect(res.body.lifecycle).toBe('draft');
  });

  it('повтор create с тем же ключом и другим `lifecycle` тоже не переводит агента', async () => {
    await create('session-a', KEY_1, draft()).expect(201);
    await create('session-a', KEY_1, draft({ lifecycle: 'active' })).expect(201);
    expect(repo.agents.get(KEY_1)!.lifecycle).toBe('draft');
  });
});

describe('режим «только чтение»', () => {
  it('запись в раздел агентов при выходе пробного периода блокируется до контроллера, чтение остаётся', () => {
    const organization = { status: 'TRIAL' as const, trialEndsAt: new Date('2026-09-01T00:00:00.000Z') };
    const at = { organization, platformAdmin: false, now: new Date('2026-09-30T00:00:00.000Z') };
    expect(writeBlocked({ method: 'POST', path: '/ai-seller/agents', ...at })).toBe(true);
    expect(writeBlocked({ method: 'GET', path: '/ai-seller/agents/options', ...at })).toBe(false);
  });
});
