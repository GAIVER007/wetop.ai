import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { siteSpecHash } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * MKT3 на настоящей базе: управление сайтом только в строгом scope филиала Hospitality, версии неизменяемы и идут
 * по ревизиям, одновременные сохранения не теряют правок, чужая организация и чужой филиал не видят сайта.
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';
/** Пример документа: тесты меняют в нём только тему и имя сайта */
type SpecDoc = Record<string, unknown> & {
  theme: Record<string, unknown>;
  site: { displayName: Record<string, string> };
};
const SPEC = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as SpecDoc;

describe.skipIf(!url)('MKT3 marketing site core', () => {
  let db: Db, app: INestApplication, base: string, sql: pg.Client;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    userA = randomUUID(),
    userB = randomUUID(),
    hotel = randomUUID(),
    beauty = randomUUID(),
    archivedBusiness = randomUUID(),
    otherHotel = randomUUID(),
    a1 = randomUUID(),
    a2 = randomUUID(),
    archivedLocation = randomUUID(),
    salon = randomUUID(),
    inArchivedBusiness = randomUUID(),
    b1 = randomUUID();
  const pointer = (business: string, location?: string) =>
    location ? `business=${business};location=${location}` : `business=${business}`;
  const A1 = pointer(hotel, a1);
  const A2 = pointer(hotel, a2);

  async function call(
    method: string,
    path: string,
    opts: { scope?: string | null; body?: unknown; user?: 'A' | 'B'; role?: string } = {},
  ) {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-test-user': opts.user ?? 'A',
      'x-test-role': opts.role ?? 'OWNER',
    };
    const scope = opts.scope === undefined ? A1 : opts.scope;
    if (scope) headers['x-wetop-scope'] = scope;
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  /** Запрос ролью приложения в организации, как идут запросы API под RLS */
  async function asApp<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    await sql.query('BEGIN');
    try {
      await sql.query('SET LOCAL ROLE wetop_app');
      await sql.query(`SELECT set_config('app.org_id', $1, true)`, [organizationId]);
      return await fn();
    } finally {
      await sql.query('ROLLBACK');
    }
  }

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await db.organization.createMany({
      data: [
        { id: orgA, name: 'MKT3 own (synthetic)', status: 'ACTIVE' },
        { id: orgB, name: 'MKT3 other (synthetic)', status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: userA, email: `mkt3-a-${userA}@example.invalid`, passwordHash: 'x' },
        { id: userB, email: `mkt3-b-${userB}@example.invalid`, passwordHash: 'x' },
      ],
    });
    await db.business.createMany({
      data: [
        { id: hotel, organizationId: orgA, name: 'Hotel', vertical: 'HOSPITALITY' },
        { id: beauty, organizationId: orgA, name: 'Salon', vertical: 'BEAUTY' },
        { id: archivedBusiness, organizationId: orgA, name: 'Old hotel', vertical: 'HOSPITALITY', status: 'ARCHIVED' },
        { id: otherHotel, organizationId: orgB, name: 'Other hotel', vertical: 'HOSPITALITY' },
      ],
    });
    const location = (id: string, businessId: string, status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') => ({
      id,
      businessId,
      name: `Loc ${id.slice(0, 4)}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      status,
    });
    await db.location.createMany({
      data: [
        location(a1, hotel),
        location(a2, hotel),
        location(archivedLocation, hotel, 'ARCHIVED'),
        location(salon, beauty),
        location(inArchivedBusiness, archivedBusiness),
        location(b1, otherHotel),
      ],
    });
    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .compile();
    app = module.createNestApplication();
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      const b = req.headers['x-test-user'] === 'B';
      req.user = {
        id: b ? userB : userA,
        organizationId: b ? orgB : orgA,
        role: req.headers['x-test-role'] ?? 'OWNER',
      };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
    if (sql) {
      // Версии неизменяемы: уборка снимает сторожа правами владельца таблицы, как журнал в rls-isolation.test.ts.
      // У wetop_app такого пути нет: ни права ALTER TABLE, ни UPDATE и DELETE на версии.
      await sql.query('BEGIN');
      await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
      const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
        JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
      await sql.query(`UPDATE marketing_sites SET latest_version_id = NULL, published_version_id = NULL WHERE id IN (${sites})`, [[orgA, orgB]]);
      await sql.query(`UPDATE marketing_site_versions SET parent_version_id = NULL WHERE site_id IN (${sites})`, [[orgA, orgB]]);
      await sql.query(`DELETE FROM marketing_site_versions WHERE site_id IN (${sites})`, [[orgA, orgB]]);
      await sql.query(`DELETE FROM marketing_sites WHERE id IN (${sites})`, [[orgA, orgB]]);
      await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
      await sql.query('COMMIT');
      await sql.end();
    }
    if (db) {
      await purgeAuditRows(db, { organizationId: { in: [orgA, orgB] } });
      await db.location.deleteMany({ where: { business: { organizationId: { in: [orgA, orgB] } } } });
      await db.business.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
      await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
      await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
      const left = await db.organization.count({ where: { id: { in: [orgA, orgB] } } });
      expect(left).toBe(0);
    }
  });

  describe('scope: 409 без выбора филиала, 403 на отклонённом выборе и не гостинице', () => {
    it.each([
      ['указателя нет', null],
      ['выбран только бизнес', pointer(hotel)],
    ])('%s: 409 «Выберите филиал»', async (_label, scope) => {
      for (const [method, path, body] of [
        ['GET', '/marketing/site', undefined],
        ['POST', '/marketing/site', { name: 'Сайт', slug: 'scope-409' }],
        ['GET', '/marketing/site/draft', undefined],
        ['POST', '/marketing/site/versions', { baseRevision: 0, spec: SPEC }],
      ] as const) {
        const r = await call(method, path, { scope, body });
        expect(r.status, `${method} ${path}`).toBe(409);
        expect(r.body.message).toBe('Выберите филиал');
      }
    });

    it.each([
      ['чужой филиал', pointer(otherHotel, b1)],
      ['архивный филиал', pointer(hotel, archivedLocation)],
      ['архивный бизнес', pointer(archivedBusiness, inArchivedBusiness)],
      ['филиал из другого бизнеса', pointer(hotel, salon)],
      ['несуществующий филиал', pointer(hotel, randomUUID())],
    ])('%s: 403, без отката в организацию', async (_label, scope) => {
      const r = await call('GET', '/marketing/site', { scope });
      expect(r.status).toBe(403);
      const created = await call('POST', '/marketing/site', { scope, body: { name: 'Сайт', slug: 'scope-403' } });
      expect(created.status).toBe(403);
    });

    it('салон и ресторан: 403', async () => {
      const r = await call('GET', '/marketing/site', { scope: pointer(beauty, salon) });
      expect(r.status).toBe(403);
      // отказ по направлению до базы, а не только перепроверкой бизнеса в транзакции
      expect(r.body.message).toBe('Сайт и SEO пока доступны только гостиницам');
    });

    it('без права settings (администратор): 403', async () => {
      const r = await call('GET', '/marketing/site', { role: 'STAFF' });
      expect(r.status).toBe(403);
    });
  });

  describe('создание сайта', () => {
    it('сайта нет: пустой ответ, черновика нет', async () => {
      expect(await call('GET', '/marketing/site')).toEqual({ status: 200, body: { site: null } });
      expect((await call('GET', '/marketing/site/draft')).status).toBe(404);
      const save = await call('POST', '/marketing/site/versions', { body: { baseRevision: 0, spec: SPEC } });
      expect(save.status).toBe(404);
    });

    it('тело принимает только имя и адрес: филиал, бизнес и организация из тела дают 400', async () => {
      for (const extra of [{ locationId: a2 }, { businessId: hotel }, { organizationId: orgB }, { state: 'PUBLISHED' }]) {
        const r = await call('POST', '/marketing/site', { body: { name: 'Сайт', slug: 'spoof-site', ...extra } });
        expect(r.status, JSON.stringify(extra)).toBe(400);
      }
      expect(await db.marketingSite.count({ where: { slug: 'spoof-site' } })).toBe(0);
    });

    it('неверный и зарезервированный адрес: 400', async () => {
      expect((await call('POST', '/marketing/site', { body: { name: 'Сайт', slug: 'A b' } })).status).toBe(400);
      expect((await call('POST', '/marketing/site', { body: { name: 'Сайт', slug: 'admin' } })).status).toBe(400);
      expect((await call('POST', '/marketing/site', { body: { name: '  ', slug: 'stepnoy-veter' } })).status).toBe(400);
    });

    it('создаёт сайт филиала из scope в состоянии DRAFT; второй сайт филиала 409', async () => {
      const r = await call('POST', '/marketing/site', { body: { name: 'Степной ветер', slug: 'Stepnoy-Veter' } });
      expect(r.status).toBe(201);
      expect(r.body.site).toMatchObject({ name: 'Степной ветер', slug: 'stepnoy-veter', state: 'DRAFT', latest: null });
      const row = await db.marketingSite.findUniqueOrThrow({ where: { id: r.body.site.id } });
      expect(row.locationId).toBe(a1);
      expect(row.createdById).toBe(userA);
      const again = await call('POST', '/marketing/site', { body: { name: 'Ещё', slug: 'another-one' } });
      expect(again.status).toBe(409);
      const audit = await db.auditLog.findFirstOrThrow({ where: { organizationId: orgA, action: 'marketing.site.created' } });
      expect(audit.entityId).toBe(row.id);
    });

    it('адрес занят сайтом другого филиала: 409, без молчаливой замены', async () => {
      const r = await call('POST', '/marketing/site', { scope: A2, body: { name: 'Второй', slug: 'stepnoy-veter' } });
      expect(r.status).toBe(409);
      expect(r.body.message).toMatch(/адрес/i);
      const ok = await call('POST', '/marketing/site', { scope: A2, body: { name: 'Второй', slug: 'second-site' } });
      expect(ok.status).toBe(201);
    });

    it('чужой филиал той же организации видит только свой сайт', async () => {
      const own = await call('GET', '/marketing/site');
      const other = await call('GET', '/marketing/site', { scope: A2 });
      expect(own.body.site.slug).toBe('stepnoy-veter');
      expect(other.body.site.slug).toBe('second-site');
    });
  });

  describe('версии', () => {
    it('первая версия: baseRevision 0 → ревизия 1, хэш канонической записи, источник MANUAL', async () => {
      const r = await call('POST', '/marketing/site/versions', { body: { baseRevision: 0, spec: SPEC } });
      expect(r.status).toBe(201);
      expect(r.body.version).toMatchObject({
        revision: 1,
        schemaVersion: 'site-spec/0',
        source: 'MANUAL',
        specHash: siteSpecHash(SPEC),
      });
      const site = await call('GET', '/marketing/site');
      expect(site.body.site.latest).toMatchObject({ revision: 1, specHash: siteSpecHash(SPEC) });
      const audit = await db.auditLog.findFirstOrThrow({
        where: { organizationId: orgA, action: 'marketing.site.version_saved' },
      });
      expect(audit.after).toMatchObject({ revision: 1, specHash: siteSpecHash(SPEC), schemaVersion: 'site-spec/0' });
      expect(JSON.stringify(audit.after)).not.toContain('Степной ветер');
    });

    it('устаревшая ревизия: 409, новой версии нет', async () => {
      const r = await call('POST', '/marketing/site/versions', { body: { baseRevision: 0, spec: SPEC } });
      expect(r.status).toBe(409);
      expect(await db.marketingSiteVersion.count({ where: { site: { locationId: a1 } } })).toBe(1);
    });

    it('неверный документ: 400 со списком ошибок, версия не пишется', async () => {
      const bad = structuredClone(SPEC);
      bad.theme.css = 'body{}';
      const r = await call('POST', '/marketing/site/versions', { body: { baseRevision: 1, spec: bad } });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ path: 'theme.css' })]));
      const extra = await call('POST', '/marketing/site/versions', { body: { baseRevision: 1, spec: SPEC, locationId: a2 } });
      expect(extra.status).toBe(400);
      const negative = await call('POST', '/marketing/site/versions', { body: { baseRevision: -1, spec: SPEC } });
      expect(negative.status).toBe(400);
      expect(await db.marketingSiteVersion.count({ where: { site: { locationId: a1 } } })).toBe(1);
    });

    it('следующая версия: ревизия 2 с родителем 1, черновик отдаёт документ', async () => {
      const next = structuredClone(SPEC);
      next.site.displayName.ru = 'Степной ветер, обновлено';
      const r = await call('POST', '/marketing/site/versions', { body: { baseRevision: 1, spec: next } });
      expect(r.status).toBe(201);
      expect(r.body.version.revision).toBe(2);
      const rows = await db.marketingSiteVersion.findMany({ where: { site: { locationId: a1 } }, orderBy: { revision: 'asc' } });
      expect(rows[1]!.parentVersionId).toBe(rows[0]!.id);
      const draft = await call('GET', '/marketing/site/draft');
      expect(draft.status).toBe(200);
      expect(draft.body.version.revision).toBe(2);
      expect(draft.body.version.spec.site.displayName.ru).toBe('Степной ветер, обновлено');
    });

    it('два одновременных сохранения с одной ревизией: одно проходит, второе 409, новая версия ровно одна', async () => {
      const spec = (n: number) => {
        const s = structuredClone(SPEC);
        s.site.displayName.ru = `Параллельно ${n}`;
        return { baseRevision: 2, spec: s };
      };
      const results = await Promise.all([1, 2, 3].map((n) => call('POST', '/marketing/site/versions', { body: spec(n) })));
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      const rows = await db.marketingSiteVersion.findMany({ where: { site: { locationId: a1 } } });
      expect(rows.map((r) => r.revision).sort()).toEqual([1, 2, 3]);
      const site = await db.marketingSite.findFirstOrThrow({ where: { locationId: a1 } });
      expect(site.latestVersionId).toBe(rows.find((r) => r.revision === 3)!.id);
    });

    it('у сайта без версий годится только baseRevision 0: иначе 409', async () => {
      const r = await call('POST', '/marketing/site/versions', { scope: A2, body: { baseRevision: 5, spec: SPEC } });
      expect(r.status).toBe(409);
    });
  });

  describe('база: изоляция, неизменяемость, принадлежность', () => {
    it('чужая организация не видит ни сайтов, ни версий; своя видит свои', async () => {
      const seen = (org: string) =>
        asApp(org, async () => {
          const sites = await sql.query(
            `SELECT count(*)::int AS n FROM marketing_sites s JOIN locations l ON l.id = s.location_id
              WHERE l.id = ANY($1::uuid[])`,
            [[a1, a2]],
          );
          const versions = await sql.query(
            `SELECT count(*)::int AS n FROM marketing_site_versions v JOIN marketing_sites s ON s.id = v.site_id
              WHERE s.location_id = $1`,
            [a1],
          );
          return [sites.rows[0].n, versions.rows[0].n];
        });
      expect(await seen(orgB)).toEqual([0, 0]);
      expect(await seen(orgA)).toEqual([2, 3]);
      expect(await seen('')).toEqual([0, 0]);
    });

    it('API чужой организации не видит сайт и не может писать в него', async () => {
      const r = await call('GET', '/marketing/site', { user: 'B', scope: pointer(otherHotel, b1) });
      expect(r.body).toEqual({ site: null });
      const spoof = await call('GET', '/marketing/site', { user: 'B', scope: A1 });
      expect(spoof.status).toBe(403);
    });

    it('роль приложения не меняет и не удаляет версии', async () => {
      const [version] = (
        await sql.query(
          `SELECT v.id FROM marketing_site_versions v JOIN marketing_sites s ON s.id = v.site_id WHERE s.location_id = $1 LIMIT 1`,
          [a1],
        )
      ).rows;
      await asApp(orgA, async () => {
        await sql.query('SAVEPOINT probe');
        await expect(sql.query(`UPDATE marketing_site_versions SET spec_hash = repeat('0', 64) WHERE id = $1`, [version.id])).rejects.toThrow(/permission denied/);
        await sql.query('ROLLBACK TO SAVEPOINT probe');
        await expect(sql.query(`DELETE FROM marketing_site_versions WHERE id = $1`, [version.id])).rejects.toThrow(/permission denied/);
      });
    });

    it('даже владелец таблицы не меняет и не удаляет версию: сторож без исключений', async () => {
      const [version] = (
        await sql.query(
          `SELECT v.id FROM marketing_site_versions v JOIN marketing_sites s ON s.id = v.site_id WHERE s.location_id = $1 LIMIT 1`,
          [a1],
        )
      ).rows;
      await sql.query('BEGIN');
      try {
        await sql.query('SAVEPOINT probe');
        await expect(sql.query(`UPDATE marketing_site_versions SET spec = '{}'::jsonb WHERE id = $1`, [version.id])).rejects.toThrow(/неизменяема/);
        await sql.query('ROLLBACK TO SAVEPOINT probe');
        await expect(sql.query(`DELETE FROM marketing_site_versions WHERE id = $1`, [version.id])).rejects.toThrow(/неизменяема/);
      } finally {
        await sql.query('ROLLBACK');
      }
    });

    it('указатели сайта и родитель версии не ведут на другой сайт', async () => {
      const siteA1 = await db.marketingSite.findFirstOrThrow({ where: { locationId: a1 } });
      const siteA2 = await db.marketingSite.findFirstOrThrow({ where: { locationId: a2 } });
      const foreign = await db.marketingSiteVersion.findFirstOrThrow({ where: { siteId: siteA1.id } });
      await sql.query('BEGIN');
      try {
        for (const column of ['latest_version_id', 'published_version_id']) {
          await sql.query('SAVEPOINT probe');
          await expect(
            sql.query(`UPDATE marketing_sites SET ${column} = $1 WHERE id = $2`, [foreign.id, siteA2.id]),
          ).rejects.toThrow(/другого сайта/);
          await sql.query('ROLLBACK TO SAVEPOINT probe');
        }
        await expect(
          sql.query(
            `INSERT INTO marketing_site_versions (id, site_id, revision, parent_version_id, schema_version, spec, spec_hash, source)
             VALUES ($1, $2, 2, $3, 'site-spec/0', '{}'::jsonb, repeat('a', 64), 'MANUAL')`,
            [randomUUID(), siteA2.id, foreign.id],
          ),
        ).rejects.toThrow(/другому сайту/);
        await sql.query('ROLLBACK TO SAVEPOINT probe');
        await expect(
          sql.query(
            `INSERT INTO marketing_site_versions (id, site_id, revision, schema_version, spec, spec_hash, source)
             VALUES ($1, $2, 7, 'site-spec/0', '{}'::jsonb, repeat('a', 64), 'MANUAL')`,
            [randomUUID(), siteA2.id],
          ),
        ).rejects.toThrow(/первая/);
      } finally {
        await sql.query('ROLLBACK');
      }
    });

    it('организация только для чтения не пишет: 403, читать может', async () => {
      await db.organization.update({ where: { id: orgA }, data: { status: 'TRIAL', trialEndsAt: null } });
      try {
        const r = await call('POST', '/marketing/site/versions', { body: { baseRevision: 3, spec: SPEC } });
        expect(r.status).toBe(403);
        expect(r.body.message).toMatch(/только для чтения/);
        expect((await call('GET', '/marketing/site')).status).toBe(200);
      } finally {
        await db.organization.update({ where: { id: orgA }, data: { status: 'ACTIVE' } });
      }
    });

    it('филиал сайта не меняется после создания', async () => {
      const siteA2 = await db.marketingSite.findFirstOrThrow({ where: { locationId: a2 } });
      await expect(
        sql.query(`UPDATE marketing_sites SET location_id = $1 WHERE id = $2`, [archivedLocation, siteA2.id]),
      ).rejects.toThrow(/филиал сайта не меняется/);
    });
  });
});
