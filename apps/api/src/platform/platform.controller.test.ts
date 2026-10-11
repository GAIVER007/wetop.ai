import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, type INestApplication } from '@nestjs/common';
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
import { OrganizationCreation, type OrganizationCreateInput } from './organization-creation';
import { SiteBuilderLicenses } from './site-builder-licenses';
import {
  PLATFORM_ADMIN_ONLY,
  PLATFORM_ALREADY_ARCHIVED,
  PLATFORM_NAME_MESSAGE,
  PLATFORM_NOT_ARCHIVED,
  PLATFORM_NO_ORGANIZATION,
  PLATFORM_OWN_ORGANIZATION,
  PLATFORM_OWNER_EMAIL_MESSAGE,
  PlatformController,
} from './platform.controller';

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
  renamed: Array<{ organizationId: string; name: string; by: string | null }> = [];
  archived: Array<{ organizationId: string; by: string | null }> = [];
  restored: Array<{ organizationId: string; status: string; by: string | null }> = [];
  /** статус до архива: так хранилище помнит, куда возвращать (в настоящем он лежит в журнале) */
  before = new Map<string, OrganizationSummary['status']>();
  async rename(input: { organizationId: string; name: string; by: string | null; now: Date }) {
    this.renamed.push({ organizationId: input.organizationId, name: input.name, by: input.by });
    this.orgs.find((o) => o.id === input.organizationId)!.name = input.name;
  }
  async archive(input: { organizationId: string; by: string | null; now: Date }) {
    this.archived.push({ organizationId: input.organizationId, by: input.by });
    const org = this.orgs.find((o) => o.id === input.organizationId)!;
    this.before.set(org.id, org.status);
    org.status = 'SUSPENDED';
  }
  async restore(input: { organizationId: string; by: string | null; now: Date }) {
    const org = this.orgs.find((o) => o.id === input.organizationId)!;
    org.status = this.before.get(org.id) ?? 'READ_ONLY';
    this.restored.push({ organizationId: org.id, status: org.status, by: input.by });
  }
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
  /** Сырьё обзора — из тех же организаций, что и список; людей в хранилище нет, числа заданы прямо */
  async overviewSource() {
    return {
      organizations: this.orgs.map((o) => ({
        status: o.status,
        createdAt: o.createdAt,
        businesses: o.verticals.map((vertical) => ({ vertical, createdAt: o.createdAt })),
      })),
      usersTotal: 5,
      activeUsers: 2,
    };
  }
}

const repo = new FakeExtensions();

/** Создание организации (ORG2): подставная служба. Настоящая проверена на PostgreSQL в tests/integration */
const NEW_ORG = '3b5d7f9a-2c4e-4a6b-8d0f-1a3c5e7a9b2d';
class FakeCreation {
  created: OrganizationCreateInput[] = [];
  links: string[] = [];
  failWith: Error | null = null;
  sent = true;
  async create(input: OrganizationCreateInput) {
    if (this.failWith) throw this.failWith;
    this.created.push(input);
    repo.orgs.push({
      id: NEW_ORG,
      name: input.name,
      status: 'TRIAL',
      trialEndsAt: new Date('2026-10-23T00:00:00.000Z'),
      createdAt: new Date('2026-10-09T00:00:00.000Z'),
      members: 1,
      owners: [input.ownerEmail],
      ownerPending: true,
      verticals: [input.vertical],
      locations: 1,
      aiSeller: null,
    });
    return { organizationId: NEW_ORG, ownerLinkSent: this.sent };
  }
  async resendOwnerLink(organizationId: string) {
    if (this.failWith) throw this.failWith;
    this.links.push(organizationId);
    return { ownerLinkSent: this.sent };
  }
}
const creation = new FakeCreation();

/** Лицензии конструктора сайта (MKT9.2): один гостиничный филиал организации, запись только в памяти */
const LOCATION = '7e3a1c2b-9d4f-4e5a-8b6c-0a1b2c3d4e5f';
class FakeLicenses {
  saved: Array<{ locationId: string; change: ExtensionChange; by: string | null }> = [];
  row = () => ({
    id: LOCATION,
    name: 'Филиал «Центр»',
    status: 'ACTIVE',
    business: { name: 'Хостел «Пример»' },
    marketingSite: null,
    siteBuilderEntitlement: this.saved.length
      ? { ...this.saved.at(-1)!.change, updatedAt: new Date('2026-10-08T00:00:00.000Z') }
      : null,
  });
  async locations(organizationId: string) {
    return organizationId === ORG ? [this.row()] : [];
  }
  async location(organizationId: string, locationId: string) {
    return organizationId === ORG && locationId === LOCATION ? this.row() : null;
  }
  async save(input: { locationId: string; change: ExtensionChange; by: string | null }) {
    this.saved.push({ locationId: input.locationId, change: input.change, by: input.by });
  }
}
const licenses = new FakeLicenses();
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
      { provide: SiteBuilderLicenses, useValue: licenses },
      { provide: OrganizationCreation, useValue: creation },
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
  repo.renamed = [];
  repo.archived = [];
  repo.restored = [];
  repo.before.clear();
  creation.created = [];
  creation.links = [];
  creation.failWith = null;
  creation.sent = true;
  licenses.saved = [];
  repo.orgs = [
    {
      id: ORG,
      name: 'Хостел «Пример»',
      status: 'TRIAL',
      trialEndsAt: new Date('2026-10-02T00:00:00.000Z'),
      createdAt: new Date('2026-09-25T00:00:00.000Z'),
      members: 2,
      owners: ['vladelec@example.invalid'],
      ownerPending: false,
      verticals: ['HOSPITALITY'],
      locations: 1,
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
        ownerPending: false,
        verticals: ['HOSPITALITY'],
        locations: 1,
        aiSeller: { access: 'off', status: null, activeUntil: null, daysLeft: null, note: null, updatedAt: null },
      },
    ]);
  });
});

describe('обзор платформы (срез P1, план platform-superadmin-2026-10-10)', () => {
  it('владелец организации обзор не видит: 403; без входа 401', async () => {
    const res = await api().get('/platform/overview').set(as('session-owner')).expect(403);
    expect(res.body.message).toBe(PLATFORM_ADMIN_ONLY);
    await api().get('/platform/overview').expect(401);
  });

  it('главному администратору — итоги, рост за 12 месяцев, направления и статусы; денег в ответе нет', async () => {
    const res = await api().get('/platform/overview').set(as('session-admin')).expect(200);
    expect(res.body.totals).toMatchObject({
      organizations: 1,
      trial: 1,
      active: 0,
      suspended: 0,
      usersTotal: 5,
      activeUsers: 2,
    });
    expect(res.body.growth).toHaveLength(12);
    expect(res.body.growth.at(-1).total).toBe(1);
    expect(res.body.verticals).toEqual([{ vertical: 'HOSPITALITY', organizations: 1 }]);
    expect(res.body.statuses).toEqual([{ status: 'TRIAL', organizations: 1 }]);
    // платежи платформе не ведутся (ADR-102): ни MRR, ни «просрочено» в ответе нет
    expect(JSON.stringify(res.body)).not.toMatch(/mrr|overdue/i);
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

describe('лицензия конструктора сайта филиала (MKT9.2)', () => {
  it('владелец организации не видит и не выдаёт себе лицензию: 403, ничего не записано', async () => {
    await api().get(`/platform/organizations/${ORG}/site-builder`).set(as('session-owner')).expect(403);
    await api()
      .put(`/platform/organizations/${ORG}/site-builder/${LOCATION}`)
      .set(as('session-owner'))
      .send({ status: 'ACTIVE' })
      .expect(403);
    expect(licenses.saved).toHaveLength(0);
  });

  it('главный администратор активирует: записано с автором, ответ «действует»', async () => {
    const list = await api().get(`/platform/organizations/${ORG}/site-builder`).set(as('session-admin')).expect(200);
    expect(list.body.items[0].license.status).toBeNull();
    const res = await api()
      .put(`/platform/organizations/${ORG}/site-builder/${LOCATION}`)
      .set(as('session-admin'))
      .send({ status: 'ACTIVE', note: 'Счёт 42' })
      .expect(200);
    expect(licenses.saved).toEqual([{ locationId: LOCATION, change: expect.objectContaining({ status: 'ACTIVE' }), by: ADMIN }]);
    expect(res.body.license.status).toBe('ACTIVE');
  });

  it('пробный без срока: 400; чужой филиал: 404; ничего не записано', async () => {
    await api()
      .put(`/platform/organizations/${ORG}/site-builder/${LOCATION}`)
      .set(as('session-admin'))
      .send({ status: 'TRIAL' })
      .expect(400);
    await api()
      .put(`/platform/organizations/${ORG}/site-builder/${ADMIN}`)
      .set(as('session-admin'))
      .send({ status: 'ACTIVE' })
      .expect(404);
    expect(licenses.saved).toHaveLength(0);
  });
});

/**
 * Название, архив и возврат организации (ORG1, ADR-ORG1). «Удалить» заменено архивом: организация получает статус
 * `SUSPENDED`, её люди не входят, данные целы; возврат ставит прежний статус. Свою организацию в архив убрать нельзя:
 * главный администратор потерял бы доступ. Всё пишется в журнал с автором.
 */
const OTHER = '2a4b6c8d-1e3f-4a5b-9c7d-8e0f1a2b3c4d';
describe('организация: название, архив и возврат', () => {
  beforeEach(() => {
    repo.orgs.push({
      id: OTHER,
      name: 'Гостиница «Север»',
      status: 'ACTIVE',
      trialEndsAt: null,
      createdAt: new Date('2026-09-26T00:00:00.000Z'),
      members: 1,
      owners: ['sever@example.invalid'],
      ownerPending: false,
      verticals: ['HOSPITALITY'],
      locations: 1,
      aiSeller: null,
    });
  });

  it('переименование: пробелы сжаты, записано с автором, в ответе новое название', async () => {
    const res = await api()
      .patch(`/platform/organizations/${OTHER}`)
      .set(as('session-admin'))
      .send({ name: '  Гостиница   «Север 2»  ' })
      .expect(200);
    expect(res.body.name).toBe('Гостиница «Север 2»');
    expect(repo.renamed).toEqual([{ organizationId: OTHER, name: 'Гостиница «Север 2»', by: ADMIN }]);
  });

  it('то же название: ответ 200, лишней записи в журнале нет', async () => {
    await api().patch(`/platform/organizations/${OTHER}`).set(as('session-admin')).send({ name: ' Гостиница «Север» ' }).expect(200);
    expect(repo.renamed).toHaveLength(0);
  });

  it('пустое, слишком длинное и не строка: 400, ничего не записано', async () => {
    for (const name of ['', '   ', 'я'.repeat(201), 42, null]) {
      await api().patch(`/platform/organizations/${OTHER}`).set(as('session-admin')).send({ name }).expect(400);
    }
    await api().patch(`/platform/organizations/${OTHER}`).set(as('session-admin')).send({}).expect(400);
    expect(repo.renamed).toHaveLength(0);
  });

  it('переименовывает только главный администратор; нет такой — 404; не идентификатор — 400', async () => {
    await api().patch(`/platform/organizations/${OTHER}`).set(as('session-owner')).send({ name: 'Х' }).expect(403);
    await api().patch('/platform/organizations/9e9e9e9e-8c7b-4e3a-a1f0-6b9c2d4e8f00').set(as('session-admin')).send({ name: 'Х' }).expect(404);
    await api().patch('/platform/organizations/abc').set(as('session-admin')).send({ name: 'Х' }).expect(400);
    expect(repo.renamed).toHaveLength(0);
  });

  it('архив: статус SUSPENDED, автор записан, организация остаётся в списке', async () => {
    const res = await api().post(`/platform/organizations/${OTHER}/archive`).set(as('session-admin')).expect(201);
    expect(res.body.status).toBe('SUSPENDED');
    expect(repo.archived).toEqual([{ organizationId: OTHER, by: ADMIN }]);
    const list = await api().get('/platform/organizations').set(as('session-admin')).expect(200);
    expect(list.body.items.find((o: { id: string }) => o.id === OTHER).status).toBe('SUSPENDED');
  });

  it('свою организацию в архив убрать нельзя: 409, статус не тронут', async () => {
    const res = await api().post(`/platform/organizations/${ORG}/archive`).set(as('session-admin')).expect(409);
    expect(res.body.message).toBe(PLATFORM_OWN_ORGANIZATION);
    expect(repo.archived).toHaveLength(0);
    expect(repo.orgs.find((o) => o.id === ORG)!.status).toBe('TRIAL');
  });

  it('уже в архиве — 409; нет такой — 404; владелец — 403', async () => {
    await api().post(`/platform/organizations/${OTHER}/archive`).set(as('session-admin')).expect(201);
    const again = await api().post(`/platform/organizations/${OTHER}/archive`).set(as('session-admin')).expect(409);
    expect(again.body.message).toBe(PLATFORM_ALREADY_ARCHIVED);
    await api().post('/platform/organizations/9e9e9e9e-8c7b-4e3a-a1f0-6b9c2d4e8f00/archive').set(as('session-admin')).expect(404);
    await api().post(`/platform/organizations/${OTHER}/archive`).set(as('session-owner')).expect(403);
    expect(repo.archived).toHaveLength(1);
  });

  it('возврат ставит прежний статус, а не «оплачено»', async () => {
    repo.orgs.find((o) => o.id === OTHER)!.status = 'TRIAL';
    await api().post(`/platform/organizations/${OTHER}/archive`).set(as('session-admin')).expect(201);
    const res = await api().post(`/platform/organizations/${OTHER}/restore`).set(as('session-admin')).expect(201);
    expect(res.body.status).toBe('TRIAL');
    expect(repo.restored).toEqual([{ organizationId: OTHER, status: 'TRIAL', by: ADMIN }]);
  });

  it('прежний статус не найден: возврат в «только чтение», платный доступ сам не появляется', async () => {
    repo.orgs.find((o) => o.id === OTHER)!.status = 'SUSPENDED';
    const res = await api().post(`/platform/organizations/${OTHER}/restore`).set(as('session-admin')).expect(201);
    expect(res.body.status).toBe('READ_ONLY');
  });

  it('вернуть из архива можно только организацию из архива: иначе 409; владелец — 403', async () => {
    const res = await api().post(`/platform/organizations/${OTHER}/restore`).set(as('session-admin')).expect(409);
    expect(res.body.message).toBe(PLATFORM_NOT_ARCHIVED);
    repo.orgs.find((o) => o.id === OTHER)!.status = 'SUSPENDED';
    await api().post(`/platform/organizations/${OTHER}/restore`).set(as('session-owner')).expect(403);
    expect(repo.restored).toHaveLength(0);
  });
});

/**
 * Создание организации главным администратором (ORG2, ADR-ORG2, Q-283): организация, первый филиал и владелец без
 * пароля одной транзакцией, владельцу уходит ссылка «задайте пароль». Токен наружу не отдаётся. Настоящая служба
 * проверена на PostgreSQL (`tests/integration/platform-organization-create.test.ts`), здесь контракт контроллера.
 */
describe('создание организации', () => {
  it('главный администратор создаёт: 201, название и почта приведены к одному виду, автор записан', async () => {
    const res = await api()
      .post('/platform/organizations')
      .set(as('session-admin'))
      .send({ name: '  Хостел   «Новый»  ', ownerEmail: '  Vladelec.NEW@Example.invalid ' })
      .expect(201);
    expect(creation.created).toEqual([
      { name: 'Хостел «Новый»', ownerEmail: 'vladelec.new@example.invalid', vertical: 'HOSPITALITY', by: ADMIN },
    ]);
    expect(res.body.ownerLinkSent).toBe(true);
    expect(res.body.organization).toMatchObject({
      id: NEW_ORG,
      name: 'Хостел «Новый»',
      status: 'TRIAL',
      owners: ['vladelec.new@example.invalid'],
      ownerPending: true,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/token|link=|password/i);
  });

  it('направление салона принимается; письмо не ушло — организация создана, ownerLinkSent false', async () => {
    creation.sent = false;
    const res = await api()
      .post('/platform/organizations')
      .set(as('session-admin'))
      .send({ name: 'Салон «Лотос»', ownerEmail: 'lotos@example.invalid', vertical: 'BEAUTY' })
      .expect(201);
    expect(creation.created[0]).toMatchObject({ vertical: 'BEAUTY' });
    expect(res.body.ownerLinkSent).toBe(false);
  });

  it('пустое, слишком длинное и не строка: 400 словами названия, ничего не создано', async () => {
    for (const name of ['', '   ', 'я'.repeat(201), 42, null, undefined]) {
      const res = await api()
        .post('/platform/organizations')
        .set(as('session-admin'))
        .send({ name, ownerEmail: 'a@example.invalid' })
        .expect(400);
      expect(res.body.message).toBe(PLATFORM_NAME_MESSAGE);
    }
    expect(creation.created).toHaveLength(0);
  });

  it('почта владельца не адрес и неизвестное направление: 400, ничего не создано', async () => {
    for (const ownerEmail of ['', 'без-собаки', 'a@', 7, undefined]) {
      const res = await api()
        .post('/platform/organizations')
        .set(as('session-admin'))
        .send({ name: 'Х', ownerEmail })
        .expect(400);
      expect(res.body.message).toBe(PLATFORM_OWNER_EMAIL_MESSAGE);
    }
    await api()
      .post('/platform/organizations')
      .set(as('session-admin'))
      .send({ name: 'Х', ownerEmail: 'a@example.invalid', vertical: 'SPACE' })
      .expect(400);
    expect(creation.created).toHaveLength(0);
  });

  it('отказ службы (почта занята, направление только для пилота) идёт наружу её словами', async () => {
    creation.failWith = new ConflictException('Эта почта уже зарегистрирована');
    const res = await api()
      .post('/platform/organizations')
      .set(as('session-admin'))
      .send({ name: 'Х', ownerEmail: 'a@example.invalid' })
      .expect(409);
    expect(res.body.message).toBe('Эта почта уже зарегистрирована');
  });

  it('владелец организации не создаёт чужие организации: 403; без входа 401', async () => {
    await api().post('/platform/organizations').set(as('session-owner')).send({ name: 'Х', ownerEmail: 'a@example.invalid' }).expect(403);
    await api().post('/platform/organizations').send({ name: 'Х', ownerEmail: 'a@example.invalid' }).expect(401);
    expect(creation.created).toHaveLength(0);
  });

  it('ссылка владельцу ещё раз: 201 и в ответе только ownerLinkSent; нет такой организации 404; не идентификатор 400', async () => {
    const res = await api().post(`/platform/organizations/${ORG}/owner-link`).set(as('session-admin')).expect(201);
    expect(res.body).toMatchObject({ ownerLinkSent: true, organization: { id: ORG } });
    expect(creation.links).toEqual([ORG]);
    await api().post('/platform/organizations/9e9e9e9e-8c7b-4e3a-a1f0-6b9c2d4e8f00/owner-link').set(as('session-admin')).expect(404);
    await api().post('/platform/organizations/abc/owner-link').set(as('session-admin')).expect(400);
    expect(creation.links).toHaveLength(1);
  });

  it('ссылку владельцу выдаёт только главный администратор; отказ службы идёт наружу', async () => {
    await api().post(`/platform/organizations/${ORG}/owner-link`).set(as('session-owner')).expect(403);
    expect(creation.links).toHaveLength(0);
    creation.failWith = new ConflictException('Владелец уже задал пароль');
    const res = await api().post(`/platform/organizations/${ORG}/owner-link`).set(as('session-admin')).expect(409);
    expect(res.body.message).toBe('Владелец уже задал пароль');
  });
});
