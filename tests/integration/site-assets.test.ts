import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import type { ContentReader } from '../../apps/api/src/channels/content';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { SitesRuntimeModule } from '../../apps/api/src/sites-runtime/sites-runtime.module';
import { SitesRuntimeService } from '../../apps/api/src/sites-runtime/sites-runtime.service';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { BRIEF_CHANNEX_READER } from '../../apps/api/src/marketing-site/brief.service';
import { MemorySiteAssetStorage, SITE_ASSET_STORAGE } from '../../apps/api/src/marketing-site/asset-storage';
import { ASSET_FETCH_DEPS, channexPhotoId, resetAssetRateLimit } from '../../apps/api/src/marketing-site/site-assets.service';
import type { SafeFetchDeps } from '../../apps/api/src/marketing-site/asset-fetch';
import { purgeAuditRows } from '../tools/audit-purge';
import { grantSiteBuilder, purgeSiteBuilderRows } from '../tools/site-builder';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT8 на настоящей базе: библиотека изображений сайта (загрузка, повтор, гонка, ALT, удаление с историей публикаций и
 * без), импорт фото Channex точного объекта с защитой от SSRF, проверка ссылок версии при сохранении, публикации,
 * откате и превью, карта подписанных адресов рантайма. Хранилище в памяти, Channex и скачивание подставные. Гостиницы
 * и фото вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const BASE_DOMAIN = 'sites.test';
const PREVIEW_SECRET = 'mkt8-preview-secret-integration-0123456789';
const PUBLIC_IP = '93.184.216.34';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;
function specWith(name: string, images: { hero?: string; og?: string; logo?: string } = {}): Spec {
  const t = (text: string) => ({ ru: text });
  return {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t(name),
      defaultLocale: 'ru',
      locales: ['ru'],
      ...(images.logo ? { brand: { logo: { assetId: images.logo, alt: t('Логотип') } } } : {}),
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
        seo: {
          title: t(name),
          description: t(name),
          index: true,
          includeInSitemap: true,
          canonical: 'SELF',
          ...(images.og ? { og: { imageAssetId: images.og } } : {}),
        },
        sections: [
          {
            id: 'sec-hero',
            type: 'hero',
            variant: images.hero ? 'IMAGE_FULL' : 'TEXT_ONLY',
            heading: t(name),
            primaryAction: { label: t('Наверх'), action: { kind: 'PAGE', pageId: 'page-home' } },
            ...(images.hero ? { image: { assetId: images.hero, alt: t('Фасад гостиницы') } } : {}),
          },
        ],
      },
    ],
    integrations: { booking: { mode: 'NONE' }, analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } },
  };
}

/** JPEG с EXIF: камера, серийный номер и GPS, как фото с телефона владельца */
async function photo(seed: number, width = 64, height = 48): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: seed % 256, g: (seed * 7) % 256, b: (seed * 13) % 256 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCam', Model: 'SN-OWNER-PHONE' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 10/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '71/1 26/1 0/1' },
    })
    .toBuffer();
}

describe.skipIf(!url)('MKT8 библиотека изображений сайта', () => {
  let db: Db, app: INestApplication, base: string, sql: pg.Client, runtime: SitesRuntimeService;
  const storage = new MemorySiteAssetStorage();
  const org = randomUUID(),
    orgB = randomUUID(),
    user = randomUUID(),
    userB = randomUUID(),
    hotel = randomUUID(),
    hotelB = randomUUID();
  const L = { a: randomUUID(), b: randomUUID(), hist: randomUUID(), race: randomUUID(), rate: randomUUID() };
  const lx = randomUUID();
  const P: Record<string, string> = {};
  const photos: Record<string, Array<{ url: string; description?: string; room?: boolean }>> = {};
  const served: Record<string, { status: number; body?: Buffer; location?: string }> = {};
  const pointer = (location: string, business = hotel) => `business=${business};location=${location}`;

  async function call(method: string, path: string, opts: { location?: string; body?: unknown; user?: 'A' | 'B'; role?: string } = {}) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-test-user': opts.user ?? 'A',
        'x-test-role': opts.role ?? 'OWNER',
        'x-wetop-scope': opts.user === 'B' ? pointer(lx, hotelB) : pointer(opts.location ?? L.a),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  async function upload(
    bytes: Buffer,
    kind: string | null = 'IMAGE',
    opts: { location?: string; user?: 'A' | 'B'; role?: string; fields?: Record<string, string> } = {},
  ) {
    const form = new FormData();
    if (kind !== null) form.append('kind', kind);
    for (const [k, v] of Object.entries(opts.fields ?? {})) form.append(k, v);
    form.append('file', new Blob([new Uint8Array(bytes)]), 'IMG_0001.jpg');
    const res = await fetch(`${base}/marketing/site/assets`, {
      method: 'POST',
      headers: {
        'x-test-user': opts.user ?? 'A',
        'x-test-role': opts.role ?? 'OWNER',
        'x-wetop-scope': opts.user === 'B' ? pointer(lx, hotelB) : pointer(opts.location ?? L.a),
      },
      body: form,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  async function createSite(key: keyof typeof L) {
    // MKT9.2: сайт заводится пустым телом, имя и адрес из филиала
    const res = await call('POST', '/marketing/site/bootstrap', { location: L[key], body: {} });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
  }
  async function save(key: keyof typeof L, spec: Spec) {
    const site = await siteRow(key);
    return call('POST', '/marketing/site/versions', { location: L[key], body: { baseRevision: site?.latestVersion?.revision ?? 0, spec } });
  }
  const siteRow = (key: keyof typeof L) =>
    db.marketingSite.findFirst({ where: { locationId: L[key] }, orderBy: { createdAt: 'desc' }, include: { latestVersion: true, domains: true } });
  async function current(host: string) {
    try {
      return { status: 200, body: await runtime.current({ host }) };
    } catch (error) {
      return { status: (error as { getStatus?: () => number }).getStatus?.() ?? 500, body: null };
    }
  }
  const auditOf = (assetId: string) => db.auditLog.findMany({ where: { entityId: assetId }, orderBy: { createdAt: 'asc' } });

  const fetchDeps: SafeFetchDeps = {
    async resolve(hostname) {
      if (hostname === 'img.channex.io') return [PUBLIC_IP];
      if (hostname === 'internal.example.com') return ['10.0.0.7'];
      throw new Error('ENOTFOUND');
    },
    async get(u) {
      const r = served[u.toString()];
      if (!r) throw new Error('ECONNREFUSED');
      const body = r.body ?? Buffer.alloc(0);
      return {
        status: r.status,
        location: r.location ?? null,
        contentLength: body.length,
        body: (async function* () {
          yield body;
        })(),
        abort: () => undefined,
      };
    },
  };
  const reader = {
    async getProperty(id: string) {
      return { id, type: 'property', attributes: { title: id, content: {}, facilities: [] } };
    },
    async listPropertyFacilities() {
      return [];
    },
    async listAll(path: string, filter: Record<string, string>) {
      if (path !== '/photos') return [];
      return (photos[filter['filter[property_id]']!] ?? []).map((p, i) => ({
        id: `ph${i}`,
        type: 'photo',
        attributes: { url: p.url, description: p.description ?? null, position: i, ...(p.room ? { room_type_id: 'rt' } : {}) },
      }));
    },
  } as unknown as ContentReader;

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
        { id: org, name: 'MKT8 (synthetic)', status: 'ACTIVE' },
        { id: orgB, name: 'MKT8 other (synthetic)', status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: user, email: `mkt8-${user}@example.invalid`, passwordHash: 'x' },
        { id: userB, email: `mkt8-b-${userB}@example.invalid`, passwordHash: 'x' },
      ],
    });
    await db.business.createMany({
      data: [
        { id: hotel, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' },
        { id: hotelB, organizationId: orgB, name: 'Other hotel', vertical: 'HOSPITALITY' },
      ],
    });
    const all: Array<[string, string, string, string]> = [
      ...Object.entries(L).map(([k, id]) => [k, id, hotel, org] as [string, string, string, string]),
      ['x', lx, hotelB, orgB],
    ];
    for (const [key, locationId, businessId, organizationId] of all) {
      await db.location.create({ data: { id: locationId, businessId, name: `MKT8 ${key}`, timezone: 'Asia/Almaty', currency: 'KZT' } });
      P[key] = randomUUID();
      await db.property.create({
        data: { id: P[key]!, organizationId, locationId, name: `MKT8 ${key}`, timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' },
      });
      await db.channelMapping.create({ data: { propertyId: P[key]!, provider: 'channex', providerPropertyId: `cx-${key}-${locationId.slice(0, 6)}` } });
    }
    // MKT9.2: запись сайта и картинок только при действующей лицензии филиала
    await grantSiteBuilder(db, [...Object.values(L), lx]);
    const module = await Test.createTestingModule({ imports: [MarketingSiteModule, SitesRuntimeModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(SITE_ASSET_STORAGE)
      .useValue(storage)
      .overrideProvider(BRIEF_CHANNEX_READER)
      .useValue(reader)
      .overrideProvider(ASSET_FETCH_DEPS)
      .useValue(fetchDeps)
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
  }, 120_000);

  beforeEach(() => {
    resetAssetRateLimit();
    storage.failPut = false;
    storage.failDelete = false;
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    const orgs = [org, orgB];
    if (sql) {
      await purgeSiteBuilderRows(sql, [org, orgB]);
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
      await sql.query('ALTER TABLE marketing_site_publications ENABLE TRIGGER marketing_site_publication_immutable');
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await purgeAuditRows(db, { organizationId: { in: orgs } });
      await db.siteAsset.deleteMany({ where: { location: { business: { organizationId: { in: orgs } } } } });
      await db.trackedSite.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.channelMapping.deleteMany({ where: { property: { organizationId: { in: orgs } } } });
      await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.location.deleteMany({ where: { business: { organizationId: { in: orgs } } } });
      await db.business.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.user.deleteMany({ where: { id: { in: [user, userB] } } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      expect(await db.organization.count({ where: { id: { in: orgs } } })).toBe(0);
      await db.$disconnect();
    }
  });

  it('§17, §20, §33–§35: загрузка снимает EXIF и GPS, хранит только готовую копию, SHA от неё; ключа объекта наружу нет', async () => {
    const raw = await photo(1);
    const res = await upload(raw);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const asset = res.body.asset;
    expect(Object.keys(asset).sort()).toEqual(
      ['byteSize', 'createdAt', 'defaultAlt', 'height', 'id', 'kind', 'mimeType', 'previewUrl', 'sha256', 'source', 'status', 'width'].sort(),
    );
    expect(asset).toMatchObject({ kind: 'IMAGE', mimeType: 'image/webp', width: 64, height: 48, source: 'UPLOAD', status: 'READY', defaultAlt: null });
    const row = await db.siteAsset.findUniqueOrThrow({ where: { id: asset.id } });
    expect(row.storageRef).toBe(`site-assets/${L.a}/${asset.id}/${asset.sha256}.webp`);
    expect(row.storageRef).not.toContain('IMG_0001');
    expect(JSON.stringify(res.body)).not.toContain('"storageRef"');
    // в хранилище ровно готовая копия: WebP без EXIF и GPS, хэш строки от неё, не от сырого файла
    const stored = storage.objects.get(row.storageRef)!;
    expect(stored.contentType).toBe('image/webp');
    expect(createHash('sha256').update(stored.body).digest('hex')).toBe(asset.sha256);
    expect(asset.sha256).not.toBe(createHash('sha256').update(raw).digest('hex'));
    expect((await sharp(stored.body).metadata()).exif).toBeUndefined();
    for (const marker of ['Exif', 'SN-OWNER-PHONE', 'TestCam']) expect(stored.body.includes(Buffer.from(marker))).toBe(false);
    // сырого файла в хранилище нет ни под каким ключом
    for (const o of storage.objects.values()) expect(o.body.equals(raw)).toBe(false);
    expect(storage.verify(asset.previewUrl)).toEqual({ key: row.storageRef });
    const [audit] = await auditOf(asset.id);
    expect(audit).toMatchObject({ action: 'marketing.site.asset.uploaded', entityType: 'site_asset', userId: user });
    expect(JSON.stringify(audit!.after)).not.toMatch(/site-assets\/|X-Signature|https?:/);
  });

  it('§25–§27, §86: повтор той же картинки возвращает тот же ассет; другой вид и другой филиал отдельно; гонка даёт одного', async () => {
    const raw = await photo(2);
    const first = await upload(raw);
    const objects = storage.objects.size;
    const puts = storage.puts;
    const again = await upload(raw);
    expect(again.status).toBe(200);
    // повтор находит готовый ассет до записи: в хранилище не пишет вовсе
    expect(storage.puts).toBe(puts);
    expect(again.body.asset.id).toBe(first.body.asset.id);
    expect(storage.objects.size).toBe(objects);
    const asLogo = await upload(raw, 'LOGO');
    expect(asLogo.status).toBe(201);
    expect(asLogo.body.asset.id).not.toBe(first.body.asset.id);
    const otherLocation = await upload(raw, 'IMAGE', { location: L.b });
    expect(otherLocation.status).toBe(201);
    expect(otherLocation.body.asset.id).not.toBe(first.body.asset.id);
    // две одновременные загрузки новой картинки: один живой ассет, лишний объект проигравшего убран
    const fresh = await photo(3);
    const before = storage.objects.size;
    const [x, y] = await Promise.all([upload(fresh), upload(fresh)]);
    expect([x.status, y.status].sort()).toEqual([200, 201]);
    expect(x.body.asset.id).toBe(y.body.asset.id);
    expect(await db.siteAsset.count({ where: { locationId: L.a, sha256: x.body.asset.sha256, kind: 'IMAGE' } })).toBe(1);
    expect(storage.objects.size).toBe(before + 1);
  });

  it('§12–§15, §88: чужие и вредные файлы, предел 10 МиБ, лишние поля, вид: отказ без записи в хранилище и базу', async () => {
    const objects = storage.objects.size;
    const rows = await db.siteAsset.count({ where: { locationId: L.a } });
    const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    expect(svg).toMatchObject({ status: 415, body: { code: 'UNSUPPORTED_MEDIA_TYPE' } });
    const html = await upload(Buffer.from('<!doctype html><script>alert(1)</script>'));
    expect(html.status).toBe(415);
    const truncated = await sharp({ create: { width: 300, height: 300, channels: 3, background: 'red' } }).jpeg().toBuffer();
    expect((await upload(truncated.subarray(0, 200))).body.code).toBe('IMAGE_DECODE_FAILED');
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff], 0);
    expect((await upload(big)).status).toBe(413);
    expect((await upload(await photo(4), null)).status).toBe(400);
    expect((await upload(await photo(4), 'SVG')).status).toBe(400);
    for (const extra of ['locationId', 'organizationId', 'businessId', 'siteId'])
      expect((await upload(await photo(4), 'IMAGE', { fields: { [extra]: L.b } })).status, extra).toBe(400);
    expect((await upload(await photo(4), 'IMAGE', { fields: { defaultAlt: '{"ru":"<b>x</b>"}' } })).status).toBe(400);
    expect(storage.objects.size).toBe(objects);
    expect(await db.siteAsset.count({ where: { locationId: L.a } })).toBe(rows);
  });

  it('§75: запись в хранилище не удалась: строки нет, 503; без права settings 403', async () => {
    const rows = await db.siteAsset.count({ where: { locationId: L.a } });
    storage.failPut = true;
    const res = await upload(await photo(5));
    expect(res).toMatchObject({ status: 503, body: { code: 'ASSET_STORAGE_FAILED' } });
    expect(await db.siteAsset.count({ where: { locationId: L.a } })).toBe(rows);
    storage.failPut = false;
    expect((await upload(await photo(5), 'IMAGE', { role: 'STAFF' })).status).toBe(403);
    expect((await call('GET', '/marketing/site/assets', { role: 'STAFF' })).status).toBe(403);
  });

  it('§31, §32, §36: список без удалённых и без ключа объекта; ALT правится; чужой ассет 404', async () => {
    const created = (await upload(await photo(6))).body.asset;
    const list = await call('GET', '/marketing/site/assets');
    expect(list.status).toBe(200);
    expect(list.body.storage).toBe('READY');
    expect(list.body.assets.map((a: { id: string }) => a.id)).toContain(created.id);
    expect(JSON.stringify(list.body)).not.toContain('storageRef');
    for (const a of list.body.assets) expect(storage.verify(a.previewUrl)).not.toBeNull();
    const alt = await call('PATCH', `/marketing/site/assets/${created.id}`, { body: { defaultAlt: { ru: 'Вид из окна', en: 'Window view' } } });
    expect(alt.status).toBe(200);
    expect(alt.body.asset.defaultAlt).toEqual({ ru: 'Вид из окна', en: 'Window view' });
    expect((await call('PATCH', `/marketing/site/assets/${created.id}`, { body: { defaultAlt: { de: 'x' } } })).status).toBe(400);
    expect((await call('PATCH', `/marketing/site/assets/${created.id}`, { body: { defaultAlt: null, kind: 'LOGO' } })).status).toBe(400);
    expect((await call('PATCH', `/marketing/site/assets/${created.id}`, { body: { defaultAlt: null } })).body.asset.defaultAlt).toBeNull();
    // другой филиал той же организации и другая организация не видят и не трогают
    expect((await call('PATCH', `/marketing/site/assets/${created.id}`, { location: L.b, body: { defaultAlt: null } })).status).toBe(404);
    expect((await call('DELETE', `/marketing/site/assets/${created.id}`, { user: 'B' })).status).toBe(404);
    expect((await call('GET', '/marketing/site/assets', { user: 'B' })).body.assets).toEqual([]);
    expect((await auditOf(created.id)).map((a) => a.action)).toEqual([
      'marketing.site.asset.uploaded',
      'marketing.site.asset.alt_changed',
      'marketing.site.asset.alt_changed',
    ]);
  });

  it('§39, §85: ассет только из черновиков после удаления уходит и из хранилища', async () => {
    const created = (await upload(await photo(7))).body.asset;
    const ref = (await db.siteAsset.findUniqueOrThrow({ where: { id: created.id } })).storageRef;
    const res = await call('DELETE', `/marketing/site/assets/${created.id}`);
    expect(res.body).toEqual({ deleted: true, retainedForPublishedHistory: false });
    expect(await db.siteAsset.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject({ status: 'DELETED' });
    expect(storage.objects.has(ref)).toBe(false);
    expect((await call('GET', '/marketing/site/assets')).body.assets.map((a: { id: string }) => a.id)).not.toContain(created.id);
    expect((await call('DELETE', `/marketing/site/assets/${created.id}`)).status).toBe(404);
    const audit = (await auditOf(created.id)).at(-1)!;
    expect(audit.action).toBe('marketing.site.asset.deleted');
    expect(audit.after).toMatchObject({ retainedForPublishedHistory: false });
  });

  it('§38–§43, §84: картинка опубликованной версии удалена: библиотека её прячет, сайт и откат продолжают видеть', async () => {
    await createSite('hist');
    const hero = (await upload(await photo(8), 'IMAGE', { location: L.hist })).body.asset;
    const logo = (await upload(await sharp({ create: { width: 400, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer(), 'LOGO', { location: L.hist })).body.asset;
    // §45: логотип не той роли не сохраняется
    const wrong = await save('hist', specWith('Неверно', { hero: logo.id }));
    expect(wrong).toMatchObject({ status: 409, body: { code: 'ASSET_UNAVAILABLE', paths: [{ path: 'pages[0].sections[0].image.assetId', code: 'wrong_kind' }] } });
    expect((await save('hist', specWith('С картинкой', { hero: hero.id, og: hero.id, logo: logo.id }))).status).toBe(201);
    const v1 = (await siteRow('hist'))!.latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.hist, body: { expectedVersionId: v1 } })).status).toBe(200);
    const host = (await siteRow('hist'))!.domains[0]!.host;
    const live = await current(host);
    expect(Object.keys(live.body!.assets).sort()).toEqual([hero.id, logo.id].sort());
    const heroRef = (await db.siteAsset.findUniqueOrThrow({ where: { id: hero.id } })).storageRef;
    expect(storage.verify(live.body!.assets[hero.id]!)).toEqual({ key: heroRef });

    const del = await call('DELETE', `/marketing/site/assets/${hero.id}`, { location: L.hist });
    expect(del.body).toEqual({ deleted: true, retainedForPublishedHistory: true });
    expect(storage.objects.has(heroRef)).toBe(true);
    expect((await call('GET', '/marketing/site/assets', { location: L.hist })).body.assets.map((a: { id: string }) => a.id)).toEqual([logo.id]);
    // текущий сайт по-прежнему получает адрес удалённой, но удержанной картинки
    expect(Object.keys((await current(host)).body!.assets)).toContain(hero.id);
    // §41: в новую версию удалённую картинку не вставить
    expect((await save('hist', specWith('Снова', { hero: hero.id }))).body.code).toBe('ASSET_UNAVAILABLE');
    expect((await save('hist', specWith('Без картинки'))).status).toBe(201);
    const v2 = (await siteRow('hist'))!.latestVersionId!;
    expect((await call('POST', '/marketing/site/publish', { location: L.hist, body: { expectedVersionId: v2 } })).status).toBe(200);
    expect((await current(host)).body!.assets).toEqual({});
    // §42: откат на версию с удержанной удалённой картинкой работает
    const back = await call('POST', '/marketing/site/rollback', { location: L.hist, body: { versionId: v1 } });
    expect(back.status, JSON.stringify(back.body)).toBe(200);
    expect(Object.keys((await current(host)).body!.assets)).toContain(hero.id);
    // §43: возобновление версии с удержанной картинкой
    expect((await call('POST', '/marketing/site/pause', { location: L.hist })).status).toBe(200);
    expect((await call('POST', '/marketing/site/resume', { location: L.hist })).status).toBe(200);
    // превью исторической версии показывает удержанную картинку
    const pv = await call('POST', '/marketing/site/preview', { location: L.hist, body: { versionId: v1 } });
    expect(pv.status).toBe(200);
    const preview = await runtime.preview({ token: new URL(pv.body.url).searchParams.get('token') });
    expect(Object.keys(preview.assets)).toContain(hero.id);
    // объект пропал из хранилища: откат на эту версию отказывает, состояние не меняется
    expect((await call('POST', '/marketing/site/rollback', { location: L.hist, body: { versionId: v2 } })).status).toBe(200);
    storage.objects.delete(heroRef);
    const missing = await call('POST', '/marketing/site/rollback', { location: L.hist, body: { versionId: v1 } });
    expect(missing).toMatchObject({ status: 409, body: { code: 'ASSET_UNAVAILABLE' } });
    expect(missing.body.paths).toContainEqual({ path: 'pages[0].sections[0].image.assetId', code: 'missing_object' });
    expect((await siteRow('hist'))!.publishedVersionId).toBe(v2);
  });

  it('§28, §29, гонка удаления и публикации: удержано, если версия успела опубликоваться; иначе публикация отказывает', async () => {
    await createSite('race');
    const img = (await upload(await photo(9), 'IMAGE', { location: L.race })).body.asset;
    expect((await save('race', specWith('Гонка', { hero: img.id }))).status).toBe(201);
    const v1 = (await siteRow('race'))!.latestVersionId!;
    const [pub, del] = await Promise.all([
      call('POST', '/marketing/site/publish', { location: L.race, body: { expectedVersionId: v1 } }),
      call('DELETE', `/marketing/site/assets/${img.id}`, { location: L.race }),
    ]);
    expect(del.status).toBe(200);
    const ref = (await db.siteAsset.findUniqueOrThrow({ where: { id: img.id } })).storageRef;
    if (pub.status === 200) {
      // публикация первой: удаление увидело её запись в журнале и объект оставило
      expect(del.body.retainedForPublishedHistory).toBe(true);
      expect(storage.objects.has(ref)).toBe(true);
    } else {
      expect(pub.body.code).toBe('ASSET_UNAVAILABLE');
      expect(del.body.retainedForPublishedHistory).toBe(false);
      expect((await siteRow('race'))!.publishedVersionId).toBeNull();
    }
  });

  it('§57–§64, §89–§91: фото Channex точного объекта; адрес не из браузера; SSRF, мусор и повтор', async () => {
    const good = await photo(10);
    const keyA = `cx-a-${L.a.slice(0, 6)}`;
    const keyB = `cx-b-${L.b.slice(0, 6)}`;
    photos[keyA] = [
      { url: 'https://img.channex.io/a-front.jpg', description: 'Фасад' },
      { url: 'https://img.channex.io/a-redirect.jpg' },
      { url: 'https://img.channex.io/a-junk.jpg', room: true },
      { url: 'https://internal.example.com/a.jpg' },
    ];
    photos[keyB] = [{ url: 'https://img.channex.io/b-only.jpg', description: 'Филиал Б' }];
    served['https://img.channex.io/a-front.jpg'] = { status: 200, body: good };
    served['https://img.channex.io/a-redirect.jpg'] = { status: 302, location: 'https://internal.example.com/meta' };
    served['https://img.channex.io/a-junk.jpg'] = { status: 200, body: Buffer.from('<svg/>') };
    served['https://img.channex.io/b-only.jpg'] = { status: 200, body: good };

    const list = await call('GET', '/marketing/site/assets/channex');
    expect(list.status).toBe(200);
    expect(list.body.state).toBe('READY');
    expect(list.body.photos.map((p: { photoId: string }) => p.photoId)).toEqual(photos[keyA]!.map((p) => channexPhotoId(p.url)));
    expect(list.body.photos[0]).toEqual({ photoId: channexPhotoId('https://img.channex.io/a-front.jpg'), description: 'Фасад', forRoomType: false, position: 0 });
    const text = JSON.stringify(list.body);
    expect(text).not.toContain('img.channex.io');
    expect(text).not.toContain(keyA);

    const ids = photos[keyA]!.map((p) => channexPhotoId(p.url));
    const bOnly = channexPhotoId('https://img.channex.io/b-only.jpg');
    const res = await call('POST', '/marketing/site/assets/channex/import', { body: { photoIds: [...ids, bOnly, 'f'.repeat(64)] } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.imported).toHaveLength(1);
    expect(res.body.imported[0]).toMatchObject({ photoId: ids[0], created: true, asset: { source: 'CHANNEX_IMPORT', kind: 'IMAGE', defaultAlt: { ru: 'Фасад' } } });
    expect(res.body.failed).toEqual([
      { photoId: ids[1], code: 'HOST_NOT_PUBLIC' },
      { photoId: ids[2], code: 'UNSUPPORTED_MEDIA_TYPE' },
      { photoId: ids[3], code: 'HOST_NOT_PUBLIC' },
      { photoId: bOnly, code: 'UNKNOWN_PHOTO' },
      { photoId: 'f'.repeat(64), code: 'UNKNOWN_PHOTO' },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/channex\.io|internal\.example/);
    const imported = await db.siteAsset.findUniqueOrThrow({ where: { id: res.body.imported[0].asset.id } });
    expect(imported).toMatchObject({ locationId: L.a, source: 'CHANNEX_IMPORT' });
    expect(storage.objects.get(imported.storageRef)!.body.includes(Buffer.from('SN-OWNER-PHONE'))).toBe(false);
    const audit = (await auditOf(imported.id))[0]!;
    expect(audit.action).toBe('marketing.site.asset.imported');
    expect(JSON.stringify(audit.after)).not.toContain('channex.io');
    // повтор импорта: тот же ассет
    const again = await call('POST', '/marketing/site/assets/channex/import', { body: { photoIds: [ids[0]] } });
    expect(again.body.imported[0]).toMatchObject({ created: false, asset: { id: imported.id } });
    // адрес вместо кода, лишние поля, больше 20 кодов
    for (const body of [
      { photoIds: ['https://img.channex.io/a-front.jpg'] },
      { photoIds: [ids[0]], url: 'https://img.channex.io/x.jpg' },
      { photoIds: Array.from({ length: 21 }, (_, i) => createHash('sha256').update(String(i)).digest('hex')) },
      { photoIds: [] },
    ])
      expect((await call('POST', '/marketing/site/assets/channex/import', { body })).status).toBe(400);
    // филиал Б видит только свои фото
    const listB = await call('GET', '/marketing/site/assets/channex', { location: L.b });
    expect(listB.body.photos.map((p: { photoId: string }) => p.photoId)).toEqual([bOnly]);
  });

  it('§104: больше 30 загрузок и импортов в час: 429', async () => {
    const raw = await photo(11);
    for (let i = 0; i < 30; i++) expect((await upload(raw, 'IMAGE', { location: L.rate })).status).toBeLessThan(300);
    expect((await upload(raw, 'IMAGE', { location: L.rate })).status).toBe(429);
    expect((await call('POST', '/marketing/site/assets/channex/import', { location: L.rate, body: { photoIds: ['a'.repeat(64)] } })).status).toBe(429);
  });
});

describe.skipIf(!url)('MKT8 хранилище не настроено', () => {
  let db: Db, app: INestApplication, base: string;
  const org = randomUUID(),
    user = randomUUID(),
    hotel = randomUUID(),
    loc = randomUUID();

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: 'MKT8 off (synthetic)', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `mkt8-off-${user}@example.invalid`, passwordHash: 'x' } });
    await db.business.create({ data: { id: hotel, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' } });
    await db.location.create({ data: { id: loc, businessId: hotel, name: 'Off', timezone: 'Asia/Almaty', currency: 'KZT' } });
    await grantSiteBuilder(db, loc);
    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(SITE_ASSET_STORAGE)
      .useValue(null)
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object }, _res: unknown, next: () => void) => {
      req.user = { id: user, organizationId: org, role: 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    if (db) {
      await purgeAuditRows(db, { organizationId: org });
      await db.siteBuilderEntitlement.deleteMany({ where: { locationId: loc } });
      await db.location.deleteMany({ where: { id: loc } });
      await db.business.deleteMany({ where: { id: hotel } });
      await db.user.deleteMany({ where: { id: user } });
      await db.organization.deleteMany({ where: { id: org } });
      await db.$disconnect();
    }
  });

  it('§6: метаданные читаются, загрузка и импорт 503 без запасного хранилища', async () => {
    const headers = { 'x-wetop-scope': `business=${hotel};location=${loc}` };
    const list = await fetch(`${base}/marketing/site/assets`, { headers });
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ storage: 'OFF', assets: [] });
    const form = new FormData();
    form.append('kind', 'IMAGE');
    form.append('file', new Blob([new Uint8Array(await photo(12))]), 'x.jpg');
    const up = await fetch(`${base}/marketing/site/assets`, { method: 'POST', headers, body: form });
    expect(up.status).toBe(503);
    expect((await up.json()).code).toBe('ASSET_STORAGE_UNAVAILABLE');
    const imp = await fetch(`${base}/marketing/site/assets/channex/import`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ photoIds: ['a'.repeat(64)] }),
    });
    expect(imp.status).toBe(503);
    expect(await db.siteAsset.count({ where: { locationId: loc } })).toBe(0);
  });
});
