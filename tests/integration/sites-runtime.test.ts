import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { siteSpecHash } from '@pms/domain';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { SitesRuntimeModule } from '../../apps/api/src/sites-runtime/sites-runtime.module';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT4 на настоящей базе: рантайм получает только версию по `published_version_id` сайта в `PUBLISHED`, с действующей
 * цепочкой филиал → Business HOSPITALITY → объект. Черновик `latest`, пауза, архив, черновой сайт, архивный филиал и
 * архивный Business не отдаются. Опубликованный указатель засевается прямо в изолированной базе: публикации в MKT4
 * нет. Гостиницы вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
const KEY = `runtime-${randomUUID()}`;
type SpecDoc = Record<string, unknown> & {
  site: { displayName: Record<string, string> };
  theme: Record<string, unknown>;
};
const BASE = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as SpecDoc;
const named = (name: string): SpecDoc => {
  const spec = structuredClone(BASE);
  spec.site.displayName = { ru: name };
  return spec;
};

describe.skipIf(!url)('MKT4 sites runtime: only the published pointer', () => {
  let db: Db, app: INestApplication, base: string, sql: pg.Client;
  const org = randomUUID(),
    hotel = randomUUID(),
    oldHotel = randomUUID(),
    loc = {
      live: randomUUID(),
      draft: randomUUID(),
      paused: randomUUID(),
      archivedSite: randomUUID(),
      archivedLocation: randomUUID(),
      inOldHotel: randomUUID(),
      broken: randomUUID(),
    };
  const site: Record<keyof typeof loc, string> = {
    live: randomUUID(),
    draft: randomUUID(),
    paused: randomUUID(),
    archivedSite: randomUUID(),
    archivedLocation: randomUUID(),
    inOldHotel: randomUUID(),
    broken: randomUUID(),
  };
  const live = { v1: randomUUID(), v2: randomUUID() };
  const PUBLISHED = named('Опубликованная версия');
  const DRAFT = named('Черновик, который нельзя показать');
  let publicKey = '';

  async function current(host: string, extra = '') {
    const res = await fetch(`${base}/sites-runtime/current?host=${encodeURIComponent(host)}${extra}`, {
      headers: { 'x-wetop-service-key': KEY },
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }

  async function addVersion(siteId: string, id: string, revision: number, parent: string | null, spec: SpecDoc) {
    await sql.query(
      `INSERT INTO marketing_site_versions (id, site_id, revision, parent_version_id, schema_version, spec, spec_hash, source)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, 'MANUAL')`,
      [id, siteId, revision, parent, spec['schemaVersion'], JSON.stringify(spec), siteSpecHash(spec)],
    );
  }

  /** Сайт с одной версией; state задаётся напрямую, как сделает публикация MKT7 */
  async function seedSite(key: keyof typeof loc, state: string, spec: SpecDoc = PUBLISHED) {
    await sql.query(
      `INSERT INTO marketing_sites (id, location_id, name, slug, updated_at) VALUES ($1, $2, $3, $4, now())`,
      [site[key], loc[key], `MKT4 ${key}`, `mkt4-${key.toLowerCase()}-${site[key].slice(0, 6)}`],
    );
    const v = randomUUID();
    await addVersion(site[key], v, 1, null, spec);
    await sql.query(
      `UPDATE marketing_sites SET latest_version_id = $2,
         published_version_id = CASE WHEN $3::text = 'DRAFT' THEN NULL ELSE $2::uuid END,
         state = $3::"MarketingSiteState",
         archived_at = CASE WHEN $3::text = 'ARCHIVED' THEN now() END
       WHERE id = $1`,
      [site[key], v, state],
    );
  }

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    vi.stubEnv('SITES_RUNTIME_KEY', KEY);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SITES_RUNTIME_DEV_RESOLVER', '1');
    vi.stubEnv('PUBLIC_API_URL', 'https://api.example.test');
    vi.stubEnv(
      'SITES_RUNTIME_DEV_HOSTS',
      Object.entries(site)
        .map(([key, id]) => `${key.toLowerCase()}.mkt4.localhost=${id}`)
        .join(','),
    );
    db = createPrismaClient(url);
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await db.organization.create({ data: { id: org, name: 'MKT4 runtime (synthetic)', status: 'ACTIVE' } });
    await db.business.createMany({
      data: [
        { id: hotel, organizationId: org, name: 'Hotel', vertical: 'HOSPITALITY' },
        { id: oldHotel, organizationId: org, name: 'Old hotel', vertical: 'HOSPITALITY', status: 'ARCHIVED' },
      ],
    });
    const location = (id: string, businessId: string, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') => ({
      id, businessId, name: `Loc ${id.slice(0, 4)}`, timezone: 'Asia/Almaty', currency: 'KZT', status,
    });
    await db.location.createMany({
      data: [
        location(loc.live, hotel),
        location(loc.draft, hotel),
        location(loc.paused, hotel),
        location(loc.archivedSite, hotel),
        location(loc.archivedLocation, hotel, 'ARCHIVED'),
        location(loc.inOldHotel, oldHotel),
        location(loc.broken, hotel),
      ],
    });
    // объект у каждого филиала: иначе отказ был бы из-за объекта, а не из-за правила, которое проверяется
    const properties: Record<string, string> = {};
    for (const [key, locationId] of Object.entries(loc)) {
      properties[key] = randomUUID();
      await db.property.create({
        data: {
          id: properties[key]!, organizationId: org, locationId, name: `MKT4 ${key}`, timezone: 'Asia/Almaty',
          currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00',
        },
      });
    }
    await db.accommodationType.createMany({
      data: [
        { propertyId: properties['live']!, code: 'standard-double', name: 'Служебное имя: двухместный', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
        { propertyId: properties['live']!, code: 'dorm-bed', name: 'Служебное имя: койка', kind: 'DORM_BED', capacityAdults: 1, active: false },
      ],
    });
    publicKey = `pms_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const tracked = await db.trackedSite.create({
      data: { propertyId: properties['live']!, name: 'MKT4 live', hosts: [], publicKey, bookingEnabled: false },
    });

    // live: опубликована v1, а более новый черновик v2 лежит в latest_version_id и не должен утечь
    await sql.query(`INSERT INTO marketing_sites (id, location_id, name, slug, tracked_site_id, updated_at) VALUES ($1, $2, 'MKT4 live', $3, $4, now())`, [
      site.live, loc.live, `mkt4-live-${site.live.slice(0, 6)}`, tracked.id,
    ]);
    await addVersion(site.live, live.v1, 1, null, PUBLISHED);
    await addVersion(site.live, live.v2, 2, live.v1, DRAFT);
    await sql.query(
      `UPDATE marketing_sites SET latest_version_id = $2, published_version_id = $3, state = 'PUBLISHED' WHERE id = $1`,
      [site.live, live.v2, live.v1],
    );
    await seedSite('draft', 'DRAFT');
    await seedSite('paused', 'PAUSED');
    await seedSite('archivedSite', 'ARCHIVED');
    await seedSite('archivedLocation', 'PUBLISHED');
    await seedSite('inOldHotel', 'PUBLISHED');
    // документ проходит CHECK базы, но не валидатор: тема вне словаря
    const broken = named('Сломанный документ');
    broken.theme = { ...broken.theme, preset: 'NEON' };
    await seedSite('broken', 'PUBLISHED', broken);

    const module = await Test.createTestingModule({ imports: [SitesRuntimeModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app?.close();
    if (sql) {
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      const ids = Object.values(site);
      await sql.query(
        `UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL, state = 'DRAFT', archived_at = NULL WHERE id = ANY($1::uuid[])`,
        [ids],
      );
      await sql.query(`UPDATE marketing_site_versions SET parent_version_id = NULL WHERE site_id = ANY($1::uuid[])`, [ids]);
      await sql.query(`DELETE FROM marketing_site_versions WHERE site_id = ANY($1::uuid[])`, [ids]);
      await sql.query(`DELETE FROM marketing_sites WHERE id = ANY($1::uuid[])`, [ids]);
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await db.trackedSite.deleteMany({ where: { property: { organizationId: org } } });
      await db.accommodationType.deleteMany({ where: { property: { organizationId: org } } });
      await db.property.deleteMany({ where: { organizationId: org } });
      await db.location.deleteMany({ where: { business: { organizationId: org } } });
      await db.business.deleteMany({ where: { organizationId: org } });
      await db.organization.deleteMany({ where: { id: org } });
      expect(await db.organization.count({ where: { id: org } })).toBe(0);
      await db.$disconnect();
    }
  });

  it('опубликованная версия, а не более новый черновик latest_version_id', async () => {
    const r = await current('live.mkt4.localhost');
    expect(r.status).toBe(200);
    expect(r.body.versionId).toBe(live.v1);
    expect(r.body.specHash).toBe(siteSpecHash(PUBLISHED));
    expect(r.body.spec.site.displayName).toEqual({ ru: 'Опубликованная версия' });
    expect(r.text).not.toContain('Черновик, который нельзя показать');
    expect(r.text).not.toContain(live.v2);
  });

  it('ответ: ключ связанного сайта счётчика, бронь выключена, основного хоста нет до MKT7', async () => {
    const r = await current('live.mkt4.localhost');
    expect(r.body).toMatchObject({
      siteId: site.live,
      state: 'PUBLISHED',
      primaryHost: null,
      defaultLocale: 'ru',
      schemaVersion: 'site-spec/0',
      publicKey,
      bookingEnabled: false,
      publicApiUrl: 'https://api.example.test',
      assets: {},
    });
  });

  it('knownSpecHash совпал: документ не отдаётся', async () => {
    const r = await current('live.mkt4.localhost', `&knownSpecHash=${siteSpecHash(PUBLISHED)}`);
    expect(r.status).toBe(200);
    expect(r.body.spec).toBeUndefined();
    expect(r.body.versionId).toBe(live.v1);
  });

  it('knownSpecHash черновика ничего не открывает: в ответе всё равно опубликованная версия', async () => {
    const r = await current('live.mkt4.localhost', `&knownSpecHash=${siteSpecHash(DRAFT)}`);
    expect(r.body.versionId).toBe(live.v1);
    expect(r.body.spec.site.displayName).toEqual({ ru: 'Опубликованная версия' });
  });

  it('publicFacts только из объекта филиала сайта и только белый список', async () => {
    const r = await current('live.mkt4.localhost');
    expect(r.body.publicFacts.checkInTime).toBe('14:00');
    expect(r.body.publicFacts.checkOutTime).toBe('12:00');
    expect(r.body.publicFacts.categories).toEqual([
      { code: 'standard-double', active: true, capacityAdults: 2 },
      { code: 'dorm-bed', active: false, capacityAdults: 1 },
    ]);
    expect(r.text).not.toContain('Служебное имя');
    expect(r.text).not.toContain(org);
    expect(r.text).not.toContain(loc.live);
  });

  it.each([
    ['черновой сайт', 'draft'],
    ['пауза', 'paused'],
    ['архивный сайт', 'archivedsite'],
    ['архивный филиал', 'archivedlocation'],
    ['архивный Business', 'inoldhotel'],
    ['неизвестный хост', 'nobody'],
  ])('%s: 404 без имени сайта и без документа', async (_label, key) => {
    const r = await current(`${key}.mkt4.localhost`);
    expect(r.status).toBe(404);
    expect(r.body.spec).toBeUndefined();
    expect(r.text).not.toContain('Опубликованная версия');
  });

  it('документ не проходит валидатор: 503, документа в ответе нет', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await current('broken.mkt4.localhost');
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('spec_invalid');
    expect(r.text).not.toContain('Сломанный документ');
    expect(JSON.stringify(errors.mock.calls)).toContain(site.broken);
    errors.mockRestore();
  });

  it('без ключа рантайма: 401', async () => {
    const res = await fetch(`${base}/sites-runtime/current?host=live.mkt4.localhost`);
    expect(res.status).toBe(401);
  });
});
