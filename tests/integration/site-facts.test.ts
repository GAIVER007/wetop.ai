import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { starterSpecFromFacts, validateSiteSpec, type SiteFacts } from '@pms/domain';
import { AuthorInterceptor } from '../../apps/api/src/auth/author.interceptor';
import { RoleGuard } from '../../apps/api/src/auth/role.guard';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { MarketingSiteModule } from '../../apps/api/src/marketing-site/marketing-site.module';
import { BRIEF_CHANNEX_READER, readBriefSnapshot } from '../../apps/api/src/marketing-site/brief.service';
import { useApiBodyParsers } from '../../apps/api/src/body-parsers';
import { purgeAuditRows } from '../tools/audit-purge';
import { isLocalDatabase } from '../tools/seed-local';

/**
 * SITE-2 на настоящей базе: «что WETOP знает о филиале» салона и ресторана из своих таблиц (услуги филиала с его
 * ценой, мастера и смены филиала, меню в порядке ресторана, сервис-периоды), без чужого филиала и чужой организации;
 * бриф генерации берёт те же факты; список филиалов со статусом сайта. Данные вымышленные (ADR-010).
 */
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('SITE-2 site facts', () => {
  let db: Db;
  const apps: INestApplication[] = [];
  let base: string;
  const orgA = randomUUID(),
    orgB = randomUUID(),
    userA = randomUUID(),
    userB = randomUUID(),
    beauty = randomUUID(),
    food = randomUUID(),
    otherBeauty = randomUUID(),
    salon = randomUUID(),
    salon2 = randomUUID(),
    cafe = randomUUID(),
    foreignSalon = randomUUID(),
    svcMani = randomUUID(),
    svcCut = randomUUID(),
    svcOff = randomUUID(),
    masterA = randomUUID(),
    masterB = randomUUID(),
    masterElsewhere = randomUUID(),
    catSoup = randomUUID(),
    catHot = randomUUID(),
    dishBorsch = randomUUID(),
    dishPlov = randomUUID(),
    dishOff = randomUUID();
  const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

  async function get(path: string, user: 'A' | 'B' = 'A', role = 'OWNER') {
    const res = await fetch(`${base}${path}`, { headers: { 'x-test-user': user, 'x-test-role': role } });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, text };
  }

  beforeAll(async () => {
    if (!isLocalDatabase(url!)) throw new Error('Requires isolated localhost PostgreSQL');
    db = createPrismaClient(url);
    await db.organization.createMany({
      data: [
        { id: orgA, name: 'SITE-2 own (synthetic)', status: 'ACTIVE' },
        { id: orgB, name: 'SITE-2 other (synthetic)', status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: userA, email: `site2-a-${userA}@example.invalid`, passwordHash: 'x' },
        { id: userB, email: `site2-b-${userB}@example.invalid`, passwordHash: 'x' },
      ],
    });
    await db.membership.createMany({
      data: [
        { userId: userA, organizationId: orgA, role: 'OWNER' },
        { userId: userB, organizationId: orgB, role: 'OWNER' },
      ],
    });
    await db.business.createMany({
      data: [
        { id: beauty, organizationId: orgA, name: 'Салон', vertical: 'BEAUTY' },
        { id: food, organizationId: orgA, name: 'Кафе', vertical: 'FOOD_SERVICE' },
        { id: otherBeauty, organizationId: orgB, name: 'Чужой салон', vertical: 'BEAUTY' },
      ],
    });
    const loc = (id: string, businessId: string, name: string, extra: Record<string, unknown> = {}) => ({
      id, businessId, name, timezone: 'Asia/Almaty', currency: 'KZT', ...extra,
    });
    await db.location.createMany({
      data: [
        loc(salon, beauty, 'Салон на Тестовой', { address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01' }),
        loc(salon2, beauty, 'Салон второй'),
        loc(cafe, food, 'Кафе «Пример»'),
        loc(foreignSalon, otherBeauty, 'Чужой филиал'),
      ],
    });
    await db.beautyService.createMany({
      data: [
        { id: svcMani, businessId: beauty, name: 'Маникюр', category: 'Ногти', durationMinutes: 60, price: 700000n, currency: 'KZT' },
        { id: svcCut, businessId: beauty, name: 'Стрижка', durationMinutes: 45, price: 500000n, currency: 'KZT' },
        { id: svcOff, businessId: beauty, name: 'Только во втором', durationMinutes: 30, price: 100000n, currency: 'KZT' },
      ],
    });
    await db.locationService.createMany({
      data: [
        { locationId: salon, serviceId: svcMani, priceOverride: 800000n },
        { locationId: salon, serviceId: svcCut, durationOverride: 50 },
        { locationId: salon2, serviceId: svcOff },
      ],
    });
    await db.employee.createMany({
      data: [
        { id: masterA, businessId: beauty, name: 'Мастер Айгерим' },
        { id: masterB, businessId: beauty, name: 'Мастер Бота' },
        { id: masterElsewhere, businessId: beauty, name: 'Мастер второго филиала' },
      ],
    });
    await db.employeeLocation.createMany({
      data: [
        { employeeId: masterA, locationId: salon },
        { employeeId: masterB, locationId: salon },
        { employeeId: masterElsewhere, locationId: salon2 },
      ],
    });
    await db.employeeService.createMany({ data: [{ employeeId: masterA, serviceId: svcMani }] });
    await db.workingHours.createMany({
      data: [
        { employeeId: masterA, locationId: salon, weekday: 1, timeFrom: t('10:00'), timeTo: t('18:00') },
        { employeeId: masterB, locationId: salon, weekday: 1, timeFrom: t('12:00'), timeTo: t('21:00') },
        { employeeId: masterElsewhere, locationId: salon2, weekday: 2, timeFrom: t('08:00'), timeTo: t('22:00') },
      ],
    });
    await db.menuCategory.createMany({
      data: [
        { id: catHot, businessId: food, name: 'Горячее', sortOrder: 2 },
        { id: catSoup, businessId: food, name: 'Супы', sortOrder: 1 },
      ],
    });
    await db.menuItem.createMany({
      data: [
        { id: dishPlov, businessId: food, categoryId: catHot, name: 'Плов', price: 350000n, currency: 'KZT' },
        { id: dishBorsch, businessId: food, categoryId: catSoup, name: 'Борщ', weightGrams: 300, price: 250000n, currency: 'KZT' },
        { id: dishOff, businessId: food, categoryId: catSoup, name: 'Снято с меню', price: 1n, currency: 'KZT', active: false },
      ],
    });
    await db.servicePeriod.createMany({
      data: [
        { locationId: cafe, name: 'Обед', weekday: 5, timeFrom: t('12:00'), timeTo: t('16:00'), defaultDurationMinutes: 90 },
        { locationId: cafe, name: 'Вечер', weekday: 5, timeFrom: t('18:00'), timeTo: t('02:00'), endsNextDay: true, defaultDurationMinutes: 120 },
      ],
    });

    const module = await Test.createTestingModule({ imports: [MarketingSiteModule] })
      .overrideProvider(PrismaService)
      .useValue({ db })
      .overrideProvider(BRIEF_CHANNEX_READER)
      .useValue(null)
      .compile();
    const app = module.createNestApplication({ bodyParser: false });
    useApiBodyParsers(app);
    app.use((req: { user?: object; headers: Record<string, string> }, _res: unknown, next: () => void) => {
      const b = req.headers['x-test-user'] === 'B';
      req.user = { id: b ? userB : userA, organizationId: b ? orgB : orgA, role: req.headers['x-test-role'] ?? 'OWNER' };
      next();
    });
    app.useGlobalGuards(new RoleGuard(new Reflector()));
    app.useGlobalInterceptors(new AuthorInterceptor({ db } as PrismaService));
    await app.listen(0, '127.0.0.1');
    apps.push(app);
    base = await app.getUrl();
  });

  afterAll(async () => {
    for (const app of apps) await app.close();
    if (!db) return;
    await db.servicePeriod.deleteMany({ where: { locationId: cafe } });
    await db.menuItem.deleteMany({ where: { businessId: food } });
    await db.menuCategory.deleteMany({ where: { businessId: food } });
    await db.workingHours.deleteMany({ where: { locationId: { in: [salon, salon2] } } });
    await db.employeeService.deleteMany({ where: { employee: { businessId: beauty } } });
    await db.employeeLocation.deleteMany({ where: { locationId: { in: [salon, salon2] } } });
    await db.employee.deleteMany({ where: { businessId: beauty } });
    await db.locationService.deleteMany({ where: { locationId: { in: [salon, salon2] } } });
    await db.beautyService.deleteMany({ where: { businessId: beauty } });
    await purgeAuditRows(db, { organizationId: { in: [orgA, orgB] } });
    await db.location.deleteMany({ where: { business: { organizationId: { in: [orgA, orgB] } } } });
    await db.business.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    expect(await db.organization.count({ where: { id: { in: [orgA, orgB] } } }), 'уборка теста оставила строки').toBe(0);
    await db.$disconnect();
  });

  it('салон: услуги филиала с его ценой и длительностью, только мастера и смены филиала, подсказки', async () => {
    const r = await get(`/marketing/site/facts?locationId=${salon}`);
    expect(r.status, r.text).toBe(200);
    const facts = r.body as SiteFacts;
    expect(facts.vertical).toBe('BEAUTY');
    expect(facts.location).toEqual({ id: salon, name: 'Салон на Тестовой', address: 'Алматы, ул. Тестовая, 1', phone: '+7 700 000 00 01', whatsapp: null, city: null });
    expect(facts.catalog).toEqual({
      kind: 'services',
      items: [
        { code: svcCut, name: 'Стрижка', price: { minor: '500000', currency: 'KZT' }, durationMin: 50 },
        { code: svcMani, name: 'Маникюр', price: { minor: '800000', currency: 'KZT' }, durationMin: 60, category: 'Ногти' },
      ],
    });
    expect(facts.staff).toEqual([
      { id: masterA, name: 'Мастер Айгерим', specialization: 'Маникюр' },
      { id: masterB, name: 'Мастер Бота', specialization: null },
    ]);
    expect(facts.hours.days).toEqual([{ weekday: 1, open: '10:00', close: '21:00' }]);
    expect(facts.reviews).toBeNull();
    expect(facts.gaps.map((g) => g.key)).toEqual(['whatsapp', 'photos']);
    // заготовка сайта из этих фактов проходит валидатор
    const spec = starterSpecFromFacts(facts);
    const checked = validateSiteSpec(spec);
    expect(checked.ok ? [] : checked.errors).toEqual([]);
  });

  it('ресторан: меню в порядке ресторана, без снятых блюд; часы до утра; пробелы адреса и телефона', async () => {
    const r = await get(`/marketing/site/facts?locationId=${cafe}`);
    expect(r.status, r.text).toBe(200);
    const facts = r.body as SiteFacts;
    expect(facts.catalog.items.map((i) => [i.name, i.category, i.price?.minor, i.weightGrams ?? null])).toEqual([
      ['Борщ', 'Супы', '250000', 300],
      ['Плов', 'Горячее', '350000', null],
    ]);
    expect(facts.hours.days).toEqual([{ weekday: 5, open: '12:00', close: '02:00' }]);
    expect(facts.gaps.map((g) => g.key)).toEqual(['address', 'phone', 'whatsapp', 'photos']);
  });

  it('чужая организация и неизвестный филиал: 404; неверный id: 400; сотрудник без права: 403', async () => {
    expect((await get(`/marketing/site/facts?locationId=${foreignSalon}`)).status).toBe(404);
    expect((await get(`/marketing/site/facts?locationId=${salon}`, 'B')).status).toBe(404);
    expect((await get(`/marketing/site/facts?locationId=${randomUUID()}`)).status).toBe(404);
    expect((await get('/marketing/site/facts?locationId=x')).status).toBe(400);
    expect((await get(`/marketing/site/facts?locationId=${salon}`, 'A', 'STAFF')).status).toBe(403);
  });

  it('список филиалов: свои, с направлением и статусом сайта', async () => {
    const r = await get('/marketing/site/locations');
    expect(r.status, r.text).toBe(200);
    const items = (r.body.items as Array<{ id: string }>).filter((i) => [salon, salon2, cafe, foreignSalon].includes(i.id));
    expect(items).toEqual([
      { id: salon, name: 'Салон на Тестовой', vertical: 'BEAUTY', siteStatus: 'NONE' },
      { id: salon2, name: 'Салон второй', vertical: 'BEAUTY', siteStatus: 'NONE' },
      { id: cafe, name: 'Кафе «Пример»', vertical: 'FOOD_SERVICE', siteStatus: 'NONE' },
    ]);
  });

  it('бриф генерации берёт те же факты салона и ресторана', async () => {
    const salonSnap = await db.$transaction((tx) => readBriefSnapshot(tx, { organizationId: orgA, businessId: beauty, locationId: salon }));
    expect(salonSnap.platform.vertical?.vertical).toBe('BEAUTY');
    expect(salonSnap.platform.vertical?.services.map((s) => [s.code, s.priceMinor, s.durationMin]).sort()).toEqual(
      [[svcCut, '500000', 50], [svcMani, '800000', 60]].sort(),
    );
    expect(salonSnap.platform.vertical?.staff.map((s) => s.id).sort()).toEqual([masterA, masterB].sort());
    const cafeSnap = await db.$transaction((tx) => readBriefSnapshot(tx, { organizationId: orgA, businessId: food, locationId: cafe }));
    expect(cafeSnap.platform.vertical?.menu.map((c) => c.title)).toEqual(['Супы', 'Горячее']);
    expect(cafeSnap.platform.property).toBeNull();
  });
});
