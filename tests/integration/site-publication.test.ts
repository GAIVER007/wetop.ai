import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';
import { SitesRuntimeModule } from '../../apps/api/src/sites-runtime/sites-runtime.module';
import { AnalyticsModule } from '../../apps/api/src/analytics/analytics.module';
import { SitesRuntimeService } from '../../apps/api/src/sites-runtime/sites-runtime.service';
import { purgeAuditRows } from '../tools/audit-purge';
import { seedSpecAssets } from '../tools/site-assets';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT7 на настоящей базе: превью, публикация, повторная публикация, пауза, возобновление, откат, архив, домен
 * платформы, связанный сайт счётчика и канонический сайт брони филиала (Q-275). Гостиницы вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const BASE_DOMAIN = 'sites.test';
const PREVIEW_SECRET = 'mkt7-preview-secret-integration-0123456789';

// документ правится в тестах вглубь (страницы, секции): точный тип SiteSpec здесь только мешает
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;
/** Документ без медиа: тексты, номера по кодам категорий объекта, цены «от» и бронь */
function specFor(name: string, codes: string[], booking: 'WETOP_WIDGET' | 'NONE' = 'WETOP_WIDGET'): Spec {
  const t = (text: string) => ({ ru: text });
  const sections: Array<Record<string, unknown>> = [
    { id: 'sec-hero', type: 'hero', variant: 'TEXT_ONLY', heading: t(name), primaryAction: { label: t('Выбрать даты'), action: { kind: 'BOOK' } } },
  ];
  if (codes.length) {
    sections.push({
      id: 'sec-rooms',
      type: 'accommodations',
      variant: 'CARDS',
      heading: t('Номера'),
      items: codes.map((code) => ({ categoryCode: code, title: t(code), description: t('Описание') })),
    });
    sections.push({ id: 'sec-pricing', type: 'pricing', variant: 'FROM_PRICES', heading: t('Цены'), categoryCodes: codes });
  }
  if (booking === 'WETOP_WIDGET') sections.push({ id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t('Забронировать') });
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t(name),
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
        title: t(name),
        seo: { title: t(name), description: t(name), index: true, includeInSitemap: true, canonical: 'SELF' },
        sections,
      },
    ],
    integrations: { booking: { mode: booking }, analytics: { mode: 'WETOP_TRACKER', consent: 'NOT_REQUIRED' } },
  };
}

describe.skipIf(!url)('MKT7 публикация управляемого сайта', () => {
  let db: Db, app: INestApplication, base: string, sql: pg.Client, runtime: SitesRuntimeService, sites: PrismaAnalyticsRepository;
  const org = randomUUID(),
    orgB = randomUUID(),
    user = randomUUID(),
    userB = randomUUID(),
    hotel = randomUUID(),
    hotelB = randomUUID();
  const L = { main: randomUUID(), auto: randomUUID(), ambiguous: randomUUID(), rates: randomUUID(), checks: randomUUID(), race: randomUUID(), kept: randomUUID() };
  const lb = randomUUID();
  const P: Record<keyof typeof L | 'b', string> = {} as never;
  const agent: Record<keyof typeof L, string> = {} as never;
  const rate: Record<string, string> = {};
  const external: Record<string, string> = {};
  const slugs: Record<keyof typeof L, string> = {} as never;
  const pointer = (location: string, business = hotel) => `business=${business};location=${location}`;

  async function call(method: string, path: string, opts: { location?: string; body?: unknown; user?: 'A' | 'B'; role?: string } = {}) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-test-user': opts.user ?? 'A',
      'x-test-role': opts.role ?? 'OWNER',
      'x-wetop-scope': opts.user === 'B' ? pointer(lb, hotelB) : pointer(opts.location ?? L.main),
    };
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  async function current(host: string) {
    try {
      return { status: 200, body: (await runtime.current({ host })) as Partial<Awaited<ReturnType<typeof runtime.current>>> };
    } catch (error) {
      return { status: (error as { getStatus?: () => number }).getStatus?.() ?? 500, body: {} as Partial<Awaited<ReturnType<typeof runtime.current>>> };
    }
  }
  async function previewOf(token: string) {
    try {
      return { status: 200, body: (await runtime.preview({ token })) as Partial<Awaited<ReturnType<typeof runtime.preview>>> };
    } catch (error) {
      return { status: (error as { getStatus?: () => number }).getStatus?.() ?? 500, body: {} as Partial<Awaited<ReturnType<typeof runtime.preview>>> };
    }
  }
  const tokenOf = (previewUrl: string) => new URL(previewUrl).searchParams.get('token')!;
  async function createSite(key: keyof typeof L) {
    slugs[key] = `mkt7-${key}-${randomUUID().slice(0, 6)}`;
    const res = await call('POST', '/marketing/site', { location: L[key], body: { name: `MKT7 ${key}`, slug: slugs[key] } });
    expect(res.status).toBe(201);
  }
  async function save(key: keyof typeof L, revision: number, spec: Spec) {
    const res = await call('POST', '/marketing/site/versions', { location: L[key], body: { baseRevision: revision, spec } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  async function siteRow(key: keyof typeof L) {
    return db.marketingSite.findFirstOrThrow({
      where: { locationId: L[key] },
      orderBy: { createdAt: 'desc' },
      include: { latestVersion: true, publishedVersion: true, domains: true, trackedSite: true },
    });
  }
  const pointerOf = async (key: keyof typeof L) =>
    (await db.location.findUniqueOrThrow({ where: { id: L[key] }, select: { bookingTrackedSiteId: true } })).bookingTrackedSiteId;
  const agentSite = (key: keyof typeof L) => sites.bookingSiteForAgent(agent[key]);
  const publications = (siteId: string) =>
    db.marketingSitePublication.findMany({ where: { siteId }, orderBy: { createdAt: 'asc' }, include: { version: true } });

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    vi.stubEnv('SITES_BASE_DOMAIN', BASE_DOMAIN);
    vi.stubEnv('SITE_PREVIEW_SECRET', PREVIEW_SECRET);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SITES_RUNTIME_DEV_RESOLVER', '');
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.test');
    db = createPrismaClient(url);
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await db.organization.createMany({
      data: [
        { id: org, name: 'MKT7 (synthetic)', status: 'ACTIVE' },
        { id: orgB, name: 'MKT7 other (synthetic)', status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: user, email: `mkt7-${user}@example.invalid`, passwordHash: 'x' },
        { id: userB, email: `mkt7-b-${userB}@example.invalid`, passwordHash: 'x' },
      ],
    });
    await db.business.createMany({
      data: [
        { id: hotel, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' },
        { id: hotelB, organizationId: orgB, name: 'Other hotel', vertical: 'HOSPITALITY' },
      ],
    });
    const all: Array<[keyof typeof L | 'b', string, string, string]> = [
      ...Object.entries(L).map(([k, id]) => [k as keyof typeof L, id, hotel, org] as [keyof typeof L, string, string, string]),
      ['b', lb, hotelB, orgB],
    ];
    for (const [key, locationId, businessId, organizationId] of all) {
      await db.location.create({
        data: { id: locationId, businessId, name: `MKT7 ${key}`, timezone: 'Asia/Almaty', currency: 'KZT' },
      });
      P[key] = randomUUID();
      await db.property.create({
        data: {
          id: P[key], organizationId, locationId, name: `MKT7 ${key}`, timezone: 'Asia/Almaty', currency: 'KZT',
          checkInTime: '14:00', checkOutTime: '12:00',
        },
      });
      await db.accommodationType.create({
        data: { propertyId: P[key], code: 'std', name: 'Стандарт', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
      });
      rate[key] = (await db.ratePlan.create({ data: { propertyId: P[key], code: 'BASE', name: 'База', currency: 'KZT' } })).id;
      if (key !== 'b') {
        agent[key] = randomUUID();
        await db.sellerAgent.create({ data: { id: agent[key], organizationId, createdBy: user, name: `Продавец ${key}`, locationId } });
      }
    }
    rate['mainB'] = (await db.ratePlan.create({ data: { propertyId: P.main, code: 'SITE', name: 'Сайт', currency: 'KZT' } })).id;
    rate['inactive'] = (await db.ratePlan.create({ data: { propertyId: P.rates, code: 'OLD', name: 'Старый', currency: 'KZT', active: false } })).id;
    const ts = (propertyId: string, name: string, ratePlanId: string | null) =>
      db.trackedSite.create({
        data: {
          propertyId, name, hosts: [`${name.toLowerCase()}.example.test`], publicKey: `pms_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
          bookingEnabled: ratePlanId !== null, bookingRatePlanId: ratePlanId,
        },
      });
    // внешний сайт A у основного филиала: канонический сайт брони (Q-275)
    external['mainA'] = (await ts(P.main, 'ExternalA', rate['main']!)).id;
    await db.location.update({ where: { id: L.main }, data: { bookingTrackedSiteId: external['mainA'] } });
    // у неоднозначного филиала два подходящих внешних сайта, указателя нет
    external['amb1'] = (await ts(P.ambiguous, 'Amb1', rate['ambiguous']!)).id;
    external['amb2'] = (await ts(P.ambiguous, 'Amb2', rate['ambiguous']!)).id;
    // у филиала kept канонический внешний сайт выбран, но сейчас на паузе: подходящих других нет
    external['kept'] = (await ts(P.kept, 'Kept', rate['kept']!)).id;
    await db.location.update({ where: { id: L.kept }, data: { bookingTrackedSiteId: external['kept'] } });
    await db.trackedSite.update({ where: { id: external['kept'] }, data: { status: 'PAUSED' } });

    const module = await Test.createTestingModule({ imports: [MarketingSiteModule, SitesRuntimeModule, AnalyticsModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      const b = req.headers['x-test-user'] === 'B';
      req.user = { id: b ? userB : user, organizationId: b ? orgB : org, role: req.headers['x-test-role'] ?? 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    runtime = app.get(SitesRuntimeService);
    sites = new PrismaAnalyticsRepository({ db } as PrismaService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    const orgs = [org, orgB];
    if (sql) {
      const siteIds = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      await sql.query('ALTER TABLE marketing_site_publications DISABLE TRIGGER marketing_site_publication_immutable');
      await sql.query(`DELETE FROM marketing_site_publications WHERE site_id IN (${siteIds})`, [orgs]);
      await sql.query(`DELETE FROM site_domains WHERE site_id IN (${siteIds})`, [orgs]);
      await sql.query(
        `UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL, tracked_site_id = NULL,
           state = 'ARCHIVED', archived_at = coalesce(archived_at, now()) WHERE id IN (${siteIds})`,
        [orgs],
      );
      await sql.query(`UPDATE marketing_site_versions SET parent_version_id = NULL WHERE site_id IN (${siteIds})`, [orgs]);
      await sql.query(`DELETE FROM marketing_site_versions WHERE site_id IN (${siteIds})`, [orgs]);
      await sql.query(`DELETE FROM marketing_sites WHERE id IN (${siteIds})`, [orgs]);
      await sql.query(
        `UPDATE locations SET booking_tracked_site_id = NULL WHERE business_id IN (SELECT id FROM businesses WHERE organization_id = ANY($1::uuid[]))`,
        [orgs],
      );
      await sql.query('ALTER TABLE marketing_site_publications ENABLE TRIGGER marketing_site_publication_immutable');
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await purgeAuditRows(db, { organizationId: { in: orgs } });
      await db.siteAsset.deleteMany({ where: { location: { business: { organizationId: { in: orgs } } } } });
      await db.sellerAgent.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.trackedSite.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.ratePlan.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.accommodationType.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.location.deleteMany({ where: { business: { organizationId: { in: orgs } } } });
      await db.business.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.user.deleteMany({ where: { id: { in: [user, userB] } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      expect(await db.organization.count({ where: { id: { in: orgs } } })).toBe(0);
      await db.$disconnect();
    }
  });

  it('§79 и §80: превью, публикация, новая версия, откат, пауза; внешний канонический сайт не подменяется', async () => {
    // Q-275: до публикации продавец берёт внешний канонический A
    expect((await agentSite('main'))?.id).toBe(external['mainA']);

    await createSite('main');
    await save('main', 0, specFor('Ревизия 1', ['std']));
    let site = await siteRow('main');
    const v1 = site.latestVersionId!;

    // превью ревизии 1: ровно эта версия, без ключа сайта, брони и счётчика, до публикации
    const p1 = await call('POST', '/marketing/site/preview', { body: { versionId: v1 } });
    expect(p1.status).toBe(200);
    expect(new URL(p1.body.url).host).toBe(`preview.${BASE_DOMAIN}`);
    expect(Date.parse(p1.body.expiresAt) - Date.now()).toBeGreaterThan(59 * 60_000);
    const pv1 = await previewOf(tokenOf(p1.body.url));
    expect(pv1.status).toBe(200);
    expect(pv1.body).toMatchObject({ state: 'PREVIEW', versionId: v1, publicKey: null, bookingEnabled: false });
    expect(await db.siteDomain.count({ where: { siteId: site.id } })).toBe(0);
    expect(await db.webSession.count({ where: { site: { propertyId: P.main } } })).toBe(0);

    // публикация: домен платформы, свой сайт счётчика с тарифом из запроса, канонический A остаётся
    const pub = await call('POST', '/marketing/site/publish', { body: { expectedVersionId: v1, bookingRatePlanId: rate['mainB'] } });
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);
    expect(pub.body.site).toMatchObject({ state: 'PUBLISHED', url: `https://${slugs.main}.${BASE_DOMAIN}` });
    site = await siteRow('main');
    expect(site.state).toBe('PUBLISHED');
    expect(site.publishedVersionId).toBe(v1);
    expect(site.domains).toHaveLength(1);
    expect(site.domains[0]).toMatchObject({ host: `${slugs.main}.${BASE_DOMAIN}`, kind: 'PLATFORM_SUBDOMAIN', status: 'ACTIVE', isPrimary: true });
    expect(site.trackedSite).toMatchObject({ status: 'ACTIVE', bookingEnabled: true, bookingRatePlanId: rate['mainB'] });
    expect(site.trackedSite!.hosts).toEqual([`${slugs.main}.${BASE_DOMAIN}`]);
    expect(site.trackedSiteId).not.toBe(external['mainA']);
    expect(site.trackedSite!.publicKey).toMatch(/^pms_[0-9a-f]{12}$/);
    expect(await pointerOf('main')).toBe(external['mainA']);
    expect((await agentSite('main'))?.id).toBe(external['mainA']);
    expect((await agentSite('main'))?.bookingRatePlan?.id).toBe(rate['main']);
    const managed = site.trackedSiteId!;

    // рантайм по хосту: ревизия 1, основной хост настоящий
    const host = `${slugs.main}.${BASE_DOMAIN}`;
    let live = await current(host);
    expect(live.status).toBe(200);
    expect(live.body).toMatchObject({ versionId: v1, primaryHost: host, bookingEnabled: true });

    // ревизия 2 сохранена: рантайм всё ещё ревизия 1; превью ревизии 2; публикация ревизии 2
    await save('main', 1, specFor('Ревизия 2', ['std']));
    const v2 = (await siteRow('main')).latestVersionId!;
    expect((await current(host)).body.versionId).toBe(v1);
    const p2 = await call('POST', '/marketing/site/preview', { body: { versionId: v2 } });
    expect((await previewOf(tokenOf(p2.body.url))).body.versionId).toBe(v2);
    expect((await call('POST', '/marketing/site/publish', { body: { expectedVersionId: v2 } })).status).toBe(200);
    expect((await current(host)).body.versionId).toBe(v2);
    // повтор той же публикации: без второй строки журнала
    expect((await call('POST', '/marketing/site/publish', { body: { expectedVersionId: v2 } })).status).toBe(200);

    // откат на ревизию 1: опубликована ревизия 1, голова черновика остаётся ревизией 2
    const rb = await call('POST', '/marketing/site/rollback', { body: { versionId: v1 } });
    expect(rb.status, JSON.stringify(rb.body)).toBe(200);
    expect((await current(host)).body.versionId).toBe(v1);
    site = await siteRow('main');
    expect(site.latestVersionId).toBe(v2);
    expect(site.publishedVersionId).toBe(v1);

    // пауза: хост скрыт; возобновление: снова ревизия 1
    expect((await call('POST', '/marketing/site/pause')).status).toBe(200);
    expect((await current(host)).status).toBe(404);
    expect((await siteRow('main')).trackedSite!.status).toBe('PAUSED');
    expect((await siteRow('main')).domains[0]!.status).toBe('ACTIVE');
    expect((await call('POST', '/marketing/site/resume')).status).toBe(200);
    live = await current(host);
    expect(live.body.versionId).toBe(v1);

    const journal = await publications(site.id);
    expect(journal.map((p) => [p.action, p.version?.revision ?? null])).toEqual([
      ['PUBLISH', 1],
      ['PUBLISH', 2],
      ['ROLLBACK', 1],
      ['PAUSE', null],
      ['RESUME', 1],
    ]);
    const history = await call('GET', '/marketing/site/publications');
    expect(history.status).toBe(200);
    expect(history.body.publications).toHaveLength(5);
    expect(JSON.stringify(history.body)).not.toContain('sec-hero');

    // явный выбор: управляемый сайт B стал каноническим, продавец берёт его тариф
    const sel = await call('PUT', '/marketing/site/booking-source', { body: { trackedSiteId: managed } });
    expect(sel.status, JSON.stringify(sel.body)).toBe(200);
    expect((await agentSite('main'))?.id).toBe(managed);
    expect((await agentSite('main'))?.bookingRatePlan?.id).toBe(rate['mainB']);
  });

  it('§82: пауза канонического управляемого сайта: указатель остаётся, продавец без сайта; возобновление возвращает', async () => {
    expect((await call('POST', '/marketing/site/pause')).status).toBe(200);
    const managed = (await siteRow('main')).trackedSiteId!;
    expect(await pointerOf('main')).toBe(managed);
    expect(await agentSite('main')).toBeNull();
    expect((await call('POST', '/marketing/site/resume')).status).toBe(200);
    expect((await agentSite('main'))?.id).toBe(managed);
  });

  it('MKT7 доводка: хосты сайта счётчика управляемого сайта ровно ACTIVE-домены; чужой хост уходит при синхронизации', async () => {
    const site = await siteRow('main');
    const real = `${slugs.main}.${BASE_DOMAIN}`;
    // строку подменили в обход публикации (старый путь, ручной SQL): лишний хост не должен пережить синхронизацию
    await db.trackedSite.update({ where: { id: site.trackedSiteId! }, data: { hosts: [real, 'rogue.example.com'] } });
    expect((await call('POST', '/marketing/site/pause')).status).toBe(200);
    expect((await call('POST', '/marketing/site/resume')).status).toBe(200);
    expect((await siteRow('main')).trackedSite!.hosts).toEqual([real]);
  });

  it('MKT7 доводка: старый /analytics/sites не правит и не удаляет сайт счётчика управляемого сайта; внешний как раньше', async () => {
    const site = await siteRow('main');
    const managed = site.trackedSiteId!;
    const before = await db.trackedSite.findUniqueOrThrow({ where: { id: managed } });
    const pointerBefore = await pointerOf('main');
    for (const body of [
      { hosts: ['rogue.example.com'] },
      { status: 'PAUSED' },
      { bookingEnabled: false },
      { bookingRatePlanCode: 'BASE' },
      { name: 'Чужое имя' },
    ]) {
      const r = await call('PATCH', `/analytics/sites/${managed}`, { body });
      expect(r.status, JSON.stringify(r.body)).toBe(409);
      expect(r.body.code).toBe('MANAGED_SITE_READ_ONLY');
    }
    const del = await call('DELETE', `/analytics/sites/${managed}`);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('MANAGED_SITE_READ_ONLY');
    expect(await db.trackedSite.findUniqueOrThrow({ where: { id: managed } })).toEqual(before);
    expect((await siteRow('main')).trackedSiteId).toBe(managed);
    expect(await pointerOf('main')).toBe(pointerBefore);
    expect((await current(`${slugs.main}.${BASE_DOMAIN}`)).status).toBe(200);
    // чтение остаётся и помечает сайт
    const card = await call('GET', `/analytics/sites/${managed}`);
    expect(card.status).toBe(200);
    expect(card.body.site.managed).toBe(true);
    // защита в репозитории, если проверку сервиса обойдут: тот же филиал, что у запроса, без сервиса
    const asOwner = <T,>(fn: () => Promise<T>) =>
      withSignedInUser(
        { userId: user, organizationId: org, scope: 'LOCATION', businessId: hotel, locationId: L.main, vertical: 'HOSPITALITY' },
        fn,
      );
    expect(await asOwner(() => sites.updateSite(managed, { hosts: ['rogue.example.com'] }))).toBeNull();
    expect(await asOwner(() => sites.deleteSite(managed))).toBe(false);
    expect(await db.trackedSite.findUniqueOrThrow({ where: { id: managed } })).toEqual(before);
    // внешний сайт: создание, правка и удаление по прежнему контракту
    const created = await call('POST', '/analytics/sites', { body: { name: 'Внешний MKT7', hosts: ['ext-mkt7.example.test'] } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.site.managed).toBe(false);
    const id = created.body.site.id;
    const patched = await call('PATCH', `/analytics/sites/${id}`, { body: { status: 'PAUSED', hosts: ['ext2-mkt7.example.test'] } });
    expect(patched.status).toBe(200);
    expect(patched.body.site).toMatchObject({ status: 'PAUSED', hosts: ['ext2-mkt7.example.test'] });
    expect((await call('DELETE', `/analytics/sites/${id}`)).status).toBe(200);
    expect(await db.trackedSite.findUnique({ where: { id } })).toBeNull();
  });

  it('§83: архив снимает указатель с управляемого сайта, внешний A сам не выбирается', async () => {
    const before = await siteRow('main');
    const res = await call('POST', '/marketing/site/archive');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const after = await db.marketingSite.findUniqueOrThrow({ where: { id: before.id }, include: { domains: true, trackedSite: true } });
    expect(after.state).toBe('ARCHIVED');
    expect(after.domains.map((d) => d.status)).toEqual(['REMOVED']);
    expect(after.trackedSite).toMatchObject({ status: 'PAUSED', hosts: [] });
    expect(await pointerOf('main')).toBeNull();
    expect(await agentSite('main')).toBeNull();
    expect((await current(`${slugs.main}.${BASE_DOMAIN}`)).status).toBe(404);
    expect((await publications(before.id)).at(-1)?.action).toBe('ARCHIVE');
  });

  it('§31: канонического нет и других подходящих нет: первая публикация с бронью делает управляемый сайт каноническим', async () => {
    await createSite('auto');
    await save('auto', 0, specFor('Авто', ['std']));
    const v1 = (await siteRow('auto')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.auto, body: { expectedVersionId: v1, bookingRatePlanId: rate['auto'] } })).status).toBe(200);
    const site = await siteRow('auto');
    expect(await pointerOf('auto')).toBe(site.trackedSiteId);
    expect((await agentSite('auto'))?.id).toBe(site.trackedSiteId);
  });

  it('§31–§32: выбранный канонический сайт (даже на паузе) публикация не подменяет, продавец на другой не переходит', async () => {
    expect(await agentSite('kept')).toBeNull();
    await createSite('kept');
    await save('kept', 0, specFor('Сохранён', ['std']));
    const v1 = (await siteRow('kept')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.kept, body: { expectedVersionId: v1, bookingRatePlanId: rate['kept'] } })).status).toBe(200);
    expect(await pointerOf('kept')).toBe(external['kept']);
    expect(await agentSite('kept')).toBeNull();
  });

  it('§81: два подходящих сайта без указателя: продавец без сайта, публикация указатель не ставит', async () => {
    expect(await pointerOf('ambiguous')).toBeNull();
    expect(await agentSite('ambiguous')).toBeNull();
    await createSite('ambiguous');
    await save('ambiguous', 0, specFor('Неоднозначно', ['std']));
    const v1 = (await siteRow('ambiguous')).latestVersionId!;
    const res = await call('POST', '/marketing/site/publish', { location: L.ambiguous, body: { expectedVersionId: v1, bookingRatePlanId: rate['ambiguous'] } });
    expect(res.status).toBe(200);
    expect(await pointerOf('ambiguous')).toBeNull();
    expect(await agentSite('ambiguous')).toBeNull();
    const source = await call('GET', '/marketing/site/booking-source', { location: L.ambiguous });
    expect(source.body.canonicalTrackedSiteId).toBeNull();
    expect(source.body.options).toHaveLength(3);
    expect(source.body.options.filter((o: { managed: boolean }) => o.managed)).toHaveLength(1);
  });

  it('§84: тариф брони только явный, связанный или канонический; первый активный не берётся', async () => {
    await createSite('rates');
    await save('rates', 0, specFor('Тарифы', ['std']));
    const v1 = (await siteRow('rates')).latestVersionId!;
    const publish = (body: Record<string, unknown>) => call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: v1, ...body } });
    // у объекта есть активный тариф BASE, но источника нет: 409, а не «первый активный»
    const none = await publish({});
    expect(none.status).toBe(409);
    expect(none.body.code).toBe('BOOKING_RATE_PLAN_REQUIRED');
    expect((await publish({ bookingRatePlanId: rate['main'] })).body.code).toBe('BOOKING_RATE_PLAN_INVALID');
    expect((await publish({ bookingRatePlanId: rate['inactive'] })).body.code).toBe('BOOKING_RATE_PLAN_INVALID');
    expect((await publish({ bookingRatePlanId: 'not-a-uuid' })).status).toBe(400);
    expect((await publish({ host: 'bank.com' })).status).toBe(400);
    expect((await siteRow('rates')).state).toBe('DRAFT');
    // бронирование выключено в документе: публикация без тарифа
    await save('rates', 1, specFor('Без брони', ['std'], 'NONE'));
    const v2 = (await siteRow('rates')).latestVersionId!;
    const noBooking = await call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: v2 } });
    expect(noBooking.status, JSON.stringify(noBooking.body)).toBe(200);
    const site = await siteRow('rates');
    expect(site.trackedSite).toMatchObject({ bookingEnabled: false, bookingRatePlanId: null });
    expect(await pointerOf('rates')).toBeNull();
    // повторная публикация с бронью без явного тарифа: тариф связанного сайта нет, канонического нет: 409
    await save('rates', 2, specFor('С бронью', ['std']));
    const v3 = (await siteRow('rates')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: v3 } })).body.code).toBe(
      'BOOKING_RATE_PLAN_REQUIRED',
    );
    expect((await call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: v3, bookingRatePlanId: rate['rates'] } })).status).toBe(200);
    // дальше тариф берётся у связанного сайта
    await save('rates', 3, specFor('С бронью 2', ['std']));
    const v4 = (await siteRow('rates')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: v4 } })).status).toBe(200);
    expect((await siteRow('rates')).trackedSite!.bookingRatePlanId).toBe(rate['rates']);
  });

  it('§50, §59: публикация и откат на паузе меняют версию, но сайт не открывается до возобновления', async () => {
    const host = `${slugs.rates}.${BASE_DOMAIN}`;
    const before = await siteRow('rates');
    const journal = await publications(before.id);
    const earlier = journal.find((p) => p.action === 'PUBLISH' && p.versionId !== before.publishedVersionId)!.versionId!;
    expect((await call('POST', '/marketing/site/pause', { location: L.rates })).status).toBe(200);
    expect((await call('POST', '/marketing/site/rollback', { location: L.rates, body: { versionId: earlier } })).status).toBe(200);
    expect((await siteRow('rates')).state).toBe('PAUSED');
    expect((await current(host)).status).toBe(404);
    // новая версия на паузе: публикуется, но сайт остаётся на паузе
    await save('rates', (await siteRow('rates')).latestVersion!.revision, specFor('На паузе', ['std']));
    const vp = (await siteRow('rates')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.rates, body: { expectedVersionId: vp } })).status).toBe(200);
    expect((await siteRow('rates')).state).toBe('PAUSED');
    expect((await current(host)).status).toBe(404);
    expect((await call('POST', '/marketing/site/resume', { location: L.rates })).status).toBe(200);
    expect((await current(host)).body.versionId).toBe(vp);
  });

  it('§44–§47: публикуется только голова черновика, документ перепроверяется: картинки (MKT8) и неактивная категория', async () => {
    await createSite('checks');
    const withGallery = (ids: string[]) => {
      const spec = specFor('Галерея', ['std'], 'NONE');
      spec.pages[0].sections.push({
        id: 'sec-gallery', type: 'gallery', variant: 'GRID', heading: { ru: 'Фото' }, images: ids.map((assetId, n) => ({ assetId, alt: { ru: `Фото ${n}` } })),
      });
      return spec;
    };
    await save('checks', 0, specFor('Ок', ['std'], 'NONE'));
    const v1 = (await siteRow('checks')).latestVersionId!;
    // MKT8 (§81): ссылки на картинки проверяются по библиотеке филиала; общего отказа MEDIA_NOT_READY больше нет
    const own = [randomUUID(), randomUUID(), randomUUID()];
    await seedSpecAssets(db, L.checks, withGallery(own));
    const [foreign] = await seedSpecAssets(db, L.rates, withGallery([randomUUID()]));
    const logo = randomUUID();
    const logoSpec = specFor('Лого', [], 'NONE');
    logoSpec.site.brand = { logo: { assetId: logo, alt: { ru: 'Лого' } } };
    await seedSpecAssets(db, L.checks, logoSpec);
    for (const [label, ids, code] of [
      ['нет в библиотеке', [own[0]!, own[1]!, randomUUID()], 'unavailable'],
      ['ассет другого филиала', [own[0]!, own[1]!, foreign!], 'unavailable'],
      ['логотип вместо картинки', [own[0]!, own[1]!, logo], 'wrong_kind'],
    ] as const) {
      const res = await call('POST', '/marketing/site/versions', { location: L.checks, body: { baseRevision: 1, spec: withGallery([...ids]) } });
      expect(res.status, label).toBe(409);
      expect(res.body.code, label).toBe('ASSET_UNAVAILABLE');
      expect(res.body.paths, label).toEqual([{ path: 'pages[0].sections[3].images[2].assetId', code }]);
      expect(JSON.stringify(res.body), label).not.toContain(L.rates);
    }
    expect((await siteRow('checks')).latestVersion!.revision).toBe(1);
    // свои готовые картинки: версия сохраняется
    await save('checks', 1, withGallery(own));
    const v2 = (await siteRow('checks')).latestVersionId!;
    // картинку удалили из библиотеки до публикации: новая версия не публикуется
    await db.siteAsset.update({ where: { id: own[2]! }, data: { status: 'DELETED', deletedAt: new Date() } });
    const media = await call('POST', '/marketing/site/publish', { location: L.checks, body: { expectedVersionId: v2 } });
    expect(media.status).toBe(409);
    expect(media.body.code).toBe('ASSET_UNAVAILABLE');
    expect((await siteRow('checks')).state).toBe('DRAFT');
    // старую версию публикацией не протолкнуть: для неё есть откат
    const old = await call('POST', '/marketing/site/publish', { location: L.checks, body: { expectedVersionId: v1 } });
    expect(old.status).toBe(409);
    expect(old.body.code).toBe('VERSION_CHANGED');
    await save('checks', 2, specFor('Снова ок', ['std'], 'NONE'));
    const ok = (await siteRow('checks')).latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.checks, body: { expectedVersionId: ok } })).status).toBe(200);
    // откат: версия, которая не публиковалась, и чужая версия
    const never = await call('POST', '/marketing/site/rollback', { location: L.checks, body: { versionId: v1 } });
    expect(never.status).toBe(409);
    expect(never.body.code).toBe('NEVER_PUBLISHED');
    const foreignVersion = (await siteRow('auto')).latestVersionId!;
    expect((await call('POST', '/marketing/site/rollback', { location: L.checks, body: { versionId: foreignVersion } })).status).toBe(404);
    // категория стала неактивной: новая публикация отклонена целиком
    await db.accommodationType.updateMany({ where: { propertyId: P.checks, code: 'std' }, data: { active: false } });
    const latest = await siteRow('checks');
    await save('checks', latest.latestVersion!.revision, specFor('После архивации категории', ['std'], 'NONE'));
    const vx = (await siteRow('checks')).latestVersionId!;
    const cat = await call('POST', '/marketing/site/publish', { location: L.checks, body: { expectedVersionId: vx } });
    expect(cat.status).toBe(409);
    expect(cat.body.code).toBe('CATEGORY_UNAVAILABLE');
    expect((await siteRow('checks')).publishedVersionId).toBe(ok);
    await db.accommodationType.updateMany({ where: { propertyId: P.checks, code: 'std' }, data: { active: true } });
  });

  it('§88: две одновременные публикации одной версии: одна строка журнала, один домен, один сайт счётчика', async () => {
    await createSite('race');
    await save('race', 0, specFor('Гонка', ['std'], 'NONE'));
    const v1 = (await siteRow('race')).latestVersionId!;
    const [a, b] = await Promise.all([
      call('POST', '/marketing/site/publish', { location: L.race, body: { expectedVersionId: v1 } }),
      call('POST', '/marketing/site/publish', { location: L.race, body: { expectedVersionId: v1 } }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const site = await siteRow('race');
    expect(await db.marketingSitePublication.count({ where: { siteId: site.id } })).toBe(1);
    expect(await db.siteDomain.count({ where: { siteId: site.id } })).toBe(1);
    expect(await db.trackedSite.count({ where: { propertyId: P.race } })).toBe(1);
  });

  it('§90: превью чужой версии и чужим филиалом: отказ без подробностей; лишнее поле 400', async () => {
    const own = (await siteRow('race')).latestVersionId!;
    expect((await call('POST', '/marketing/site/preview', { location: L.auto, body: { versionId: own } })).status).toBe(404);
    expect((await call('POST', '/marketing/site/preview', { user: 'B', body: { versionId: own } })).status).toBe(404);
    expect((await call('POST', '/marketing/site/preview', { location: L.race, body: { versionId: own, ttl: 999999 } })).status).toBe(400);
    expect((await call('POST', '/marketing/site/preview', { location: L.race, body: { versionId: own }, role: 'STAFF' })).status).toBe(403);
  });

  it('§77, §20: источник брони только сайт точного объекта и только подходящий; администратор не меняет', async () => {
    const foreign = external['amb1'];
    expect((await call('PUT', '/marketing/site/booking-source', { location: L.auto, body: { trackedSiteId: foreign } })).status).toBe(404);
    expect((await call('PUT', '/marketing/site/booking-source', { location: L.auto, body: { trackedSiteId: null }, role: 'STAFF' })).status).toBe(403);
    expect((await call('PUT', '/marketing/site/booking-source', { location: L.auto, body: { trackedSiteId: null } })).status).toBe(200);
    expect(await pointerOf('auto')).toBeNull();
    // приостановленный сайт выбрать нельзя
    const paused = (await siteRow('main')).trackedSiteId!;
    expect((await call('PUT', '/marketing/site/booking-source', { location: L.main, body: { trackedSiteId: paused } })).body.code).toBe(
      'BOOKING_SOURCE_NOT_ELIGIBLE',
    );
  });

  it('§98: SITES_BASE_DOMAIN не задан или под wetop.ai: публикация и превью 503; без секрета превью 503', async () => {
    // у основного филиала сайт в архиве: можно завести новый черновик
    await createSite('main');
    await save('main', 0, specFor('После архива', ['std'], 'NONE'));
    const v1 = (await siteRow('main')).latestVersionId!;
    for (const bad of ['', 'wetop.ai', 'sites.wetop.ai', 'https://sites.test']) {
      vi.stubEnv('SITES_BASE_DOMAIN', bad);
      const pub = await call('POST', '/marketing/site/publish', { body: { expectedVersionId: v1 } });
      expect(pub.status, bad).toBe(503);
      expect((await call('POST', '/marketing/site/preview', { body: { versionId: v1 } })).status).toBe(503);
    }
    vi.stubEnv('SITES_BASE_DOMAIN', BASE_DOMAIN);
    expect((await siteRow('main')).state).toBe('DRAFT');
    vi.stubEnv('SITE_PREVIEW_SECRET', 'short');
    expect((await call('POST', '/marketing/site/preview', { body: { versionId: v1 } })).status).toBe(503);
    vi.stubEnv('SITE_PREVIEW_SECRET', PREVIEW_SECRET);
    expect((await call('POST', '/marketing/site/preview', { body: { versionId: v1 } })).status).toBe(200);
  });
});
