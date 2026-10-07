import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { assistant } from '@pms/integrations';
import type { SiteBriefInput } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { BRIEF_CHANNEX_READER, SiteBriefService } from '../../apps/api/src/marketing-site/brief.service';
import { GENERATION_BOT, type GenerationBotRequest } from '../../apps/api/src/marketing-site/generation.bot';
import { SiteGenerationWorker } from '../../apps/api/src/marketing-site/generation.worker';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT6 на настоящей базе: постановка задачи, очередь и воркер, бюджет Q-274, неизвестный расход, повторы, смена брифа
 * и базы, успех одной транзакцией. Бот подставной: тест управляет его ответом и видит, что ему ушло.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

type Reply = unknown | Error | ((request: GenerationBotRequest) => unknown | Promise<unknown>);

function fakeBot() {
  const state = { requests: [] as GenerationBotRequest[], replies: [] as Reply[] };
  return {
    state,
    bot: {
      async generate(request: GenerationBotRequest) {
        state.requests.push(structuredClone(request));
        const next = state.replies.shift();
        if (next === undefined) throw new Error('fake bot: no scripted reply');
        if (next instanceof Error) throw next;
        return typeof next === 'function' ? (next as (r: GenerationBotRequest) => unknown)(request) : next;
      },
    },
  };
}

const usage = (input: number, output: number, cached: number | null = null, complete = true, paidCalls = 1) => ({
  input,
  output,
  cached,
  complete,
  paidCalls,
});

/** Документ, который проходит проверку платформы для брифа филиала */
// документ из ответа модели: произвольный JSON, тесты правят в нём вложенные поля
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function specFor(input: SiteBriefInput, locales: string[]): Record<string, any> {
  const t = (text: string) => Object.fromEntries(locales.map((l) => [l, text]));
  const codes = input.accommodations.map((a) => a.categoryCode);
  const contacts: Record<string, unknown> = {};
  if (input.identity.phone) contacts['phone'] = '+' + input.identity.phone.replace(/[^0-9]/g, '');
  if (input.identity.email) contacts['email'] = input.identity.email;
  if (input.identity.address) contacts['address'] = t(input.identity.address);
  const sections: Array<Record<string, unknown>> = [
    { id: 'sec-hero', type: 'hero', variant: 'TEXT_ONLY', heading: t('HERO_HEADING_SENTINEL'), primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } },
  ];
  if (codes.length) {
    sections.push({
      id: 'sec-rooms',
      type: 'accommodations',
      variant: 'CARDS',
      heading: t('Номера'),
      items: input.accommodations.map((a) => ({ categoryCode: a.categoryCode, title: t(a.name), description: t('Описание') })),
    });
    sections.push({ id: 'sec-pricing', type: 'pricing', variant: 'FROM_PRICES', heading: t('Цены'), categoryCodes: codes });
  }
  sections.push({ id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t('Забронировать') });
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t(input.identity.displayNameCandidate),
      defaultLocale: locales[0],
      locales,
      ...(Object.keys(contacts).length ? { contacts } : {}),
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
        sections,
      },
    ],
    integrations: { booking: { mode: 'WETOP_WIDGET' }, analytics: { mode: 'WETOP_TRACKER', consent: 'NOT_REQUIRED' } },
  };
}

describe.skipIf(!url)('MKT6 site generation', () => {
  let db: Db, sql: pg.Client, app: INestApplication, base: string, worker: SiteGenerationWorker, briefs: SiteBriefService;
  const fake = fakeBot();
  const orgs: string[] = [];
  const users: string[] = [];
  let clock = new Date();
  const budgetBefore = process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET;

  interface World {
    org: string;
    user: string;
    business: string;
    location: string;
    site: string;
    scope: string;
  }

  /** Своя организация на тест: бюджет считается по организации и суткам, тесты не делят его */
  async function world(options: { property?: boolean; site?: boolean } = {}): Promise<World> {
    const org = randomUUID(), user = randomUUID(), business = randomUUID(), location = randomUUID(), site = randomUUID();
    orgs.push(org);
    users.push(user);
    await db.organization.create({ data: { id: org, name: 'MKT6 (synthetic)', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `mkt6-${user}@example.invalid`, passwordHash: 'x' } });
    await db.business.create({ data: { id: business, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' } });
    await db.location.create({
      data: { id: location, businessId: business, name: 'Филиал', timezone: 'Asia/Almaty', currency: 'KZT', address: 'ул. Тестовая 1', phone: '+7 701 111 11 11', email: 'a@example.invalid' },
    });
    if (options.property !== false) {
      const property = randomUUID();
      await db.property.create({ data: { id: property, organizationId: org, locationId: location, name: 'Объект', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' } });
      const cat = await db.accommodationType.create({ data: { propertyId: property, code: 'cat-a', name: 'Номер', kind: 'PRIVATE_ROOM', capacityAdults: 2 } });
      const building = await db.building.create({ data: { propertyId: property, name: 'К' } });
      const floor = await db.floor.create({ data: { buildingId: building.id, name: '1' } });
      const room = await db.physicalRoom.create({ data: { floorId: floor.id, roomNumber: '1', capacity: 2 } });
      await db.inventoryUnit.create({ data: { propertyId: property, physicalRoomId: room.id, accommodationTypeId: cat.id, kind: 'ROOM', code: 'A1' } });
    }
    if (options.site !== false)
      await db.marketingSite.create({ data: { id: site, locationId: location, name: 'Сайт', slug: `g-${site.slice(0, 12)}` } });
    return { org, user, business, location, site, scope: `business=${business};location=${location}` };
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
  const briefOf = async (w: World) => (await call(w, 'GET', '/marketing/site/brief')).body;
  const request = (w: World, hash: string, key = randomUUID()) =>
    call(w, 'POST', '/marketing/site/generations', { requestKey: key, expectedBriefHash: hash });
  const run = (id: string) => db.generationRun.findUniqueOrThrow({ where: { id } });
  const okReply = (input: SiteBriefInput, u = usage(1000, 300, 400)) => ({ status: 'ok', spec: specFor(input, ['ru']), model: 'openai/a', usage: u });
  async function queued(w: World): Promise<{ id: string; input: SiteBriefInput }> {
    const brief = await briefOf(w);
    const r = await request(w, brief.briefHash);
    expect(r.status, r.text).toBe(202);
    return { id: r.body.run.id, input: brief.input };
  }

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
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
    briefs = app.get(SiteBriefService);
    worker.now = () => clock;
  });

  afterEach(async () => {
    // незавершённые задачи теста не должны достаться воркеру следующего теста: закрываем их по правилам переходов
    const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
      JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
    await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE status = 'QUEUED' AND site_id IN (${sites})`, [orgs]);
    await sql.query(`UPDATE generation_runs SET status = 'FAILED', error_code = 'TIMEOUT', finished_at = now() WHERE status = 'RUNNING' AND site_id IN (${sites})`, [orgs]);
    fake.state.requests.length = 0;
    fake.state.replies.length = 0;
    clock = new Date();
    if (budgetBefore === undefined) delete process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET;
    else process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET = budgetBefore;
  });

  afterAll(async () => {
    await app?.close();
    if (sql) {
      // Версии неизменяемы, задачи не удаляются ролями приложения: уборка правами владельца таблиц, как в MKT3
      const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      await sql.query('ALTER TABLE generation_runs DISABLE TRIGGER generation_run_guard');
      await sql.query(`UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL WHERE id IN (${sites})`, [orgs]);
      await sql.query(`UPDATE generation_runs SET output_version_id = NULL, base_version_id = NULL, status = 'CANCELLED', finished_at = now() WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`UPDATE marketing_site_versions SET parent_version_id = NULL, generation_run_id = NULL, source = 'MANUAL' WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM marketing_site_versions WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM generation_runs WHERE site_id IN (${sites})`, [orgs]);
      await sql.query(`DELETE FROM marketing_sites WHERE id IN (${sites})`, [orgs]);
      await sql.query('ALTER TABLE generation_runs ENABLE TRIGGER generation_run_guard');
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await purgeAuditRows(db, { organizationId: { in: orgs } });
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

  it('счастливый путь: бриф → задача → воркер → версия AI revision 1, публикация не тронута, журнал без документа', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    expect((await run(id)).status).toBe('QUEUED');
    fake.state.replies.push(okReply(input));
    expect(await worker.tick()).toBe(id);

    const done = await run(id);
    expect(done).toMatchObject({ status: 'SUCCEEDED', type: 'INITIAL', attempts: 1, tokensInput: 1000, tokensOutput: 300, tokensCached: 400, model: 'openai/a', errorCode: null });
    const site = await db.marketingSite.findUniqueOrThrow({ where: { id: w.site } });
    const version = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: done.outputVersionId! } });
    expect(version).toMatchObject({ revision: 1, source: 'AI', generationRunId: id, parentVersionId: null, createdById: w.user, siteId: w.site });
    expect(site.latestVersionId).toBe(version.id);
    expect(site.publishedVersionId).toBeNull();
    expect(site.state).toBe('DRAFT');

    // что ушло боту: бриф только как данные, без организации, филиала, объекта и ключей
    const sent = fake.state.requests[0]!;
    expect(sent).toEqual({
      schemaVersion: 'site-generation/0',
      requestId: id,
      siteSpecSchemaVersion: 'site-spec/0',
      briefInput: input,
      targetLocales: ['ru'],
      budgetRemainingTokens: 150_000,
      validationErrors: [],
    });
    const wire = JSON.stringify(sent);
    for (const secret of [w.org, w.location, w.business]) expect(wire).not.toContain(secret);

    // статус задачи без документа; журнал только метаданные
    const status = await call(w, 'GET', `/marketing/site/generations/${id}`);
    expect(status.status).toBe(200);
    expect(status.body.run).toMatchObject({ id, status: 'SUCCEEDED', outputVersionId: version.id, tokensInput: 1000, tokensCached: 400, tokensOutput: 300 });
    expect(status.text).not.toContain('HERO_HEADING_SENTINEL');
    const audit = await db.auditLog.findMany({ where: { organizationId: w.org, action: { startsWith: 'marketing.site.generation' } }, orderBy: { createdAt: 'asc' } });
    expect(audit.map((a) => a.action)).toEqual(['marketing.site.generation.requested', 'marketing.site.generation.succeeded']);
    const journal = JSON.stringify(audit.map((a) => a.after));
    expect(journal).not.toContain('HERO_HEADING_SENTINEL');
    expect(journal).not.toContain('ул. Тестовая');
    expect(journal).toContain(version.id);
  });

  it('постановка: только свой сайт, без версии, с текущим брифом, строгое тело, повтор ключа даёт ту же задачу', async () => {
    const w = await world();
    const brief = await briefOf(w);
    expect((await call(w, 'POST', '/marketing/site/generations', { requestKey: randomUUID(), expectedBriefHash: brief.briefHash, type: 'SEO' })).status).toBe(400);
    expect((await call(w, 'POST', '/marketing/site/generations', { requestKey: 'x', expectedBriefHash: brief.briefHash })).status).toBe(400);

    const stale = await request(w, 'f'.repeat(64));
    expect(stale.status).toBe(409);
    expect(await db.generationRun.count({ where: { siteId: w.site } })).toBe(0);

    const key = randomUUID();
    const [a, b] = await Promise.all([request(w, brief.briefHash, key), request(w, brief.briefHash, key)]);
    expect([a.status, b.status].sort()).toEqual([200, 202]);
    expect(a.body.run.id).toBe(b.body.run.id);
    expect(await db.generationRun.count({ where: { siteId: w.site } })).toBe(1);
    // вторая задача, пока первая в очереди, не ставится
    expect((await request(w, brief.briefHash)).status).toBe(409);

    const noSite = await world({ site: false });
    const r = await request(noSite, (await briefOf(noSite)).briefHash);
    expect(r.status).toBe(409);
    expect(r.body.message).toBe('Сначала создайте сайт');

    // чужая задача не видна
    const other = await world();
    expect((await call(other, 'GET', `/marketing/site/generations/${a.body.run.id}`)).status).toBe(404);
    expect(fake.state.requests).toEqual([]);
  });

  it('сайт с версией: 409, INITIAL не правка', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    fake.state.replies.push(okReply(input));
    await worker.tick();
    expect((await run(id)).status).toBe('SUCCEEDED');
    const again = await request(w, (await briefOf(w)).briefHash);
    expect(again.status).toBe(409);
  });

  it('лимит постановок: 10 за час на человека', async () => {
    const w = await world();
    for (let i = 0; i < 10; i++)
      await sql.query(
        `INSERT INTO generation_runs (id, site_id, type, request_key, requested_by_id, brief_hash) VALUES ($1, $2, 'INITIAL', $3, $4, repeat('a', 64))`,
        [randomUUID(), w.site, randomUUID(), w.user],
      );
    await sql.query(`UPDATE generation_runs SET status = 'CANCELLED', finished_at = now() WHERE site_id = $1`, [w.site]);
    const r = await request(w, (await briefOf(w)).briefHash);
    expect(r.status).toBe(429);
  });

  it('BRIEF_CHANGED: данные филиала изменились после постановки, модель не вызывается', async () => {
    const w = await world();
    const { id } = await queued(w);
    await db.location.update({ where: { id: w.location }, data: { phone: '+7 702 222 22 22' } });
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'FAILED', errorCode: 'BRIEF_CHANGED', outputVersionId: null });
    expect(fake.state.requests).toEqual([]);
  });

  it('BASE_VERSION_CHANGED: человек сохранил версию, пока шла генерация; ручная версия остаётся последней', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    let manual = '';
    fake.state.replies.push(async () => {
      const saved = await call(w, 'POST', '/marketing/site/versions', { baseRevision: 0, spec: specFor(input, ['ru']) });
      expect(saved.status, saved.text).toBe(201);
      manual = (await db.marketingSite.findUniqueOrThrow({ where: { id: w.site } })).latestVersionId!;
      return okReply(input, usage(500, 100));
    });
    await worker.tick();
    const failed = await run(id);
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'BASE_VERSION_CHANGED', tokensInput: 500, tokensOutput: 100 });
    const site = await db.marketingSite.findUniqueOrThrow({ where: { id: w.site } });
    expect(site.latestVersionId).toBe(manual);
    expect(await db.marketingSiteVersion.count({ where: { siteId: w.site, source: 'AI' } })).toBe(0);
  });

  it('неверный ответ модели: версия не создаётся, повтор только с путём и кодом, расход всех попыток суммируется', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    const unknownSection = specFor(input, ['ru']);
    unknownSection.pages[0].sections.push({ id: 'sec-x', type: 'reviews', variant: 'LIST', heading: { ru: 'Отзывы' } });
    const wrongCategory = specFor(input, ['ru']);
    wrongCategory.pages[0].sections[1].items[0].categoryCode = 'lux';
    wrongCategory.pages[0].sections[2].categoryCodes = ['lux'];
    const withAsset = specFor(input, ['ru']);
    withAsset.site.brand = { logo: { assetId: '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b', alt: { ru: 'Лого' } } };
    fake.state.replies.push(
      { status: 'ok', spec: unknownSection, model: 'openai/a', usage: usage(1000, 100, 600) },
      { status: 'ok', spec: wrongCategory, model: 'anthropic/b', usage: usage(2000, 200, 1000, true, 2) },
      { status: 'ok', spec: withAsset, model: 'openai/a', usage: usage(100, 10) },
    );
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'QUEUED', errorCode: 'SCHEMA_INVALID', attempts: 1 });
    expect(await worker.tick()).toBeNull(); // повтор ещё не наступил
    clock = new Date(clock.getTime() + 31_000);
    await worker.tick();
    clock = new Date(clock.getTime() + 61_000);
    await worker.tick();
    const failed = await run(id);
    expect(failed).toMatchObject({ status: 'FAILED', errorCode: 'SCHEMA_INVALID', attempts: 3, tokensInput: 3100, tokensOutput: 310, tokensCached: 1600 });
    expect(await db.marketingSiteVersion.count({ where: { siteId: w.site } })).toBe(0);
    // второй и третий запросы несли ошибки прошлой проверки: путь и код, без текста ответа модели
    expect(fake.state.requests[0]!.validationErrors).toEqual([]);
    expect(fake.state.requests[1]!.validationErrors).toContainEqual({ path: 'pages[0].sections[4].type', code: 'unknown_section' });
    expect(JSON.stringify(fake.state.requests[2]!.validationErrors)).toContain('unknown_category');
    expect(JSON.stringify(failed.errorMessage)).not.toContain('Отзывы');
  });

  it.each([
    ['проза вместо JSON у бота', { status: 'error', errorCode: 'SCHEMA_INVALID', model: 'openai/a', usage: usage(10, 5) }],
    ['не тот язык', 'locales'],
    ['больше 256 КБ', 'big'],
  ])('неверный вывод «%s»: задача ждёт повтора, версии нет', async (_label, kind) => {
    const w = await world();
    const { id, input } = await queued(w);
    let reply: unknown = kind;
    if (kind === 'locales') reply = { status: 'ok', spec: specFor(input, ['en']), model: 'm', usage: usage(10, 5) };
    if (kind === 'big') {
      const spec = specFor(input, ['ru']);
      spec.pages[0].sections.push({ id: 'sec-faq', type: 'faq', variant: 'LIST', heading: { ru: 'FAQ' }, items: Array.from({ length: 30 }, (_, i) => ({ question: { ru: `В${i}` }, answer: { ru: 'я'.repeat(990) } })) });
      for (let p = 1; p < 6; p++) spec.pages.push({ ...structuredClone(spec.pages[0]), id: `page-${p}`, slug: `p${p}`, isHome: false });
      reply = { status: 'ok', spec, model: 'm', usage: usage(10, 5) };
    }
    fake.state.replies.push(reply);
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'QUEUED', errorCode: 'SCHEMA_INVALID', tokensInput: 10, tokensOutput: 5 });
    expect(await db.marketingSiteVersion.count({ where: { siteId: w.site } })).toBe(0);
  });

  it('бюджет: расход дня считается по организации, исчерпан — модель не вызывается; соседняя организация не затронута', async () => {
    process.env.SITE_GENERATION_DAILY_TOKEN_BUDGET = '5000';
    const w = await world();
    const first = await queued(w);
    fake.state.replies.push(okReply(first.input, usage(4000, 900, 3000)));
    await worker.tick();
    expect((await run(first.id)).status).toBe('SUCCEEDED');

    // 4 900 из 5 000: следующий вызов ещё разрешён (мягкий предел), остаток 100 уходит боту
    const site2 = randomUUID();
    const loc2 = randomUUID();
    await db.location.create({ data: { id: loc2, businessId: w.business, name: 'Второй', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.marketingSite.create({ data: { id: site2, locationId: loc2, name: 'Сайт 2', slug: `g-${site2.slice(0, 12)}` } });
    const w2: World = { ...w, location: loc2, site: site2, scope: `business=${w.business};location=${loc2}` };
    const second = await queued(w2);
    fake.state.replies.push({ status: 'error', errorCode: 'BUDGET_EXCEEDED', model: null, usage: usage(300, 50, null, true, 1) });
    await worker.tick();
    expect(fake.state.requests[1]!.budgetRemainingTokens).toBe(100);
    expect(await run(second.id)).toMatchObject({ status: 'FAILED', errorCode: 'BUDGET_EXCEEDED', tokensInput: 300, tokensOutput: 50 });

    // 5 250 >= 5 000: третья задача падает без вызова модели
    const loc3 = randomUUID(), site3 = randomUUID();
    await db.location.create({ data: { id: loc3, businessId: w.business, name: 'Третий', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.marketingSite.create({ data: { id: site3, locationId: loc3, name: 'Сайт 3', slug: `g-${site3.slice(0, 12)}` } });
    const third = await queued({ ...w, location: loc3, site: site3, scope: `business=${w.business};location=${loc3}` });
    const calls = fake.state.requests.length;
    await worker.tick();
    expect(await run(third.id)).toMatchObject({ status: 'FAILED', errorCode: 'BUDGET_EXCEEDED' });
    expect(fake.state.requests.length).toBe(calls);

    // другая организация тратит свой бюджет
    const other = await world();
    const theirs = await queued(other);
    fake.state.replies.push(okReply(theirs.input, usage(10, 10)));
    await worker.tick();
    expect(fake.state.requests.at(-1)!.budgetRemainingTokens).toBe(5000);
    expect((await run(theirs.id)).status).toBe('SUCCEEDED');
  });

  it('неизвестный расход: потерянный ответ даёт USAGE_UNAVAILABLE и запрещает платные вызовы организации до следующих суток UTC', async () => {
    const w = await world();
    const lost = await queued(w);
    fake.state.replies.push(new assistant.BotUnavailableError('ИИ-продавец не ответил вовремя'));
    await worker.tick();
    expect(await run(lost.id)).toMatchObject({ status: 'FAILED', errorCode: 'USAGE_UNAVAILABLE', outputVersionId: null });

    const blocked = await queued(w);
    const calls = fake.state.requests.length;
    await worker.tick();
    expect(await run(blocked.id)).toMatchObject({ status: 'FAILED', errorCode: 'USAGE_UNAVAILABLE' });
    expect(fake.state.requests.length).toBe(calls);

    // следующие сутки UTC: бюджет снова доступен
    clock = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate() + 1, 0, 5));
    const tomorrow = await queued(w);
    fake.state.replies.push(okReply(tomorrow.input));
    await worker.tick();
    expect((await run(tomorrow.id)).status).toBe('SUCCEEDED');
  });

  it('неполный расход в ответе бота: известная часть записана, задача USAGE_UNAVAILABLE, версии нет', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    fake.state.replies.push({ status: 'ok', spec: specFor(input, ['ru']), model: 'openai/a', usage: usage(700, 0, null, false, 2) });
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'FAILED', errorCode: 'USAGE_UNAVAILABLE', tokensInput: 700, outputVersionId: null });
  });

  it('повтор не переносит вчерашний run на сегодняшний бюджет: BUDGET_DAY_CHANGED без вызова', async () => {
    const w = await world();
    const { id } = await queued(w);
    fake.state.replies.push({ status: 'error', errorCode: 'MODEL_UNAVAILABLE', model: null, usage: usage(0, 0, null, true, 0) });
    clock = new Date(Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate(), 23, 59, 50));
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'QUEUED', errorCode: 'MODEL_UNAVAILABLE' });
    clock = new Date(clock.getTime() + 60_000);
    const calls = fake.state.requests.length;
    await worker.tick();
    expect(await run(id)).toMatchObject({ status: 'FAILED', errorCode: 'BUDGET_DAY_CHANGED' });
    expect(fake.state.requests.length).toBe(calls);
  });

  it('падение воркера: до отправки задача возвращается в очередь, после отправки расход неизвестен', async () => {
    const w = await world();
    const { id, input } = await queued(w);
    const claimed = await worker.claim();
    expect(claimed?.id).toBe(id);
    // воркер «умер» после захвата; аренда истекла, второй экземпляр поднимает задачу
    const second = new SiteGenerationWorker({ db } as PrismaService, briefs, fake.bot);
    second.now = () => new Date(clock.getTime() + 6 * 60_000);
    expect(await second.recover()).toBeGreaterThanOrEqual(1);
    expect(await run(id)).toMatchObject({ status: 'QUEUED', attempts: 1 });
    fake.state.replies.push(okReply(input));
    expect(await second.tick()).toBe(id);
    expect(await run(id)).toMatchObject({ status: 'SUCCEEDED', attempts: 2 });

    const w2 = await world();
    const sent = await queued(w2);
    await worker.claim();
    await sql.query(`UPDATE generation_runs SET dispatched_at = now() WHERE id = $1`, [sent.id]);
    await second.recover();
    expect(await run(sent.id)).toMatchObject({ status: 'FAILED', errorCode: 'USAGE_UNAVAILABLE' });
  });

  it('очередь: два воркера не берут одну задачу; одна организация идёт по одной, разные параллельно', async () => {
    const x = await world();
    const xRun = await queued(x);
    const loc2 = randomUUID(), site2 = randomUUID();
    await db.location.create({ data: { id: loc2, businessId: x.business, name: 'Второй', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await db.marketingSite.create({ data: { id: site2, locationId: loc2, name: 'Сайт 2', slug: `g-${site2.slice(0, 12)}` } });
    const xRun2 = await queued({ ...x, location: loc2, site: site2, scope: `business=${x.business};location=${loc2}` });
    const y = await world();
    const yRun = await queued(y);
    // в общей базе могут лежать задачи других тестов: берём только свои
    const w1 = new SiteGenerationWorker({ db } as PrismaService, briefs, fake.bot);
    const w2 = new SiteGenerationWorker({ db } as PrismaService, briefs, fake.bot);
    w1.now = w2.now = () => clock;
    const claimed = (await Promise.all([w1.claim(), w2.claim(), w1.claim()])).filter(Boolean).map((r) => r!.id);
    expect(new Set(claimed).size).toBe(claimed.length);
    const mine = [xRun.id, xRun2.id, yRun.id];
    const running = await db.generationRun.findMany({ where: { id: { in: mine }, status: 'RUNNING' }, select: { id: true, siteId: true } });
    // ровно одна задача организации X в работе (какая из двух, решает гонка захвата) и задача Y
    expect(running.map((r) => r.id)).toContain(yRun.id);
    expect(running.filter((r) => r.id === xRun.id || r.id === xRun2.id)).toHaveLength(1);
    expect(running).toHaveLength(2);
  });
});
