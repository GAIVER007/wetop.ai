import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { validateSiteSpec } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { BRIEF_CHANNEX_READER } from '../../apps/api/src/marketing-site/brief.service';
import { GENERATION_BOT } from '../../apps/api/src/marketing-site/generation.bot';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';
import { grantSiteBuilder, purgeSiteBuilderRows } from '../tools/site-builder';

/**
 * «Создать свой сайт» по промту на настоящей базе (владелец 29.10.2026): `POST /marketing/site/from-prompt` одним
 * действием заводит сайт филиала и первую версию из его данных в своём дизайне по словам человека, без ИИ (бот
 * генерации не подключён вовсе), с SEO и FAQ. Два салона с одним промтом получают разные сайты; текста промта в журнале
 * нет; сайт с версией: 409; пустой промт и лишние поля: 400; без лицензии: 403. Данные вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;
const schema = process.env.DATABASE_SCHEMA || 'public';

describe.skipIf(!url)('site from prompt', () => {
  let db: Db;
  let app: INestApplication;
  let base: string;
  const org = randomUUID(),
    user = randomUUID(),
    hotel = randomUUID(),
    beauty = randomUUID(),
    food = randomUUID(),
    hotelLoc = randomUUID(),
    salon = randomUUID(),
    salon2 = randomUUID(),
    salonNoLicense = randomUUID(),
    cafe = randomUUID(),
    property = randomUUID(),
    svc = randomUUID(),
    master = randomUUID(),
    cat = randomUUID(),
    dish = randomUUID();
  const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
  const scopeOf: Record<string, string> = {};

  async function post(location: string, body: unknown) {
    const res = await fetch(`${base}/marketing/site/from-prompt`, {
      method: 'POST',
      headers: { 'x-test-user': user, 'x-test-org': org, 'x-wetop-scope': scopeOf[location]!, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }
  const head = async (location: string) => {
    const site = await db.marketingSite.findUniqueOrThrow({ where: { locationId: location }, select: { id: true, latestVersionId: true } });
    const v = await db.marketingSiteVersion.findUniqueOrThrow({ where: { id: site.latestVersionId! }, select: { spec: true, revision: true, source: true } });
    return { site, ...v, spec: v.spec as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: 'site from prompt (synthetic)', status: 'ACTIVE' } });
    await db.user.create({ data: { id: user, email: `site-prompt-${user}@example.invalid`, passwordHash: 'x' } });
    await db.membership.create({ data: { userId: user, organizationId: org, role: 'OWNER' } });
    await db.business.createMany({
      data: [
        { id: hotel, organizationId: org, name: 'Гостиница', vertical: 'HOSPITALITY' },
        { id: beauty, organizationId: org, name: 'Салон', vertical: 'BEAUTY' },
        { id: food, organizationId: org, name: 'Кафе', vertical: 'FOOD_SERVICE' },
      ],
    });
    const loc = (id: string, businessId: string, name: string, extra: Record<string, unknown> = {}) => ({
      id, businessId, name, timezone: 'Asia/Almaty', currency: 'KZT', ...extra,
    });
    await db.location.createMany({
      data: [
        loc(hotelLoc, hotel, 'Гостиница «Шаблон»'),
        loc(salon, beauty, 'Салон «Шаблон»', { address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01' }),
        loc(salon2, beauty, 'Салон «Второй»'),
        loc(salonNoLicense, beauty, 'Салон без лицензии'),
        loc(cafe, food, 'Кафе «Шаблон»'),
      ],
    });
    scopeOf[hotelLoc] = `business=${hotel};location=${hotelLoc}`;
    scopeOf[salon] = `business=${beauty};location=${salon}`;
    scopeOf[salon2] = `business=${beauty};location=${salon2}`;
    scopeOf[salonNoLicense] = `business=${beauty};location=${salonNoLicense}`;
    scopeOf[cafe] = `business=${food};location=${cafe}`;
    await db.property.create({
      data: { id: property, organizationId: org, locationId: hotelLoc, name: 'Гостиница «Шаблон»', timezone: 'Asia/Almaty', currency: 'KZT', checkInTime: '14:00', checkOutTime: '12:00' },
    });
    await db.accommodationType.create({ data: { propertyId: property, code: 'std', name: 'Стандарт', kind: 'PRIVATE_ROOM', capacityAdults: 2 } });
    await db.beautyService.create({ data: { id: svc, businessId: beauty, name: 'Маникюр', durationMinutes: 60, price: 800000n, currency: 'KZT' } });
    await db.locationService.create({ data: { locationId: salon, serviceId: svc } });
    await db.employee.create({ data: { id: master, businessId: beauty, name: 'Мастер Айгерим' } });
    await db.employeeLocation.create({ data: { employeeId: master, locationId: salon } });
    await db.workingHours.create({ data: { employeeId: master, locationId: salon, weekday: 1, timeFrom: t('10:00'), timeTo: t('20:00') } });
    await db.menuCategory.create({ data: { id: cat, businessId: food, name: 'Горячее', sortOrder: 1 } });
    await db.menuItem.create({ data: { id: dish, businessId: food, categoryId: cat, name: 'Бешбармак', price: 450000n, currency: 'KZT' } });
    for (const l of [hotelLoc, salon, salon2, cafe]) await grantSiteBuilder(db, l);

    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(BRIEF_CHANNEX_READER)
      .useValue(null)
      // ИИ нет вовсе: сайт по промту собирается без генерации
      .overrideProvider(GENERATION_BOT)
      .useValue(null)
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
  });

  afterAll(async () => {
    await app?.close();
    if (!db) return;
    // версии неизменяемы (сторож базы): уборка как у набора конструктора, под выключенным сторожем в одной транзакции
    const sql = new pg.Client({ connectionString: url, options: `-c search_path=${schema},public` });
    await sql.connect();
    await purgeSiteBuilderRows(sql, [org]);
    const sites = `SELECT s.id FROM marketing_sites s JOIN locations l ON l.id = s.location_id
      JOIN businesses b ON b.id = l.business_id WHERE b.organization_id = ANY($1::uuid[])`;
    await sql.query('BEGIN');
    await sql.query('ALTER TABLE marketing_site_versions DISABLE TRIGGER marketing_site_version_immutable');
    await sql.query(`UPDATE marketing_sites SET latest_version_id = NULL WHERE id IN (${sites})`, [[org]]);
    await sql.query(`DELETE FROM marketing_site_versions WHERE site_id IN (${sites})`, [[org]]);
    await sql.query(`DELETE FROM marketing_sites WHERE id IN (${sites})`, [[org]]);
    await sql.query('ALTER TABLE marketing_site_versions ENABLE TRIGGER marketing_site_version_immutable');
    await sql.query('COMMIT');
    await sql.end();
    await db.menuItem.deleteMany({ where: { businessId: food } });
    await db.menuCategory.deleteMany({ where: { businessId: food } });
    await db.workingHours.deleteMany({ where: { locationId: salon } });
    await db.employeeLocation.deleteMany({ where: { locationId: salon } });
    await db.employee.deleteMany({ where: { businessId: beauty } });
    await db.locationService.deleteMany({ where: { locationId: salon } });
    await db.beautyService.deleteMany({ where: { businessId: beauty } });
    await db.accommodationType.deleteMany({ where: { propertyId: property } });
    await db.property.deleteMany({ where: { id: property } });
    await purgeAuditRows(db, { organizationId: org });
    await db.location.deleteMany({ where: { business: { organizationId: org } } });
    await db.business.deleteMany({ where: { organizationId: org } });
    await db.membership.deleteMany({ where: { organizationId: org } });
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: org } });
    expect(await db.organization.count({ where: { id: org } }), 'уборка теста оставила строки').toBe(0);
    await db.$disconnect();
  });

  const PROMPT = 'Тёмный премиальный салон, золото, акцент на мастеров';

  it('салон: сайт по промту из услуг, мастеров и часов филиала; тёмная тема по словам; SEO и FAQ; журнал без промта', async () => {
    const r = await post(salon, { prompt: PROMPT });
    expect(r.status, r.text).toBe(201);
    expect(r.body.site.latest.revision).toBe(1);
    const v = await head(salon);
    expect(v.revision).toBe(1);
    expect(v.source).toBe('MANUAL');
    expect(validateSiteSpec(v.spec).ok).toBe(true);
    expect(v.spec['site'].vertical).toBe('BEAUTY');
    expect(v.spec['theme']).toMatchObject({ preset: 'NOIR', colorScheme: 'DARK', accent: 'CHAMPAGNE' });
    const sections = v.spec['pages'][0].sections.map((s: { type: string }) => s.type);
    expect(sections).toEqual(expect.arrayContaining(['hero', 'services', 'staff', 'leadForm', 'hours', 'faq']));
    // «акцент на мастеров»: команда сразу под первым экраном
    expect(sections.slice(0, 2)).toEqual(['hero', 'staff']);
    expect(JSON.stringify(v.spec)).toContain('Маникюр');
    expect(v.spec['pages'][0].seo.title.ru).toContain('Салон «Шаблон»');
    const audit = await db.auditLog.findFirstOrThrow({ where: { organizationId: org, action: 'marketing.site.prompt_applied', entityId: v.site.id } });
    expect(audit.after).toMatchObject({ revision: 1, preset: 'NOIR' });
    expect(JSON.stringify(audit.after)).not.toContain('золото');
    const created = await db.auditLog.findFirstOrThrow({ where: { organizationId: org, action: 'marketing.site.created', entityId: v.site.id } });
    expect(created.after).toMatchObject({ via: 'prompt' });
  });

  it('второй салон с тем же коротким промтом: свой сайт, не копия первого', async () => {
    const a = await post(cafe, { prompt: 'Красивый сайт' });
    expect(a.status, a.text).toBe(201);
    const r = await post(salon2, { prompt: 'Красивый сайт' });
    expect(r.status, r.text).toBe(201);
    const first = await head(salon);
    const second = await head(salon2);
    const look = (spec: Record<string, any>) => JSON.stringify([spec['theme'], spec['pages'][0].sections.map((s: Record<string, string>) => `${s['type']}:${s['variant']}`)]); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(look(second.spec)).not.toBe(look(first.spec));
    expect(validateSiteSpec(second.spec).ok).toBe(true);
  });

  it('гостиница: номера из своих таблиц, бронь своя', async () => {
    const r = await post(hotelLoc, { prompt: 'Семейная гостиница у моря, тёплая' });
    expect(r.status, r.text).toBe(201);
    const h = await head(hotelLoc);
    expect(h.spec['site'].vertical).toBe('HOSPITALITY');
    expect(h.spec['theme']).toMatchObject({ colorScheme: 'LIGHT' });
    expect(JSON.stringify(h.spec)).toContain('Стандарт');
  });

  it('сайт уже с версией: 409 SITE_HAS_VERSION, версия не меняется', async () => {
    const before = await head(salon);
    const r = await post(salon, { prompt: 'Яркий поп' });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('SITE_HAS_VERSION');
    expect((await head(salon)).spec).toEqual(before.spec);
  });

  it('пустой промт, слишком длинный и лишние поля: 400; без лицензии филиала: 403, сайт не заводится', async () => {
    expect((await post(salonNoLicense, { prompt: '   ' })).status).toBe(400);
    expect((await post(salonNoLicense, { prompt: 'я'.repeat(1801) })).status).toBe(400);
    expect((await post(salonNoLicense, { prompt: 'Сайт', spec: {} })).status).toBe(400);
    const denied = await post(salonNoLicense, { prompt: 'Сайт' });
    expect(denied.status).toBe(403);
    expect(await db.marketingSite.count({ where: { locationId: salonNoLicense } })).toBe(0);
  });
});
