import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { assistant } from '@pms/integrations';
import { siteSpecHash } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { BRIEF_CHANNEX_READER } from '../../apps/api/src/marketing-site/brief.service';
import { GENERATION_BOT, type EditBotRequest } from '../../apps/api/src/marketing-site/generation.bot';
import { SiteGenerationWorker } from '../../apps/api/src/marketing-site/generation.worker';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';
import { seedSpecAssets } from '../tools/site-assets';

/**
 * MKT9 на настоящей базе: история версий, чтение и смысловая разница, восстановление как новый черновик (и чем оно
 * отличается от публичного отката MKT7), ИИ-правки PATCH и SECTION через тот же воркер и бюджет, гонка ручного
 * сохранения с ИИ, чужой филиал. Бот подставной: тест видит, что ему ушло, и задаёт ответ.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const BASE_DOMAIN = 'sites-editor.test';

// документ сайта в тестах правится по путям
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;
type Reply = unknown | Error | ((request: EditBotRequest) => unknown | Promise<unknown>);

function fakeBot() {
  const state = { edits: [] as EditBotRequest[], generations: 0, initial: [] as Array<Record<string, unknown>>, replies: [] as Reply[] };
  return {
    state,
    bot: {
      async generate(request: Record<string, unknown>) {
        state.generations += 1;
        state.initial.push(structuredClone(request));
        throw new assistant.BotRejectedError(422, 'fake bot: INITIAL только запоминается');
      },
      async edit(request: EditBotRequest) {
        state.edits.push(structuredClone(request));
        const next = state.replies.shift();
        if (next === undefined) throw new Error('fake bot: no scripted reply');
        if (next instanceof Error) throw next;
        return typeof next === 'function' ? (next as (r: EditBotRequest) => unknown)(request) : next;
      },
    },
  };
}

const usage = (input = 900, output = 300) => ({ input, output, cached: null, complete: true, paidCalls: 1 });
const t = (ru: string) => ({ ru });

function doc(heading: string, extra: { heroImage?: string } = {}): Spec {
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t('Гостиница Редактор'),
      defaultLocale: 'ru',
      locales: ['ru'],
      brand: { tagline: t('Тихо и рядом') },
      contacts: { phone: '+77011111111', email: 'a@example.invalid' },
      seo: { robots: 'INDEX', structuredData: { type: 'HOTEL', includeAddress: false, includeGeo: false } },
    },
    theme: { preset: 'CALM', accent: 'TEAL', typography: 'MODERN', radius: 'SOFT', density: 'COMFORTABLE', colorScheme: 'LIGHT' },
    navigation: { header: [{ label: t('Номера'), target: { kind: 'SECTION', pageId: 'page-home', sectionId: 'sec-rooms' } }], footer: [] },
    pages: [
      {
        id: 'page-home',
        slug: '',
        isHome: true,
        title: t('Главная'),
        seo: { title: t('Гостиница'), description: t('Гостиница в центре'), index: true, includeInSitemap: true, canonical: 'SELF' },
        sections: [
          extra.heroImage
            ? { id: 'sec-hero', type: 'hero', variant: 'IMAGE_FULL', heading: t(heading), image: { assetId: extra.heroImage, alt: t('Фасад') }, primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } }
            : { id: 'sec-hero', type: 'hero', variant: 'TEXT_ONLY', heading: t(heading), primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } },
          { id: 'sec-about', type: 'about', variant: 'TEXT_ONLY', heading: t('О нас'), paragraphs: [t('Гостиница у вокзала.')] },
          { id: 'sec-rooms', type: 'accommodations', variant: 'CARDS', heading: t('Номера'), items: [{ categoryCode: 'cat-a', title: t('Номер'), description: t('Описание') }] },
          { id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t('Забронировать') },
        ],
      },
    ],
    integrations: { booking: { mode: 'WETOP_WIDGET' }, analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } },
  };
}

describe.skipIf(!url)('MKT9 site editor', () => {
  let db: Db, sql: pg.Client, app: INestApplication, base: string, worker: SiteGenerationWorker;
  const fake = fakeBot();
  const orgs: string[] = [];
  const users: string[] = [];
  const budgetBefore = process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET;

  interface World {
    org: string;
    user: string;
    business: string;
    location: string;
    site: string;
    scope: string;
    rate: string;
  }

  async function world(): Promise<World> {
    const org = randomUUID(), user = randomUUID(), business = randomUUID(), location = randomUUID(), site = randomUUID(), property = randomUUID();
    orgs.push(org);
    users.push(user);
    await db.organization.create({ data: { id: org, name: 'MKT9 (synthetic)', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `mkt9-${user}@example.invalid`, passwordHash: 'x' } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' } });
    // имя филиала равно имени объекта: соседний набор Platform P1 сверяет их у всех объектов базы
    await db.location.create({ data: { id: location, businessId: business, name: 'Объект', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.property.create({ data: { id: property, organizationId: org, locationId: location, name: 'Объект', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' } });
    const cat = await db.accommodationType.create({ data: { propertyId: property, code: 'cat-a', name: 'Номер', kind: 'PRIVATE_ROOM', capacityAdults: 2 } });
    const building = await db.building.create({ data: { propertyId: property, name: 'К' } });
    const floor = await db.floor.create({ data: { buildingId: building.id, name: '1' } });
    const room = await db.physicalRoom.create({ data: { floorId: floor.id, roomNumber: '1', capacity: 2 } });
    await db.inventoryUnit.create({ data: { propertyId: property, physicalRoomId: room.id, accommodationTypeId: cat.id, kind: 'ROOM', code: 'A1' } });
    const rate = (await db.ratePlan.create({ data: { propertyId: property, code: 'BASE', name: 'База', currency: 'KZT' } })).id;
    await db.marketingSite.create({ data: { id: site, locationId: location, name: 'Сайт', slug: `ed-${site.slice(0, 12)}` } });
    return { org, user, business, location, site, scope: `business=${business};location=${location}`, rate };
  }

  async function call(w: World, method: string, path: string, body?: unknown) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'x-test-user': w.user, 'x-test-org': w.org, 'x-wetop-scope': w.scope, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }
  async function save(w: World, baseRevision: number, spec: Spec): Promise<{ id: string; revision: number }> {
    const r = await call(w, 'POST', '/marketing/site/versions', { baseRevision, spec });
    expect(r.status, r.text).toBe(201);
    return r.body.version;
  }
  const site = (w: World) => db.marketingSite.findUniqueOrThrow({ where: { id: w.site } });
  const run = (id: string) => db.generationRun.findUniqueOrThrow({ where: { id } });
  const patch = (w: World, baseVersionId: string, instruction = 'Сделай первый экран короче', requestKey = randomUUID()) =>
    call(w, 'POST', '/marketing/site/generations', { requestKey, type: 'PATCH', baseVersionId, instruction });
  const section = (w: World, baseVersionId: string, sectionId = 'sec-about', extra: Record<string, unknown> = {}) =>
    call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'SECTION', baseVersionId, pageId: 'page-home', sectionId, ...extra });

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    vi.stubEnv('SITES_BASE_DOMAIN', BASE_DOMAIN);
    db = createPrismaClient(url);
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(BRIEF_CHANNEX_READER)
      .useValue(null)
      .overrideProvider(GENERATION_BOT)
      .useValue(fake.bot)
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      req.user = { id: req.headers['x-test-user'], organizationId: req.headers['x-test-org'], role: 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    worker = app.get(SiteGenerationWorker);
  });

  afterEach(async () => {
    const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
      JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
    await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE status = 'QUEUED' AND site_id IN (${sites})`, [orgs]);
    await sql.query(`UPDATE generation_runs SET status = 'FAILED', error_code = 'TIMEOUT', finished_at = now() WHERE status = 'RUNNING' AND site_id IN (${sites})`, [orgs]);
    fake.state.edits.length = 0;
    fake.state.replies.length = 0;
    fake.state.generations = 0;
    fake.state.initial.length = 0;
    if (budgetBefore === undefined) delete process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET;
    else process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET = budgetBefore;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app?.close();
    if (sql) {
      const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      await sql.query('ALTER TABLE marketing_site_publications DISABLE TRIGGER marketing_site_publication_immutable');
      await sql.query('ALTER TABLE generation_runs DISABLE TRIGGER generation_run_guard');
      await sql.query(`DELETE FROM marketing_site_publications WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM site_domains WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(
        `UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL, tracked_site_id = NULL,
           state = 'ARCHIVED', archived_at = coalesce(archived_at, now()) WHERE id IN (${sites})`,
        [orgs],
      );
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
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      expect(await db.organization.count({ where: { id: { in: orgs } } })).toBe(0);
    }
  });

  it('история версий: до 100, новые сверху, без документа; чтение с документом; смысловая разница', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    const second = doc('Второй');
    second.pages[0].sections.reverse();
    second.pages[0].sections = [second.pages[0].sections[3], ...second.pages[0].sections.slice(0, 3)];
    const v2 = await save(w, 1, second);
    expect(v2.revision).toBe(2);

    const list = await call(w, 'GET', '/marketing/site/versions');
    expect(list.status).toBe(200);
    expect(list.body.versions.map((v: { revision: number }) => v.revision)).toEqual([2, 1]);
    expect(Object.keys(list.body.versions[0]).sort()).toEqual(
      ['createdAt', 'createdById', 'generationRunId', 'id', 'isLatest', 'isPublished', 'parentVersionId', 'revision', 'source', 'specHash'].sort(),
    );
    expect(list.body.versions[0]).toMatchObject({ id: v2.id, isLatest: true, isPublished: false, parentVersionId: v1.id, source: 'MANUAL', createdById: w.user });

    const one = await call(w, 'GET', `/marketing/site/versions/${v1.id}`);
    expect(one.status).toBe(200);
    expect(one.body.version.spec.pages[0].sections[0].heading.ru).toBe('Первый');
    expect(one.body.version.specHash).toBe(siteSpecHash(doc('Первый')));

    const diff = await call(w, 'GET', `/marketing/site/versions/${v2.id}/diff?against=${v1.id}`);
    expect(diff.status).toBe(200);
    expect(diff.body.from.revision).toBe(1);
    expect(diff.body.to.revision).toBe(2);
    expect(diff.body.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ area: 'section', kind: 'changed', sectionId: 'sec-hero' })]),
    );
    expect(diff.body.changes.some((c: { kind: string }) => c.kind === 'moved')).toBe(true);
    expect(diff.text).not.toContain('"spec"');
  });

  it('чужой филиал: версия, разница и восстановление неотличимы от несуществующих (404); чужая картинка не сохраняется', async () => {
    const a = await world();
    const b = await world();
    const va = await save(a, 0, doc('А'));
    const vb = await save(b, 0, doc('Б'));
    expect((await call(b, 'GET', `/marketing/site/versions/${va.id}`)).status).toBe(404);
    expect((await call(b, 'GET', `/marketing/site/versions/${vb.id}/diff?against=${va.id}`)).status).toBe(404);
    expect((await call(b, 'POST', `/marketing/site/versions/${va.id}/restore`, { baseRevision: 1 })).status).toBe(404);
    expect((await call(b, 'GET', `/marketing/site/versions/${randomUUID()}`)).status).toBe(404);
    // ИИ-правка от чужой базы: у B другая голова, задачи нет
    const foreign = await patch(b, va.id);
    expect(foreign.status).toBe(409);
    expect(await db.generationRun.count({ where: { siteId: b.site } })).toBe(0);
    // картинка филиала A в документе B: та же ошибка, что у несуществующей
    const asset = randomUUID();
    await seedSpecAssets(db, a.location, doc('x', { heroImage: asset }));
    const r = await call(b, 'POST', '/marketing/site/versions', { baseRevision: 1, spec: doc('Б', { heroImage: asset }) });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('ASSET_UNAVAILABLE');
  });

  it('восстановление как новый черновик: r1 → новая r4 от r3, источник MANUAL, опубликованная не меняется; устаревшая база 409', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    const pub = await call(w, 'POST', '/marketing/site/publish', { expectedVersionId: v1.id, bookingRatePlanId: w.rate });
    expect(pub.status, pub.text).toBe(200);
    await save(w, 1, doc('Второй'));
    const v3 = await save(w, 2, doc('Третий'));

    const stale = await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 2 });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('VERSION_CONFLICT');
    expect((await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 3, extra: 1 })).status).toBe(400);

    const restored = await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 3 });
    expect(restored.status, restored.text).toBe(201);
    expect(restored.body.version.revision).toBe(4);
    expect(restored.body.restoredFrom).toEqual({ id: v1.id, revision: 1 });
    const v4 = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: restored.body.version.id } });
    expect(v4).toMatchObject({ parentVersionId: v3.id, source: 'MANUAL', generationRunId: null, specHash: siteSpecHash(doc('Первый')), createdById: w.user });
    const s = await site(w);
    expect(s.latestVersionId).toBe(v4.id);
    expect(s.publishedVersionId).toBe(v1.id);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: w.site, action: 'marketing.site.version_restored' } });
    expect(audit.after).toMatchObject({ restoredFromVersionId: v1.id, revision: 4 });
    expect(JSON.stringify(audit.after)).not.toContain('Первый');
  });

  it('откат MKT7 меняет только опубликованную, восстановление MKT9 только голову', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    expect((await call(w, 'POST', '/marketing/site/publish', { expectedVersionId: v1.id, bookingRatePlanId: w.rate })).status).toBe(200);
    const v2 = await save(w, 1, doc('Второй'));
    expect((await call(w, 'POST', '/marketing/site/publish', { expectedVersionId: v2.id })).status).toBe(200);
    expect((await call(w, 'POST', '/marketing/site/rollback', { versionId: v1.id })).status).toBe(200);
    let s = await site(w);
    expect([s.latestVersionId, s.publishedVersionId]).toEqual([v2.id, v1.id]);
    const restored = await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 2 });
    expect(restored.status).toBe(201);
    s = await site(w);
    expect(s.latestVersionId).toBe(restored.body.version.id);
    expect(s.publishedVersionId).toBe(v1.id);
    const list = (await call(w, 'GET', '/marketing/site/versions')).body.versions;
    expect(list.find((v: { id: string }) => v.id === v1.id).isPublished).toBe(true);
    expect(list[0]).toMatchObject({ revision: 3, isLatest: true, isPublished: false });
  });

  it('восстановление версии с картинкой, удалённой из библиотеки: 409 ASSET_UNAVAILABLE, головы нет', async () => {
    const w = await world();
    const asset = randomUUID();
    await seedSpecAssets(db, w.location, doc('x', { heroImage: asset }));
    const v1 = await save(w, 0, doc('С фото', { heroImage: asset }));
    await save(w, 1, doc('Без фото'));
    await sql.query(`UPDATE site_assets SET status = 'DELETED', deleted_at = now() WHERE id = $1`, [asset]);
    const r = await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 2 });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('ASSET_UNAVAILABLE');
    expect((await db.marketingSiteVersion.count({ where: { siteId: w.site } }))).toBe(2);
  });

  it('PATCH: постановка, повтор того же ключа, неверная база, пустая и длинная команда, параллельная задача; журнал без текста', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    expect((await patch(w, v1.id, '   ')).status).toBe(400);
    expect((await patch(w, v1.id, 'x'.repeat(1801))).status).toBe(400);
    expect((await patch(w, randomUUID())).status).toBe(409);
    const extra = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), type: 'PATCH', baseVersionId: v1.id, instruction: 'x', expectedBriefHash: 'a'.repeat(64) });
    expect(extra.status).toBe(400);

    const key = randomUUID();
    const first = await patch(w, v1.id, 'СЕКРЕТНАЯ_КОМАНДА сделай короче', key);
    expect(first.status, first.text).toBe(202);
    expect(first.body.run).toMatchObject({ type: 'PATCH', status: 'QUEUED', baseVersionId: v1.id });
    expect(first.text).not.toContain('СЕКРЕТНАЯ_КОМАНДА');
    const again = await patch(w, v1.id, 'другая', key);
    expect(again.status).toBe(200);
    expect(again.body.run.id).toBe(first.body.run.id);
    expect((await patch(w, v1.id)).status).toBe(409);
    const stored = await run(first.body.run.id);
    expect(stored.instruction).toBe('СЕКРЕТНАЯ_КОМАНДА сделай короче');
    expect(stored.briefHash).toMatch(/^[0-9a-f]{64}$/);
    const status = await call(w, 'GET', `/marketing/site/generations/${first.body.run.id}`);
    expect(status.text).not.toContain('СЕКРЕТНАЯ_КОМАНДА');
    const logs = await db.auditLog.findMany({ where: { entityId: w.site } });
    expect(JSON.stringify(logs.map((l) => l.after))).not.toContain('СЕКРЕТНАЯ_КОМАНДА');
  });

  it('PATCH, воркер: бот получает базу и команду без организации; новая версия AI base+1 с родителем; опубликованная не тронута', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    expect((await call(w, 'POST', '/marketing/site/publish', { expectedVersionId: v1.id, bookingRatePlanId: w.rate })).status).toBe(200);
    const queued = await patch(w, v1.id, 'Сделай первый экран короче');
    const edited = doc('Коротко');
    edited.site.brand.tagline = t('Новый слоган');
    edited.theme.accent = 'GOLD';
    edited.pages[0].sections = [edited.pages[0].sections[0], edited.pages[0].sections[2], edited.pages[0].sections[1], edited.pages[0].sections[3]];
    fake.state.replies.push({ status: 'ok', spec: edited, model: 'openai/edit', usage: usage() });
    expect(await worker.tick()).toBe(queued.body.run.id);

    const req = fake.state.edits[0]!;
    expect(req).toMatchObject({ schemaVersion: 'site-edit/0', mode: 'PATCH', instruction: 'Сделай первый экран короче', siteSpecSchemaVersion: 'site-spec/0' });
    expect(req.baseSpec).toEqual(doc('Первый'));
    expect(Object.keys(req).sort()).toEqual(
      ['baseSpec', 'briefInput', 'budgetRemainingTokens', 'instruction', 'mode', 'requestId', 'schemaVersion', 'siteSpecSchemaVersion', 'validationErrors'].sort(),
    );
    const done = await run(queued.body.run.id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', type: 'PATCH', tokensInput: 900, tokensOutput: 300 });
    const v2 = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: done.outputVersionId! } });
    expect(v2).toMatchObject({ revision: 2, parentVersionId: v1.id, source: 'AI', generationRunId: done.id, createdById: w.user });
    const s = await site(w);
    expect([s.latestVersionId, s.publishedVersionId]).toEqual([v2.id, v1.id]);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: w.site, action: 'marketing.site.generation.succeeded' } });
    expect(audit.after).toMatchObject({ type: 'PATCH', baseVersionId: v1.id, versionId: v2.id });
    expect(JSON.stringify(audit.after)).not.toContain('Сделай первый экран');
  });

  it('PATCH: ИИ меняет телефон → SCHEMA_INVALID и повтор с путями ошибок; голова сменилась до повтора → BASE_VERSION_CHANGED без модели', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    const queued = await patch(w, v1.id);
    const bad = doc('Коротко');
    bad.site.contacts.phone = '+77019999999';
    fake.state.replies.push({ status: 'ok', spec: bad, model: 'openai/edit', usage: usage() });
    await worker.tick();
    const after = await run(queued.body.run.id);
    expect(after).toMatchObject({ status: 'QUEUED', errorCode: 'SCHEMA_INVALID' });
    expect(after.errorMessage).toContain('site.contacts immutable_field');
    expect(await db.marketingSiteVersion.count({ where: { siteId: w.site } })).toBe(1);

    await save(w, 1, doc('Ручная правка'));
    await sql.query(`UPDATE generation_runs SET next_attempt_at = now() WHERE id = $1`, [queued.body.run.id]);
    await worker.tick();
    expect(fake.state.edits).toHaveLength(1);
    expect(await run(queued.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'BASE_VERSION_CHANGED' });
  });

  it('гонка: ИИ работает с r1, человек сохраняет r2 → результат ИИ не применён, версии r3 от ИИ нет', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    const queued = await patch(w, v1.id);
    fake.state.replies.push(async () => {
      await save(w, 1, doc('Человек успел'));
      return { status: 'ok', spec: doc('ИИ'), model: 'openai/edit', usage: usage() };
    });
    await worker.tick();
    expect(await run(queued.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'BASE_VERSION_CHANGED', tokensInput: 900 });
    const versions = await db.marketingSiteVersion.findMany({ where: { siteId: w.site }, orderBy: { revision: 'asc' } });
    expect(versions.map((v) => [v.revision, v.source])).toEqual([[1, 'MANUAL'], [2, 'MANUAL']]);
    expect((await site(w)).latestVersionId).toBe(versions[1]!.id);
  });

  it('SECTION: цель проверяется при постановке; бот получает цель; меняется только цель; другая секция → отказ', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    expect((await section(w, v1.id, 'sec-missing')).status).toBe(409);
    expect((await section(w, v1.id, 'sec-about', { instruction: 'x'.repeat(1501) })).status).toBe(400);
    const queued = await section(w, v1.id, 'sec-about');
    expect(queued.status, queued.text).toBe(202);
    expect(queued.body.run).toMatchObject({ type: 'SECTION', target: { pageId: 'page-home', sectionId: 'sec-about' } });

    const wrong = doc('Первый');
    wrong.pages[0].sections[0].heading = t('Чужая секция');
    fake.state.replies.push({ status: 'ok', spec: wrong, model: 'openai/edit', usage: usage() });
    await worker.tick();
    expect(fake.state.edits[0]).toMatchObject({ mode: 'SECTION', target: { pageId: 'page-home', sectionId: 'sec-about' }, instruction: 'Пересобери эту секцию, сохранив её назначение.' });
    expect(await run(queued.body.run.id)).toMatchObject({ status: 'QUEUED', errorCode: 'SCHEMA_INVALID' });

    const right = doc('Первый');
    right.pages[0].sections[1].paragraphs = [t('Новый текст о гостинице.')];
    fake.state.replies.push({ status: 'ok', spec: right, model: 'openai/edit', usage: usage() });
    await sql.query(`UPDATE generation_runs SET next_attempt_at = now() WHERE id = $1`, [queued.body.run.id]);
    await worker.tick();
    expect(fake.state.edits[1]!.validationErrors).toEqual(expect.arrayContaining([{ path: '', code: 'outside_target' }]));
    const done = await run(queued.body.run.id);
    expect(done.status).toBe('SUCCEEDED');
    const v2 = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: done.outputVersionId! } });
    expect(v2).toMatchObject({ revision: 2, parentVersionId: v1.id, source: 'AI' });
  });

  it('бюджет общий для всех видов задач: исчерпан → BUDGET_EXCEEDED без вызова бота', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET = '1000';
    const queued = await patch(w, v1.id);
    const bad = doc('Не то');
    bad.site.contacts.email = 'other@example.invalid';
    fake.state.replies.push({ status: 'ok', spec: bad, model: 'openai/edit', usage: usage(800, 300) });
    await worker.tick();
    expect(await run(queued.body.run.id)).toMatchObject({ status: 'QUEUED', errorCode: 'SCHEMA_INVALID' });
    await sql.query(`UPDATE generation_runs SET next_attempt_at = now() WHERE id = $1`, [queued.body.run.id]);
    await worker.tick();
    expect(fake.state.edits).toHaveLength(1);
    expect(await run(queued.body.run.id)).toMatchObject({ status: 'FAILED', errorCode: 'BUDGET_EXCEEDED' });
  });

  it('предел постановок в час считает и правки: 10 задач за час → 429', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    for (let i = 0; i < 10; i += 1) {
      const id = randomUUID();
      await sql.query(
        `INSERT INTO generation_runs (id, site_id, type, status, request_key, requested_by_id, created_at) VALUES ($1, $2, 'PATCH', 'QUEUED', $3, $4, now())`,
        [id, w.site, randomUUID(), w.user],
      );
      await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE id = $1`, [id]);
    }
    expect((await patch(w, v1.id)).status).toBe(429);
  });

  it('архивный сайт: правка, восстановление и сохранение отклоняются', async () => {
    const w = await world();
    const v1 = await save(w, 0, doc('Первый'));
    expect((await call(w, 'POST', '/marketing/site/archive', {})).status).toBe(200);
    expect([404, 409]).toContain((await patch(w, v1.id)).status);
    expect((await call(w, 'POST', `/marketing/site/versions/${v1.id}/restore`, { baseRevision: 1 })).status).toBe(404);
    expect((await call(w, 'POST', '/marketing/site/versions', { baseRevision: 1, spec: doc('x') })).status).toBe(404);
  });

  it('окно «Создать сайт»: пожелания к первой версии хранятся в задаче, уходят боту отдельным полем, наружу и в журнал не попадают', async () => {
    const w = await world();
    const brief = (await call(w, 'GET', '/marketing/site/brief')).body;
    const wish = 'ПОЖЕЛАНИЕ_ВЛАДЕЛЬЦА: тон дружелюбный, акцент на тишину';
    expect((await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: brief.briefHash, instruction: 'x'.repeat(1801) })).status).toBe(400);
    const r = await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: brief.briefHash, instruction: `  ${wish}  ` });
    expect(r.status, r.text).toBe(202);
    expect(r.body.run.type).toBe('INITIAL');
    expect(r.text).not.toContain('ПОЖЕЛАНИЕ_ВЛАДЕЛЬЦА');
    expect((await run(r.body.run.id)).instruction).toBe(wish);
    await worker.tick();
    expect(fake.state.initial[0]).toMatchObject({ schemaVersion: 'site-generation/0', instruction: wish });
    const logs = await db.auditLog.findMany({ where: { entityId: w.site } });
    expect(JSON.stringify(logs.map((l) => l.after))).not.toContain('ПОЖЕЛАНИЕ_ВЛАДЕЛЬЦА');
    // без пожеланий поле не уходит вовсе: контракт MKT6 прежний
    const w2 = await world();
    const b2 = (await call(w2, 'GET', '/marketing/site/brief')).body;
    const r2 = await call(w2, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: b2.briefHash });
    expect((await run(r2.body.run.id)).instruction).toBeNull();
    await worker.tick();
    expect(fake.state.initial[1]).not.toHaveProperty('instruction');
  });
});
