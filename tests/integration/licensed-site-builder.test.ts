import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { SiteBriefInput } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { BRIEF_CHANNEX_READER } from '../../apps/api/src/marketing-site/brief.service';
import { GENERATION_BOT, type AssistantBotRequest } from '../../apps/api/src/marketing-site/generation.bot';
import { SiteGenerationWorker } from '../../apps/api/src/marketing-site/generation.worker';
import { MemorySiteAssetStorage, SITE_ASSET_STORAGE } from '../../apps/api/src/marketing-site/asset-storage';
import { PlatformModule } from '../../apps/api/src/platform/platform.module';
import { SiteBuilderLicenses } from '../../apps/api/src/platform/site-builder-licenses';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';
import { grantSiteBuilder, purgeSiteBuilderRows } from '../tools/site-builder';

/**
 * MKT9.2 на настоящей базе: лицензия конструктора филиала закрывает всю запись и весь ИИ сайта (403 без неё, чтение
 * открыто), заведение сайта с пустым телом, знания проекта, разговор (Чат, План, Оформление) без версий, одобрение плана
 * ровно одной сборкой, общие правила ИИ по обеим таблицам (одна активная задача, предел часа, общий пул), воркер
 * перепроверяет лицензию перед платным вызовом, закладки, выдача лицензии только главным администратором платформы.
 * Бот подставной: тест видит, что ему ушло, и задаёт ответ.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;
const usage = (input = 900, output = 300) => ({ input, output, cached: null, complete: true, paidCalls: 1 });

function specFor(input: SiteBriefInput, heading = 'Первый экран'): Spec {
  const t = (text: string) => ({ ru: text });
  const codes = input.accommodations.map((a) => a.categoryCode);
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t(input.identity.displayNameCandidate),
      defaultLocale: 'ru',
      locales: ['ru'],
      seo: { robots: 'INDEX', structuredData: { type: 'HOTEL', includeAddress: false, includeGeo: false } },
    },
    theme: { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    navigation: { header: [], footer: [] },
    pages: [
      {
        id: 'page-home',
        slug: '',
        isHome: true,
        title: t(input.identity.displayNameCandidate),
        seo: { title: t('Гостиница'), description: t('Гостиница'), index: true, includeInSitemap: true, canonical: 'SELF' },
        sections: [
          { id: 'sec-hero', type: 'hero', variant: 'TEXT_ONLY', heading: t(heading), primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } },
          { id: 'sec-about', type: 'about', variant: 'TEXT_ONLY', heading: t('О нас'), paragraphs: [t('Гостиница у вокзала.')] },
          { id: 'sec-rooms', type: 'accommodations', variant: 'CARDS', heading: t('Номера'), items: input.accommodations.map((a) => ({ categoryCode: a.categoryCode, title: t(a.name), description: t('Описание') })) },
          ...(codes.length ? [] : []),
          { id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t('Забронировать') },
        ],
      },
    ],
    integrations: { booking: { mode: 'WETOP_WIDGET' }, analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } },
  };
}

const direction = (id: string, preset = 'WARM') => ({
  id,
  name: `Направление ${id}`,
  shortDescription: 'Спокойно и тепло',
  theme: { preset, accent: 'TERRACOTTA', typography: 'CLASSIC', radius: 'ROUND', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
  heroVariant: 'TEXT_ONLY',
  sectionOrder: ['hero', 'accommodations', 'about', 'booking'],
});

type Reply = unknown | Error;
function fakeBot() {
  const state = { assistant: [] as AssistantBotRequest[], generate: [] as Array<Record<string, unknown>>, edit: [] as Array<Record<string, unknown>>, replies: [] as Reply[] };
  const next = () => {
    const r = state.replies.shift();
    if (r === undefined) throw new Error('fake bot: no scripted reply');
    if (r instanceof Error) throw r;
    return r;
  };
  return {
    state,
    bot: {
      async generate(request: Record<string, unknown>) {
        state.generate.push(structuredClone(request));
        return next();
      },
      async edit(request: Record<string, unknown>) {
        state.edit.push(structuredClone(request));
        return next();
      },
      async assistant(request: AssistantBotRequest) {
        state.assistant.push(structuredClone(request));
        return next();
      },
    },
  };
}

describe.skipIf(!url)('MKT9.2 licensed site builder', () => {
  let db: Db, sql: pg.Client, app: INestApplication, base: string, worker: SiteGenerationWorker;
  let platform: INestApplication, platformBase: string;
  const fake = fakeBot();
  const orgs: string[] = [];
  const users: string[] = [];
  const adminId = randomUUID();

  interface World {
    org: string;
    user: string;
    business: string;
    location: string;
    other: string;
    scope: string;
  }

  /** Организация с двумя гостиничными филиалами; лицензия только по запросу теста */
  async function world(license: 'none' | 'active' = 'active'): Promise<World> {
    const org = randomUUID(), user = randomUUID(), business = randomUUID(), location = randomUUID(), other = randomUUID(), property = randomUUID();
    orgs.push(org);
    users.push(user);
    await db.organization.create({ data: { id: org, name: 'MKT9.2 (synthetic)', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `mkt92-${user}@example.invalid`, passwordHash: 'x' } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' } });
    // имя филиала равно имени объекта: соседний набор Platform P1 сверяет их у всех объектов базы
    // порядок списка филиалов в API: `createdAt`, затем `id`. Без явного времени два `create` подряд иногда попадали в одну
    // миллисекунду, и порядок решал случайный uuid: тест краснел через раз (гейт на коммите 0fed8093). Время задаём руками
    const earlier = new Date(Date.now() - 60_000);
    await db.location.create({ data: { id: location, businessId: business, name: 'Luxx Aparts', timezone: 'Asia/Almaty', currency: 'KZT', createdAt: earlier } });
    await db.location.create({ data: { id: other, businessId: business, name: 'Marina', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.property.create({ data: { id: property, organizationId: org, locationId: location, name: 'Luxx Aparts', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' } });
    const cat = await db.accommodationType.create({ data: { propertyId: property, code: 'cat-a', name: 'Номер', kind: 'PRIVATE_ROOM', capacityAdults: 2 } });
    const building = await db.building.create({ data: { propertyId: property, name: 'К' } });
    const floor = await db.floor.create({ data: { buildingId: building.id, name: '1' } });
    const room = await db.physicalRoom.create({ data: { floorId: floor.id, roomNumber: '1', capacity: 2 } });
    await db.inventoryUnit.create({ data: { propertyId: property, physicalRoomId: room.id, accommodationTypeId: cat.id, kind: 'ROOM', code: 'A1' } });
    if (license === 'active') await grantSiteBuilder(db, location);
    return { org, user, business, location, other, scope: `business=${business};location=${location}` };
  }

  async function call(w: World, method: string, path: string, body?: unknown, extra: { scope?: string } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'x-test-user': w.user,
        'x-test-org': w.org,
        'x-wetop-scope': extra.scope ?? w.scope,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }

  const brief = async (w: World) => (await call(w, 'GET', '/marketing/site/brief')).body as { briefHash: string; input: SiteBriefInput };
  async function siteWithVersion(w: World) {
    expect((await call(w, 'POST', '/marketing/site/bootstrap', {})).status).toBe(201);
    const b = await brief(w);
    const saved = await call(w, 'POST', '/marketing/site/versions', { baseRevision: 0, spec: specFor(b.input) });
    expect(saved.status, saved.text).toBe(201);
    return { version: saved.body.version as { id: string; revision: number }, input: b.input };
  }
  const ask = (w: World, mode: string, text: string | undefined, requestKey = randomUUID(), extra: Record<string, unknown> = {}) =>
    call(w, 'POST', '/marketing/site/assistant', { requestKey, mode, ...(text === undefined ? {} : { text }), ...extra });
  const aiRun = (id: string) => db.siteAiRun.findUniqueOrThrow({ where: { id } });
  const genRun = (id: string) => db.generationRun.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await db.user.create({ data: { id: adminId, email: `mkt92-admin-${adminId}@example.invalid`, passwordHash: 'x' } });
    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(BRIEF_CHANNEX_READER)
      .useValue(null)
      .overrideProvider(GENERATION_BOT)
      .useValue(fake.bot)
      .overrideProvider(SITE_ASSET_STORAGE)
      .useValue(new MemorySiteAssetStorage())
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      req.user = { id: req.headers['x-test-user'], organizationId: req.headers['x-test-org'], role: req.headers['x-test-role'] ?? 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    worker = app.get(SiteGenerationWorker);

    const platformModule = await Test.createTestingModule({ imports: [PlatformModule] }).overrideProvider(PrismaService).useValue({ db }).compile();
    platform = platformModule.createNestApplication({ bodyParser: false });
    useApiBodyParsers(platform);
    platform.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      const admin = req.headers['x-test-admin'] === '1';
      req.user = { id: admin ? adminId : req.headers['x-test-user'], organizationId: req.headers['x-test-org'], role: 'OWNER', platformAdmin: admin };
      next();
    });
    platform.useGlobalGuards(new RoleGuard(new Reflector()));
    platform.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await platform.listen(0, '127.0.0.1');
    platformBase = await platform.getUrl();
  });

  afterEach(async () => {
    // незавершённые задачи теста не должны достаться воркеру следующего теста
    const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
      JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
    await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE status = 'QUEUED' AND site_id IN (${sites})`, [orgs]);
    await sql.query(`UPDATE generation_runs SET status = 'FAILED', error_code = 'TIMEOUT', finished_at = now() WHERE status = 'RUNNING' AND site_id IN (${sites})`, [orgs]);
    await sql.query(`UPDATE site_ai_runs SET status = 'FAILED', error_code = 'TIMEOUT', finished_at = now() WHERE status IN ('QUEUED', 'RUNNING') AND site_id IN (${sites})`, [orgs]);
    fake.state.assistant.length = 0;
    fake.state.generate.length = 0;
    fake.state.edit.length = 0;
    fake.state.replies.length = 0;
  });

  afterAll(async () => {
    await app?.close();
    await platform?.close();
    if (sql) {
      await purgeSiteBuilderRows(sql, orgs);
      const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      await sql.query('ALTER TABLE marketing_site_publications DISABLE TRIGGER marketing_site_publication_immutable');
      await sql.query('ALTER TABLE generation_runs DISABLE TRIGGER generation_run_guard');
      await sql.query(`DELETE FROM marketing_site_publications WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM site_domains WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL, tracked_site_id = NULL WHERE id IN (${sites})`, [orgs]);
      await sql.query(`UPDATE generation_runs SET output_version_id = NULL, base_version_id = NULL, status = 'CANCELLED', finished_at = now() WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`UPDATE marketing_site_versions SET parent_version_id = NULL, generation_run_id = NULL, source = 'MANUAL' WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM marketing_site_versions WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM generation_runs WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM marketing_sites WHERE id IN (${sites})`, [orgs]);
      await sql.query(
        `UPDATE locations SET booking_tracked_site_id = NULL WHERE business_id IN (SELECT id FROM businesses WHERE organization_id = ANY($1::uuid[]))`,
        [orgs],
      );
      await sql.query('ALTER TABLE generation_runs ENABLE TRIGGER generation_run_guard');
      await sql.query('ALTER TABLE marketing_site_publications ENABLE TRIGGER marketing_site_publication_immutable');
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await purgeAuditRows(db, { organizationId: { in: orgs } });
      await db.siteAsset.deleteMany({ where: { location: { business: { organizationId: { in: orgs } } } } });
      await db.trackedSite.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.ratePlan.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.inventoryUnit.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.physicalRoom.deleteMany({ where: { floor: { building: { property: { organizationId: { in: orgs } } } } } });
      await db.floor.deleteMany({ where: { building: { property: { organizationId: { in: orgs } } } } });
      await db.building.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.accommodationType.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.location.deleteMany({ where: { business: { organizationId: { in: orgs } } } });
      await db.business.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.user.deleteMany({ where: { id: { in: [...users, adminId] } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      expect(await db.organization.count({ where: { id: { in: orgs } } })).toBe(0);
      await db.$disconnect();
    }
  });

  describe('лицензия закрывает запись и ИИ, чтение открыто', () => {
    it('без лицензии: заведение сайта 403 SITE_BUILDER_NOT_ENABLED, сайт не появляется; чтение отвечает', async () => {
      const w = await world('none');
      const current = await call(w, 'GET', '/marketing/site');
      expect(current.status).toBe(200);
      expect(current.body).toMatchObject({ site: null, builder: { access: 'off', status: null }, locationName: 'Luxx Aparts' });
      const r = await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({ code: 'SITE_BUILDER_NOT_ENABLED', message: 'Конструктор сайта не подключён для этого филиала' });
      expect(await db.marketingSite.count({ where: { locationId: w.location } })).toBe(0);
    });

    it('лицензия выключена или срок вышел: каждая запись и каждый ИИ 403, чтение 200, пауза и архив не закрыты', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      for (const [status, until, code] of [
        ['OFF', null, 'SITE_BUILDER_NOT_ENABLED'],
        ['ACTIVE', new Date(Date.now() - 60_000), 'SITE_BUILDER_EXPIRED'],
        ['TRIAL', new Date(Date.now() - 60_000), 'SITE_BUILDER_EXPIRED'],
      ] as const) {
        await grantSiteBuilder(db, w.location, status, until);
        const writes: Array<[string, string, unknown]> = [
          ['POST', '/marketing/site/bootstrap', {}],
          ['POST', '/marketing/site/versions', { baseRevision: version.revision, spec: specFor((await brief(w)).input, 'Другой') }],
          ['POST', `/marketing/site/versions/${version.id}/restore`, { baseRevision: version.revision }],
          ['POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Короче' }],
          ['POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'CHAT', text: 'Привет' }],
          ['POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'PLAN', text: 'План' }],
          ['POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'DESIGN' }],
          ['PATCH', '/marketing/site/context', { instructions: 'Пиши коротко' }],
          ['PUT', `/marketing/site/versions/${version.id}/bookmark`, { label: 'Метка' }],
          ['POST', '/marketing/site/publish', { expectedVersionId: version.id }],
          ['POST', '/marketing/site/resume', {}],
          ['POST', '/marketing/site/rollback', { versionId: version.id }],
          ['POST', '/marketing/site/assets/channex/import', { photoIds: ['a'.repeat(64)] }],
        ];
        for (const [method, path, body] of writes) {
          const r = await call(w, method, path, body);
          expect(r.status, `${status} ${method} ${path}: ${r.text}`).toBe(403);
          expect(r.body.code, `${method} ${path}`).toBe(code);
        }
        for (const path of ['/marketing/site', '/marketing/site/draft', '/marketing/site/versions', '/marketing/site/conversation', '/marketing/site/context', '/marketing/site/brief'])
          expect((await call(w, 'GET', path)).status, path).toBe(200);
        expect((await call(w, 'GET', '/marketing/site')).body.builder.access).toBe(code === 'SITE_BUILDER_EXPIRED' ? 'expired' : 'off');
      }
      expect(await db.marketingSiteVersion.count({ where: { site: { locationId: w.location } } })).toBe(1);
      expect(await db.siteAiRun.count({ where: { site: { locationId: w.location } } })).toBe(0);
      // архив не тратит ИИ и не заводит нового: лицензия не нужна
      expect((await call(w, 'POST', '/marketing/site/archive', {})).status).toBe(200);
    });

    it('лицензия другого филиала той же организации не открывает этот филиал', async () => {
      const w = await world('none');
      await grantSiteBuilder(db, w.other);
      expect((await call(w, 'POST', '/marketing/site/bootstrap', {})).body.code).toBe('SITE_BUILDER_NOT_ENABLED');
      const other = await call(w, 'POST', '/marketing/site/bootstrap', {}, { scope: `business=${w.business};location=${w.other}` });
      expect(other.status).toBe(201);
      expect(other.body.site).toMatchObject({ name: 'Marina' });
    });
  });

  describe('заведение сайта и знания проекта', () => {
    it('bootstrap: 201 новый с именем филиала, 200 тот же, архив 409 SITE_ARCHIVED; второго сайта нет', async () => {
      const w = await world();
      const first = await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect(first.status).toBe(201);
      expect(first.body.site.name).toBe('Luxx Aparts');
      expect(first.body.site.slug).toMatch(/^luxx-aparts(-\d+)?$/);
      const again = await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect(again.status).toBe(200);
      expect(again.body.site.id).toBe(first.body.site.id);
      expect((await call(w, 'POST', '/marketing/site/archive', {})).status).toBe(200);
      const archived = await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect(archived.status).toBe(409);
      expect(archived.body.code).toBe('SITE_ARCHIVED');
      expect((await call(w, 'GET', '/marketing/site')).body).toMatchObject({ site: null, archived: true });
      expect(await db.marketingSite.count({ where: { locationId: w.location } })).toBe(1);
    });

    it('bootstrap одновременно: ровно одна строка; два филиала дают два разных сайта', async () => {
      const w = await world();
      await grantSiteBuilder(db, w.other);
      const otherScope = { scope: `business=${w.business};location=${w.other}` };
      const results = await Promise.all(Array.from({ length: 5 }, () => call(w, 'POST', '/marketing/site/bootstrap', {}, otherScope)));
      expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
      expect(new Set(results.map((r) => r.body.site.id)).size).toBe(1);
      expect(await db.marketingSite.count({ where: { locationId: w.other } })).toBe(1);
      const own = await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect(own.status).toBe(201);
      expect(own.body.site.id).not.toBe(results[0]!.body.site.id);
      expect(await db.marketingSite.count({ where: { locationId: { in: [w.location, w.other] } } })).toBe(2);
    });

    it('знания проекта: чтение, правка, предел 5000, в журнале только длина', async () => {
      const w = await world();
      await call(w, 'POST', '/marketing/site/bootstrap', {});
      expect((await call(w, 'GET', '/marketing/site/context')).body).toEqual({ instructions: null });
      const text = 'Пиши коротко, без восклицательных знаков';
      expect((await call(w, 'PATCH', '/marketing/site/context', { instructions: text })).body).toEqual({ instructions: text });
      expect((await call(w, 'GET', '/marketing/site')).body.instructions).toBe(text);
      expect((await call(w, 'PATCH', '/marketing/site/context', { instructions: 'я'.repeat(5001) })).status).toBe(400);
      expect((await call(w, 'PATCH', '/marketing/site/context', { instructions: 'x', siteId: randomUUID() })).status).toBe(400);
      const audit = await db.auditLog.findFirstOrThrow({ where: { organizationId: w.org, action: 'marketing.site.context_updated' } });
      expect(audit.after).toMatchObject({ length: [...text].length });
      expect(JSON.stringify(audit.after)).not.toContain('коротко');
    });
  });

  describe('разговор с ИИ: Чат, План, Оформление', () => {
    it('Чат: задача без версии, повтор ключа та же задача; боту уходят знания проекта и голова; разговор хранится на сервере', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      await call(w, 'PATCH', '/marketing/site/context', { instructions: 'Тон спокойный' });
      const key = randomUUID();
      const r = await ask(w, 'CHAT', 'Что можно улучшить на первом экране?', key);
      expect(r.status, r.text).toBe(202);
      expect(r.body.run).toMatchObject({ mode: 'CHAT', status: 'QUEUED', baseVersionId: version.id });
      expect((await ask(w, 'CHAT', 'Что можно улучшить на первом экране?', key)).status).toBe(200);
      fake.state.replies.push({ status: 'ok', result: { answer: 'Сделайте заголовок короче.', suggestBuild: true }, model: 'openai/a', usage: usage(400, 100) });
      await worker.tick();
      const sent = fake.state.assistant[0]!;
      expect(sent).toMatchObject({ schemaVersion: 'site-assistant/0', mode: 'CHAT', projectInstructions: 'Тон спокойный', userText: 'Что можно улучшить на первом экране?' });
      expect((sent.currentSpec as Spec).pages[0].sections[0].heading.ru).toBe('Первый экран');
      expect(Object.keys(sent).sort()).toEqual(
        ['briefInput', 'budgetRemainingTokens', 'currentSpec', 'history', 'mode', 'projectInstructions', 'requestId', 'schemaVersion', 'siteSpecSchemaVersion', 'userText', 'validationErrors'].sort(),
      );
      const done = await aiRun(r.body.run.id);
      expect(done).toMatchObject({ status: 'SUCCEEDED', assistantText: 'Сделайте заголовок короче.', tokensInput: 400, tokensOutput: 100 });
      expect(await db.marketingSiteVersion.count({ where: { site: { locationId: w.location } } })).toBe(1);
      const talk = await call(w, 'GET', '/marketing/site/conversation');
      expect(talk.body.items.map((i: { kind: string; userText: string }) => [i.kind, i.userText])).toEqual([['ASSISTANT', 'Что можно улучшить на первом экране?']]);
      expect(talk.body.items[0]).toMatchObject({ assistantText: 'Сделайте заголовок короче.', payload: { kind: 'CHAT', suggestBuild: true, suggestPublish: false } });
      // в журнале нет ни запроса, ни ответа
      const logs = await db.auditLog.findMany({ where: { organizationId: w.org, action: { startsWith: 'marketing.site.assistant' } } });
      expect(logs.length).toBe(2);
      expect(JSON.stringify(logs)).not.toContain('первом экране');
      expect(JSON.stringify(logs)).not.toContain('заголовок короче');
    });

    it('ответ, не прошедший проверку платформы, не сохраняется: повтор, затем FAILED SCHEMA_INVALID', async () => {
      const w = await world();
      await siteWithVersion(w);
      const r = await ask(w, 'CHAT', 'Привет');
      for (let i = 0; i < 3; i += 1) {
        fake.state.replies.push({ status: 'ok', result: { answer: 'x', html: '<b>bad</b>' }, model: 'openai/a', usage: usage(10, 10) });
        await sql.query(`UPDATE site_ai_runs SET next_attempt_at = now() - interval '1 second' WHERE id = $1 AND status = 'QUEUED'`, [r.body.run.id]);
        await worker.tick();
      }
      expect(await aiRun(r.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'SCHEMA_INVALID', assistantText: null, payload: null, tokensInput: 30 });
    });

    it('План: вопросы, ответы, план; «Собрать по плану» ставит ровно одну сборку PATCH, повтор отдаёт её же', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      const q = await ask(w, 'PLAN', 'Хочу сайт короче');
      fake.state.replies.push({
        status: 'ok',
        result: { kind: 'QUESTIONS', questions: [{ id: 'tone', question: 'Какой тон?', options: ['Строгий', 'Тёплый'], allowCustom: true }] },
        model: 'openai/a',
        usage: usage(100, 50),
      });
      await worker.tick();
      expect((await aiRun(q.body.run.id)).payload).toMatchObject({ kind: 'QUESTIONS' });
      expect((await call(w, 'POST', `/marketing/site/assistant/${q.body.run.id}/approve`, {})).status).toBe(404);

      const p = await ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: q.body.run.id, answers: [{ questionId: 'tone', answer: 'Тёплый' }] });
      expect(p.status, p.text).toBe(202);
      fake.state.replies.push({
        status: 'ok',
        result: {
          kind: 'PLAN',
          summary: 'Короче первый экран',
          affectedPages: ['page-home'],
          affectedSections: ['sec-hero'],
          steps: ['Сократить заголовок'],
          tradeoffs: [],
          buildInstruction: 'Сократи заголовок первого экрана, тон тёплый.',
        },
        model: 'openai/a',
        usage: usage(100, 50),
      });
      await worker.tick();
      expect(fake.state.assistant.at(-1)!.userText).toContain('tone: Тёплый');
      const approved = await call(w, 'POST', `/marketing/site/assistant/${p.body.run.id}/approve`, {});
      expect(approved.status, approved.text).toBe(202);
      expect(approved.body.run).toMatchObject({ type: 'PATCH', baseVersionId: version.id });
      const build = await genRun(approved.body.run.id);
      expect(build.requestKey).toBe(p.body.run.id);
      expect(build.instruction).toBe('Сократи заголовок первого экрана, тон тёплый.');
      const repeat = await call(w, 'POST', `/marketing/site/assistant/${p.body.run.id}/approve`, { instruction: 'Другое' });
      expect(repeat.status).toBe(200);
      expect(repeat.body.run.id).toBe(approved.body.run.id);
      expect(await db.generationRun.count({ where: { site: { locationId: w.location } } })).toBe(1);
      const talk = await call(w, 'GET', '/marketing/site/conversation');
      const buildItem = talk.body.items.find((i: { kind: string }) => i.kind === 'BUILD');
      expect(buildItem).toMatchObject({ fromPlanId: p.body.run.id, userText: 'Сократи заголовок первого экрана, тон тёплый.' });
    });

    it('план устарел: голова сменилась после плана, сборка по нему 409 BASE_VERSION_CHANGED', async () => {
      const w = await world();
      const { version, input } = await siteWithVersion(w);
      const p = await ask(w, 'PLAN', 'План');
      fake.state.replies.push({
        status: 'ok',
        result: { kind: 'PLAN', summary: 'Итог', affectedPages: [], affectedSections: [], steps: ['Шаг'], tradeoffs: [], buildInstruction: 'Сделай' },
        model: 'openai/a',
        usage: usage(10, 10),
      });
      await worker.tick();
      expect((await call(w, 'POST', '/marketing/site/versions', { baseRevision: version.revision, spec: specFor(input, 'Правка руками') })).status).toBe(201);
      const r = await call(w, 'POST', `/marketing/site/assistant/${p.body.run.id}/approve`, {});
      expect(r.status).toBe(409);
      expect(r.body.code).toBe('BASE_VERSION_CHANGED');
    });

    it('Оформление: три направления; первая сборка с выбранным ставит тему платформой, модели уходит описание', async () => {
      const w = await world();
      expect((await call(w, 'POST', '/marketing/site/bootstrap', {})).status).toBe(201);
      const d = await ask(w, 'DESIGN', undefined);
      expect(d.status, d.text).toBe(202);
      fake.state.replies.push({ status: 'ok', result: { directions: [direction('warm'), direction('night', 'NIGHT'), direction('coast', 'COAST')] }, model: 'openai/a', usage: usage(100, 50) });
      await worker.tick();
      expect((await aiRun(d.body.run.id)).payload).toMatchObject({ kind: 'DESIGN', directions: [{ id: 'warm' }, { id: 'night' }, { id: 'coast' }] });
      const b = await brief(w);
      const unknownDesign = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: b.briefHash, designRunId: d.body.run.id, designId: 'nope' });
      expect(unknownDesign.status).toBe(404);
      const r = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: b.briefHash, instruction: 'Акцент на тишину', designRunId: d.body.run.id, designId: 'night' });
      expect(r.status, r.text).toBe(202);
      fake.state.replies.push({ status: 'ok', spec: specFor(b.input), model: 'openai/a', usage: usage(1000, 300) });
      await worker.tick();
      expect(fake.state.generate[0]!['instruction']).toMatch(/Акцент на тишину[\s\S]*Направление night/);
      const done = await genRun(r.body.run.id);
      expect(done.status).toBe('SUCCEEDED');
      const v = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: done.outputVersionId! } });
      expect((v.spec as Spec).theme).toMatchObject({ preset: 'NIGHT', accent: 'TERRACOTTA', typography: 'CLASSIC' });
      const types = (v.spec as Spec).pages[0].sections.map((s: { type: string }) => s.type);
      expect(types.indexOf('accommodations')).toBeLessThan(types.indexOf('about'));
      // в разговоре у первой сборки только пожелания человека, без конверта
      const talk = await call(w, 'GET', '/marketing/site/conversation');
      expect(talk.body.items.find((i: { kind: string }) => i.kind === 'BUILD').userText).toBe('Акцент на тишину');
    });
  });

  describe('разговор помнит контекст: история только этого сайта и ответы на вопросы плана', () => {
    const chatReply = (answer: string) => ({ status: 'ok' as const, result: { answer, suggestBuild: false }, model: 'openai/a', usage: usage(100, 50) });
    const QUESTIONS = [
      { id: 'tone', question: 'Какой тон?', options: ['Спокойный', 'Яркий'], allowCustom: false },
      { id: 'audience', question: 'Для кого сайт?', options: ['Туристы', 'Бизнес-путешественники'], allowCustom: true },
    ];
    async function questionsRun(w: World, text = 'Сделай сайт более премиальным') {
      const q = await ask(w, 'PLAN', text);
      expect(q.status, q.text).toBe(202);
      fake.state.replies.push({ status: 'ok', result: { kind: 'QUESTIONS', questions: QUESTIONS }, model: 'openai/a', usage: usage(100, 50) });
      await worker.tick();
      expect((await aiRun(q.body.run.id)).status).toBe('SUCCEEDED');
      return q.body.run.id as string;
    }

    it('Чат: второй ход видит первый (вопрос и ответ), текущий запрос в историю не попадает', async () => {
      const w = await world();
      await siteWithVersion(w);
      await ask(w, 'CHAT', 'Предложи два варианта первого экрана');
      fake.state.replies.push(chatReply('1. Спокойный. 2. Более городской.'));
      await worker.tick();
      await ask(w, 'CHAT', 'Второй вариант сделай короче');
      fake.state.replies.push(chatReply('Короче: город рядом.'));
      await worker.tick();
      expect(fake.state.assistant[0]!.history).toEqual([]);
      expect(fake.state.assistant[1]!.history).toEqual([
        { mode: 'CHAT', userText: 'Предложи два варианта первого экрана', assistantText: '1. Спокойный. 2. Более городской.', payload: { kind: 'CHAT', suggestBuild: false, suggestPublish: false } },
      ]);
      expect(fake.state.assistant[1]!.userText).toBe('Второй вариант сделай короче');
    });

    it('три хода: на третьем (План) история это два прошлых хода по порядку; упавший ход и упавшая сборка не попадают, успешная сборка попадает', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      await ask(w, 'CHAT', 'Первый');
      fake.state.replies.push(chatReply('Ответ первый'));
      await worker.tick();
      await ask(w, 'CHAT', 'Упадёт');
      fake.state.replies.push({ status: 'error', errorCode: 'REJECTED_CONTENT', model: null, usage: usage(10, 0) });
      await worker.tick();
      const bad = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Сборка, которая упадёт' });
      expect(bad.status, bad.text).toBe(202);
      fake.state.replies.push({ status: 'error', errorCode: 'REJECTED_CONTENT', model: null, usage: usage(10, 0) });
      await worker.tick();
      const good = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Заголовок короче' });
      expect(good.status, good.text).toBe(202);
      const b = await brief(w);
      fake.state.replies.push({ status: 'ok', spec: specFor(b.input, 'Короткий'), model: 'openai/a', usage: usage(100, 50) });
      await worker.tick();
      expect((await genRun(good.body.run.id)).status).toBe('SUCCEEDED');
      await ask(w, 'CHAT', 'Второй');
      fake.state.replies.push(chatReply('Ответ второй'));
      await worker.tick();
      await ask(w, 'PLAN', 'Третий');
      fake.state.replies.push({ status: 'ok', result: { kind: 'QUESTIONS', questions: QUESTIONS }, model: 'openai/a', usage: usage(100, 50) });
      await worker.tick();
      const third = fake.state.assistant.at(-1)!;
      expect(third.userText).toBe('Третий');
      expect(third.history.map((h) => [h.mode, h.userText, h.assistantText])).toEqual([
        ['CHAT', 'Первый', 'Ответ первый'],
        ['BUILD', 'Заголовок короче', 'Изменение применено к сайту'],
        ['CHAT', 'Второй', 'Ответ второй'],
      ]);
      expect(JSON.stringify(third.history)).not.toMatch(/Упадёт|Сборка, которая упадёт/);
    });

    it('граница: история только этого сайта; другой филиал, журнал и чужая организация в неё не попадают', async () => {
      const w = await world();
      await siteWithVersion(w);
      await grantSiteBuilder(db, w.other);
      const otherScope = { scope: `business=${w.business};location=${w.other}` };
      expect((await call(w, 'POST', '/marketing/site/bootstrap', {}, otherScope)).status).toBe(201);
      const stranger = await world();
      await siteWithVersion(stranger);
      await ask(w, 'CHAT', 'SENTINEL-SITE-A');
      fake.state.replies.push(chatReply('ответ A'));
      await worker.tick();
      await call(w, 'POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'CHAT', text: 'SENTINEL-SITE-B' }, otherScope);
      fake.state.replies.push(chatReply('ответ B'));
      await worker.tick();
      await ask(stranger, 'CHAT', 'SENTINEL-OTHER-ORG');
      fake.state.replies.push(chatReply('ответ C'));
      await worker.tick();
      await db.auditLog.create({ data: { organizationId: w.org, userId: w.user, entityType: 'marketing_site', entityId: w.location, action: 'test.sentinel', after: { note: 'SENTINEL-AUDIT' } } });
      await ask(w, 'CHAT', 'Продолжим');
      fake.state.replies.push(chatReply('ок'));
      await worker.tick();
      const sent = JSON.stringify(fake.state.assistant.at(-1));
      expect(sent).toContain('SENTINEL-SITE-A');
      expect(sent).not.toMatch(/SENTINEL-SITE-B|SENTINEL-OTHER-ORG|SENTINEL-AUDIT/);
      // а сайт B видит только себя
      await call(w, 'POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'CHAT', text: 'Продолжим B' }, otherScope);
      fake.state.replies.push(chatReply('ок B'));
      await worker.tick();
      const sentB = JSON.stringify(fake.state.assistant.at(-1));
      expect(sentB).toContain('SENTINEL-SITE-B');
      expect(sentB).not.toMatch(/SENTINEL-SITE-A|SENTINEL-OTHER-ORG/);
    });

    it('история ограничена 12 последними ходами', async () => {
      const w = await world();
      await siteWithVersion(w);
      const site = await db.marketingSite.findFirstOrThrow({ where: { locationId: w.location }, select: { id: true, latestVersionId: true } });
      const b = await brief(w);
      // прошлые ходы двухчасовой давности: предел часа на них не распространяется
      for (let i = 1; i <= 14; i += 1) {
        const id = randomUUID();
        const at = new Date(Date.now() - 2 * 3600_000 + i * 1000);
        await sql.query(
          `INSERT INTO site_ai_runs (id, site_id, mode, status, request_key, requested_by_id, base_version_id, brief_hash, user_text, created_at)
           VALUES ($1, $2, 'CHAT', 'QUEUED', $3, $4, $5, $6, $7, $8)`,
          [id, site.id, randomUUID(), w.user, site.latestVersionId, b.briefHash, `старый ход ${i}`, at],
        );
        await sql.query(`UPDATE site_ai_runs SET status = 'RUNNING', started_at = $2, attempts = 1 WHERE id = $1`, [id, at]);
        await sql.query(
          `UPDATE site_ai_runs SET status = 'SUCCEEDED', finished_at = $2, assistant_text = $3, payload = '{"kind":"CHAT","suggestBuild":false,"suggestPublish":false}'::jsonb WHERE id = $1`,
          [id, at, `ответ ${i}`],
        );
      }
      await ask(w, 'CHAT', 'Новый');
      fake.state.replies.push(chatReply('ок'));
      await worker.tick();
      const history = fake.state.assistant.at(-1)!.history;
      expect(history).toHaveLength(12);
      expect(history[0]!.userText).toBe('старый ход 3');
      expect(history.at(-1)!.userText).toBe('старый ход 14');
    });

    it('ответ на вопросы плана: следующий запрос несёт исходную просьбу, оба вопроса и оба ответа ровно по одному разу', async () => {
      const w = await world();
      await siteWithVersion(w);
      const parent = await questionsRun(w);
      const p = await ask(w, 'PLAN', undefined, randomUUID(), {
        replyToRunId: parent,
        answers: [
          { questionId: 'tone', answer: 'Спокойный' },
          { questionId: 'audience', answer: 'Бизнес-путешественники' },
        ],
      });
      expect(p.status, p.text).toBe(202);
      fake.state.replies.push({
        status: 'ok',
        result: { kind: 'PLAN', summary: 'Спокойнее', affectedPages: [], affectedSections: [], steps: ['Тон'], tradeoffs: [], buildInstruction: 'Сделай спокойнее.' },
        model: 'openai/a',
        usage: usage(100, 50),
      });
      await worker.tick();
      expect((await aiRun(p.body.run.id)).status).toBe('SUCCEEDED');
      const sent = fake.state.assistant.at(-1)!;
      for (const piece of ['Сделай сайт более премиальным', 'tone: Какой тон?', 'audience: Для кого сайт?', 'tone: Спокойный', 'audience: Бизнес-путешественники'])
        expect(sent.userText).toContain(piece);
      // ход с вопросами в историю не идёт: его содержимое уже в запросе, повторов нет
      expect(JSON.stringify(sent).split('Сделай сайт более премиальным')).toHaveLength(2);
      expect(sent.history).toEqual([]);
      // запрос самодостаточен и в базе
      expect((await aiRun(p.body.run.id)).userText).toContain('Уточняющие вопросы:');
    });

    it('ответы проверяются по вопросам родителя: незнакомый, пропуск, повтор, чужой вариант 400; свой при allowCustom проходит; модель не зовётся', async () => {
      const w = await world();
      await siteWithVersion(w);
      const parent = await questionsRun(w);
      const calls = fake.state.assistant.length;
      const runs = await db.siteAiRun.count({ where: { site: { locationId: w.location } } });
      const reply = (answers: unknown) => ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: parent, answers });
      for (const answers of [
        [{ questionId: 'budget', answer: 'Мало' }, { questionId: 'tone', answer: 'Яркий' }],
        [{ questionId: 'tone', answer: 'Яркий' }],
        [{ questionId: 'tone', answer: 'Яркий' }, { questionId: 'tone', answer: 'Спокойный' }],
        [{ questionId: 'tone', answer: 'Космический' }, { questionId: 'audience', answer: 'Туристы' }],
      ]) {
        const r = await reply(answers);
        expect(r.status, r.text).toBe(400);
      }
      expect(fake.state.assistant.length).toBe(calls);
      expect(await db.siteAiRun.count({ where: { site: { locationId: w.location } } })).toBe(runs);
      const custom = await reply([{ questionId: 'tone', answer: 'Яркий' }, { questionId: 'audience', answer: 'Семьи с детьми' }]);
      expect(custom.status, custom.text).toBe(202);
    });

    it('отвечать можно только на успешные вопросы плана своего сайта; чужой филиал получает нейтральный 404 без вопросов', async () => {
      const w = await world();
      await siteWithVersion(w);
      const parent = await questionsRun(w);
      const answers = [{ questionId: 'tone', answer: 'Яркий' }, { questionId: 'audience', answer: 'Туристы' }];
      // без родителя ответы не принимаются, родитель без ответов тоже
      expect((await ask(w, 'PLAN', undefined, randomUUID(), { answers })).status).toBe(400);
      expect((await ask(w, 'PLAN', 'Текст', randomUUID(), { replyToRunId: parent })).status).toBe(400);
      expect((await ask(w, 'CHAT', 'Текст', randomUUID(), { replyToRunId: parent, answers })).status).toBe(400);
      // чат вместо плана
      await ask(w, 'CHAT', 'Привет');
      fake.state.replies.push(chatReply('Привет'));
      await worker.tick();
      const chat = await db.siteAiRun.findFirstOrThrow({ where: { site: { locationId: w.location }, mode: 'CHAT' }, select: { id: true } });
      expect((await ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: chat.id, answers })).status).toBe(400);
      // план, который сразу дал план
      await ask(w, 'PLAN', 'Сразу план');
      fake.state.replies.push({
        status: 'ok',
        result: { kind: 'PLAN', summary: 'План', affectedPages: [], affectedSections: [], steps: ['Шаг'], tradeoffs: [], buildInstruction: 'Сделай.' },
        model: 'openai/a',
        usage: usage(10, 10),
      });
      await worker.tick();
      const direct = await db.siteAiRun.findFirstOrThrow({ where: { site: { locationId: w.location }, userText: 'Сразу план' }, select: { id: true } });
      expect((await ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: direct.id, answers })).status).toBe(400);
      // упавший план
      await ask(w, 'PLAN', 'Упавший');
      fake.state.replies.push({ status: 'error', errorCode: 'REJECTED_CONTENT', model: null, usage: usage(10, 0) });
      await worker.tick();
      const failed = await db.siteAiRun.findFirstOrThrow({ where: { site: { locationId: w.location }, userText: 'Упавший' }, select: { id: true } });
      expect((await ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: failed.id, answers })).status).toBe(400);
      // чужой филиал знает id задачи
      await grantSiteBuilder(db, w.other);
      const otherScope = { scope: `business=${w.business};location=${w.other}` };
      expect((await call(w, 'POST', '/marketing/site/bootstrap', {}, otherScope)).status).toBe(201);
      const foreign = await call(w, 'POST', '/marketing/site/assistant', { requestKey: randomUUID(), mode: 'PLAN', replyToRunId: parent, answers }, otherScope);
      expect(foreign.status).toBe(404);
      expect(foreign.text).not.toMatch(/Какой тон|Для кого|премиальн/);
      expect((await ask(w, 'PLAN', undefined, randomUUID(), { replyToRunId: randomUUID(), answers })).status).toBe(404);
    });
  });

  describe('общие правила ИИ сайта по обеим таблицам', () => {
    it('одна активная задача ИИ на сайт: пока ждёт чат, сборка 409 AI_BUSY, и наоборот', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      expect((await ask(w, 'CHAT', 'Вопрос')).status).toBe(202);
      const build = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Короче' });
      expect(build.status).toBe(409);
      expect(build.body.code).toBe('AI_BUSY');
      expect((await ask(w, 'PLAN', 'План')).body.code).toBe('AI_BUSY');
    });

    it('предел часа общий: 10 запросов к ИИ сайта любым режимом, одиннадцатый 429', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      for (let i = 0; i < 10; i += 1) {
        const r = i % 2 === 0
          ? await ask(w, 'CHAT', `Вопрос ${i}`)
          : await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: `Правка ${i}` });
        expect([200, 202], r.text).toContain(r.status);
        await sql.query(`UPDATE site_ai_runs SET status = 'FAILED', error_code = 'TIMEOUT', finished_at = now() WHERE status = 'QUEUED' AND requested_by_id = $1`, [w.user]);
        await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE status = 'QUEUED' AND requested_by_id = $1`, [w.user]);
      }
      const eleventh = await ask(w, 'DESIGN', undefined);
      expect(eleventh.status).toBe(429);
      expect(eleventh.body.code).toBe('RATE_LIMITED');
    });

    it('общий дневной пул: токены разговора уменьшают остаток сборки', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      const c = await ask(w, 'CHAT', 'Вопрос');
      fake.state.replies.push({ status: 'ok', result: { answer: 'Ответ' }, model: 'openai/a', usage: usage(30_000, 20_000) });
      await worker.tick();
      expect((await aiRun(c.body.run.id)).status).toBe('SUCCEEDED');
      const b = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Короче' });
      expect(b.status, b.text).toBe(202);
      fake.state.replies.push({ status: 'error', errorCode: 'BUDGET_EXCEEDED', model: null, usage: usage(0, 0) });
      await worker.tick();
      expect(fake.state.edit[0]!['budgetRemainingTokens']).toBe(150_000 - 50_000);
    });

    it('воркер: лицензия действует только при точной цепочке организация, бизнес, филиал', async () => {
      const w = await world();
      const stranger = await world();
      const check = (run: { organizationId: string; businessId: string; locationId: string }) =>
        (worker as unknown as { licenseActive(r: typeof run): Promise<boolean> }).licenseActive(run);
      expect(await check({ organizationId: w.org, businessId: w.business, locationId: w.location })).toBe(true);
      // бизнес чужой организации
      expect(await check({ organizationId: stranger.org, businessId: w.business, locationId: w.location })).toBe(false);
      // филиал другого бизнеса
      expect(await check({ organizationId: stranger.org, businessId: stranger.business, locationId: w.location })).toBe(false);
      expect(await check({ organizationId: w.org, businessId: stranger.business, locationId: stranger.location })).toBe(false);
    });

    it('воркер: лицензию выключили, пока задача ждала, и сборка, и разговор падают LICENSE_UNAVAILABLE без вызова модели', async () => {
      const w = await world();
      const { version } = await siteWithVersion(w);
      const build = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: version.id, instruction: 'Короче' });
      expect(build.status).toBe(202);
      await grantSiteBuilder(db, w.location, 'OFF');
      await worker.tick();
      expect(await genRun(build.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'LICENSE_UNAVAILABLE', tokensInput: null });
      await grantSiteBuilder(db, w.location, 'ACTIVE');
      const talk = await ask(w, 'CHAT', 'Вопрос');
      expect(talk.status).toBe(202);
      await grantSiteBuilder(db, w.location, 'ACTIVE', new Date(Date.now() - 1000));
      await worker.tick();
      expect(await aiRun(talk.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'LICENSE_UNAVAILABLE', tokensInput: null });
      expect(fake.state.edit.length + fake.state.assistant.length).toBe(0);
    });
  });

  describe('закладки версий', () => {
    it('поставить, переименовать, снять; в истории отдельным списком; чужая версия 404; не больше 20', async () => {
      const w = await world();
      const { version, input } = await siteWithVersion(w);
      const put = await call(w, 'PUT', `/marketing/site/versions/${version.id}/bookmark`, { label: 'Перед акцией' });
      expect(put.status, put.text).toBe(200);
      expect(put.body.bookmark).toMatchObject({ versionId: version.id, revision: 1, label: 'Перед акцией' });
      expect((await call(w, 'PUT', `/marketing/site/versions/${version.id}/bookmark`, { label: 'Летняя' })).body.bookmark.label).toBe('Летняя');
      const list = await call(w, 'GET', '/marketing/site/versions');
      expect(list.body.versions[0].bookmark).toBe('Летняя');
      expect(list.body.bookmarks).toEqual([expect.objectContaining({ id: version.id, bookmark: 'Летняя', revision: 1 })]);
      expect((await call(w, 'PUT', `/marketing/site/versions/${version.id}/bookmark`, { label: '' })).status).toBe(400);
      const other = await world();
      const foreign = await siteWithVersion(other);
      expect((await call(w, 'PUT', `/marketing/site/versions/${foreign.version.id}/bookmark`, { label: 'Чужая' })).status).toBe(404);
      expect((await call(w, 'DELETE', `/marketing/site/versions/${version.id}/bookmark`)).status).toBe(200);
      expect((await call(w, 'DELETE', `/marketing/site/versions/${version.id}/bookmark`)).status).toBe(404);
      let revision = version.revision;
      const ids: string[] = [];
      for (let i = 0; i < 21; i += 1) {
        const saved = await call(w, 'POST', '/marketing/site/versions', { baseRevision: revision, spec: specFor(input, `Версия ${i}`) });
        revision = saved.body.version.revision;
        ids.push(saved.body.version.id);
      }
      for (let i = 0; i < 20; i += 1) expect((await call(w, 'PUT', `/marketing/site/versions/${ids[i]}/bookmark`, { label: `Метка ${i}` })).status).toBe(200);
      const over = await call(w, 'PUT', `/marketing/site/versions/${ids[20]}/bookmark`, { label: 'Лишняя' });
      expect(over.status).toBe(409);
      expect(over.body.code).toBe('BOOKMARK_LIMIT');
    });
  });

  describe('платформа: лицензию выдаёт только главный администратор', () => {
    const admin = (method: string, path: string, body?: unknown, asAdmin = true, w?: World) =>
      fetch(`${platformBase}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(asAdmin ? { 'x-test-admin': '1' } : { 'x-test-user': w!.user, 'x-test-org': w!.org }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, unknown> }));

    it('список гостиничных филиалов со статусом; пробный, активировать, продлить, выключить; журнал было и стало', async () => {
      const w = await world('none');
      const list = await admin('GET', `/platform/organizations/${w.org}/site-builder`);
      expect(list.status).toBe(200);
      expect((list.body['items'] as Array<Record<string, unknown>>).map((i) => [i['name'], (i['license'] as Record<string, unknown>)['access']])).toEqual([
        ['Luxx Aparts', 'off'],
        ['Marina', 'off'],
      ]);
      const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
      const trial = await admin('PUT', `/platform/organizations/${w.org}/site-builder/${w.location}`, { status: 'TRIAL', activeUntil: day, note: 'Счёт 1' });
      expect(trial.status).toBe(200);
      expect(trial.body['license']).toMatchObject({ access: 'active', status: 'TRIAL', note: 'Счёт 1' });
      expect((await admin('PUT', `/platform/organizations/${w.org}/site-builder/${w.location}`, { status: 'TRIAL' })).status).toBe(400);
      expect((await admin('PUT', `/platform/organizations/${w.org}/site-builder/${w.location}`, { status: 'ACTIVE', activeUntil: '' })).body['license']).toMatchObject({ access: 'active', status: 'ACTIVE', activeUntil: null });
      expect((await admin('PUT', `/platform/organizations/${w.org}/site-builder/${w.location}`, { status: 'OFF' })).body['license']).toMatchObject({ access: 'off' });
      const logs = await db.auditLog.findMany({ where: { entityId: w.location, action: 'site_builder.entitlement_updated' }, orderBy: { createdAt: 'asc' } });
      expect(logs.map((l) => (l.after as { status: string }).status)).toEqual(['TRIAL', 'ACTIVE', 'OFF']);
      expect(logs[0]!.before).toBeNull();
      expect(logs[1]!.before).toMatchObject({ status: 'TRIAL' });
      // филиал другой организации и не гостиничный: 404
      const stranger = await world('none');
      expect((await admin('PUT', `/platform/organizations/${w.org}/site-builder/${stranger.location}`, { status: 'ACTIVE' })).status).toBe(404);
    });

    it('сохранение лицензии само перепроверяет филиал в своей транзакции: чужая организация или не гостиница, ничего не записано', async () => {
      const w = await world('none');
      const stranger = await world('none');
      const licenses = platform.get(SiteBuilderLicenses);
      const change = { status: 'ACTIVE' as const, activeUntil: null, note: null };
      await expect(licenses.save({ organizationId: stranger.org, locationId: w.location, change, by: adminId, now: new Date() })).rejects.toThrow(/филиал/);
      expect(await db.siteBuilderEntitlement.count({ where: { locationId: w.location } })).toBe(0);
      expect(await db.auditLog.count({ where: { organizationId: stranger.org, action: 'site_builder.entitlement_updated' } })).toBe(0);
      await licenses.save({ organizationId: w.org, locationId: w.location, change, by: adminId, now: new Date() });
      expect(await db.siteBuilderEntitlement.count({ where: { locationId: w.location } })).toBe(1);
    });

    it('партнёр (владелец организации) лицензию не видит через платформу и не выдаёт', async () => {
      const w = await world('none');
      expect((await admin('GET', `/platform/organizations/${w.org}/site-builder`, undefined, false, w)).status).toBe(403);
      expect((await admin('PUT', `/platform/organizations/${w.org}/site-builder/${w.location}`, { status: 'ACTIVE' }, false, w)).status).toBe(403);
      expect(await db.siteBuilderEntitlement.count({ where: { locationId: w.location } })).toBe(0);
    });
  });
});
