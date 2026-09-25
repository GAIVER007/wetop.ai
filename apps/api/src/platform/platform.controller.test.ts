import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionChange } from '@pms/domain';
import { SessionGuard } from '../auth/auth.guard';
import { AuthService } from '../auth/auth.service';
import { AuthorInterceptor } from '../auth/author.interceptor';
import {
  EXTENSIONS_REPOSITORY,
  type ExtensionsRepository,
  type OrganizationSummary,
} from './extensions.repository';
import { PLATFORM_ADMIN_ONLY, PLATFORM_NO_ORGANIZATION, PlatformController } from './platform.controller';

/**
 * Раздел «Платформа» (DATA_MODEL §16, ADR-083). Настоящие замок и автор запроса, подставное хранилище. Открыт только
 * главному администратору; владелец организации и служебный ключ его не открывают.
 */
const ORG = '5d2f1a9e-8c7b-4e3a-a1f0-6b9c2d4e8f00';
const ADMIN = '0b6c3c1e-4f4e-4a53-9b7e-2f1d7a9c0a11';
const OWNER = '1c7d4d2f-5a5f-4b64-8c8f-3a2e8b0d1b22';
const SERVICE_KEY = 'platform-test-service-key-0123456789';

class FakeExtensions implements ExtensionsRepository {
  orgs: OrganizationSummary[] = [];
  saved: Array<{ organizationId: string; change: ExtensionChange; by: string | null }> = [];
  async aiSeller(organizationId: string) {
    return this.orgs.find((o) => o.id === organizationId)?.aiSeller ?? null;
  }
  async organizations() {
    return this.orgs;
  }
  async organization(id: string) {
    return this.orgs.find((o) => o.id === id) ?? null;
  }
  async saveAiSeller(input: { organizationId: string; change: ExtensionChange; by: string | null; now: Date }) {
    this.saved.push({ organizationId: input.organizationId, change: input.change, by: input.by });
    const org = this.orgs.find((o) => o.id === input.organizationId)!;
    org.aiSeller = { ...input.change, updatedAt: input.now };
  }
}

const repo = new FakeExtensions();
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
            user: { ...who, organizationId: ORG, email: `${who.id.slice(0, 4)}@example.invalid`, name: null },
            organization: null,
            expiresAt: '2026-09-26T00:00:00.000Z',
          }
        : null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [PlatformController],
    providers: [
      { provide: EXTENSIONS_REPOSITORY, useValue: repo },
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
  vi.stubEnv('SERVICE_API_KEY', SERVICE_KEY);
  repo.saved = [];
  repo.orgs = [
    {
      id: ORG,
      name: 'Хостел «Пример»',
      status: 'TRIAL',
      trialEndsAt: new Date('2026-10-02T00:00:00.000Z'),
      createdAt: new Date('2026-09-25T00:00:00.000Z'),
      members: 2,
      owners: ['vladelec@example.invalid'],
      aiSeller: null,
    },
  ];
});

const api = () => request(app.getHttpServer());
const as = (session: string) => ({ 'x-wetop-session': session });

describe('раздел «Платформа» — только главный администратор', () => {
  it('владелец организации получает 403 и на список, и на изменение', async () => {
    const list = await api().get('/platform/organizations').set(as('session-owner')).expect(403);
    expect(list.body.message).toBe(PLATFORM_ADMIN_ONLY);
    await api()
      .put(`/platform/organizations/${ORG}/extensions/ai-seller`)
      .set(as('session-owner'))
      .send({ status: 'ACTIVE' })
      .expect(403);
    expect(repo.saved).toHaveLength(0);
  });

  it('служебный ключ раздел не открывает: он не человек и не главный администратор', async () => {
    await api().get('/platform/organizations').set('x-wetop-service-key', SERVICE_KEY).expect(403);
  });

  it('без входа — 401 от замка', async () => {
    await api().get('/platform/organizations').expect(401);
  });

  it('главному администратору — организации без броней и гостей: название, сроки, люди, владельцы, расширение', async () => {
    const res = await api().get('/platform/organizations').set(as('session-admin')).expect(200);
    expect(res.body.items).toEqual([
      {
        id: ORG,
        name: 'Хостел «Пример»',
        status: 'TRIAL',
        trialEndsAt: '2026-10-02T00:00:00.000Z',
        createdAt: '2026-09-25T00:00:00.000Z',
        members: 2,
        owners: ['vladelec@example.invalid'],
        aiSeller: { access: 'off', status: null, activeUntil: null, daysLeft: null, note: null, updatedAt: null },
      },
    ]);
  });
});

describe('включение «ИИ-продавца» главным администратором (Q-183)', () => {
  it('оплачен бессрочно с номером счёта: записано с автором, в ответе — «действует»', async () => {
    const res = await api()
      .put(`/platform/organizations/${ORG}/extensions/ai-seller`)
      .set(as('session-admin'))
      .send({ status: 'ACTIVE', activeUntil: '', note: 'счёт №12' })
      .expect(200);
    expect(repo.saved).toEqual([
      { organizationId: ORG, change: { status: 'ACTIVE', activeUntil: null, note: 'счёт №12' }, by: ADMIN },
    ]);
    expect(res.body.aiSeller).toMatchObject({ access: 'active', status: 'ACTIVE', note: 'счёт №12' });
  });

  it('пробный без срока — 400 словами домена, ничего не записано', async () => {
    const res = await api()
      .put(`/platform/organizations/${ORG}/extensions/ai-seller`)
      .set(as('session-admin'))
      .send({ status: 'TRIAL' })
      .expect(400);
    expect(res.body.message).toBe('У пробного доступа нужен срок');
    expect(repo.saved).toHaveLength(0);
  });

  it('неизвестная организация — 404; не идентификатор — 400', async () => {
    const res = await api()
      .put('/platform/organizations/7a1c2b3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d/extensions/ai-seller')
      .set(as('session-admin'))
      .send({ status: 'OFF' })
      .expect(404);
    expect(res.body.message).toBe(PLATFORM_NO_ORGANIZATION);
    await api()
      .put('/platform/organizations/abc/extensions/ai-seller')
      .set(as('session-admin'))
      .send({ status: 'OFF' })
      .expect(400);
  });
});
