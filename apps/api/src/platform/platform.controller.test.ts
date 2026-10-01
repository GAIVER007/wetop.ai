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
import { ExtensionsService } from './extensions.service';
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
  statuses: Array<{ organizationId: string; status: string; note: string | null; by: string | null }> = [];
  async saveStatus(input: {
    organizationId: string;
    status: 'ACTIVE' | 'READ_ONLY';
    note: string | null;
    by: string | null;
    now: Date;
  }) {
    this.statuses.push({ organizationId: input.organizationId, status: input.status, note: input.note, by: input.by });
    this.orgs.find((o) => o.id === input.organizationId)!.status = input.status;
  }
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
      // настоящая служба поверх подставного хранилища: смена расширения зовёт её слушателей (Э4)
      ExtensionsService,
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
  repo.statuses = [];
  repo.orgs = [
    {
      id: ORG,
      name: 'Хостел «Пример»',
      status: 'TRIAL',
      trialEndsAt: new Date('2026-10-02T00:00:00.000Z'),
      createdAt: new Date('2026-09-25T00:00:00.000Z'),
      members: 2,
      owners: ['vladelec@example.invalid'],
      businesses: 1,
      locations: 2,
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
        // структура партнёра, счётчики, без содержимого филиалов (Platform P3)
        businesses: 1,
        locations: 2,
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

/**
 * Оплата счётом (Q-141 — А, ADR-102): клиент платит по реквизитам, главный администратор вручную подтверждает оплату —
 * организация становится `ACTIVE` и снова пишет; обратно — «только чтение». Изменение идёт в журнал.
 */
describe('статус организации: подтверждение оплаты', () => {
  it('главный администратор подтверждает оплату — ACTIVE, с автором и заметкой', async () => {
    const res = await api()
      .put(`/platform/organizations/${ORG}/status`)
      .set(as('session-admin'))
      .send({ status: 'ACTIVE', note: 'Счёт №12 оплачен' })
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(repo.statuses).toEqual([
      { organizationId: ORG, status: 'ACTIVE', note: 'Счёт №12 оплачен', by: ADMIN },
    ]);
  });

  it('и переводит обратно в «только чтение»', async () => {
    await api().put(`/platform/organizations/${ORG}/status`).set(as('session-admin')).send({ status: 'READ_ONLY' }).expect(200);
    expect(repo.statuses[0]).toMatchObject({ status: 'READ_ONLY', note: null });
  });

  it('другие статусы отсюда не ставятся: приостановка и пробный — не оплата', async () => {
    for (const status of ['SUSPENDED', 'TRIAL', 'active', '']) {
      await api().put(`/platform/organizations/${ORG}/status`).set(as('session-admin')).send({ status }).expect(400);
    }
    expect(repo.statuses).toHaveLength(0);
  });

  it('владелец организации сам себе оплату не подтверждает — 403', async () => {
    await api().put(`/platform/organizations/${ORG}/status`).set(as('session-owner')).send({ status: 'ACTIVE' }).expect(403);
    expect(repo.statuses).toHaveLength(0);
  });

  it('нет такой организации — 404', async () => {
    await api()
      .put('/platform/organizations/9e9e9e9e-8c7b-4e3a-a1f0-6b9c2d4e8f00/status')
      .set(as('session-admin'))
      .send({ status: 'ACTIVE' })
      .expect(404);
  });
});
