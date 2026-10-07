import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { localDate } from '@pms/domain';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';
import { CollectService } from '../../apps/api/src/analytics/collect.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import {
  FROM_PRICES_PER_IP_PER_MINUTE,
  WebBookingService,
  type RequestContext,
} from '../../apps/api/src/web-booking/web-booking.service';
import { deleteOrganizationChain } from '../tools/property-owner';
import { purgeAuditRows } from '../tools/audit-purge';

const url = process.env.DATABASE_URL;
const local = !!url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);

/**
 * Q-276 (решение владельца 07.10.2026) на настоящей базе: `GET /w/from-prices` считает цену «от» только по тарифу брони
 * сайта, за 30 ночей от сегодняшней даты объекта, при полной вместимости категории; стоп-продажа исключает ночь;
 * производный тариф брони со своей скидкой и окном продаж; соседний объект той же организации не участвует; домен и
 * ключ сайта проверяются как у брони; в ответе нет внутренних идентификаторов. Гостиницы вымышленные (ADR-010).
 */
describe.skipIf(!local)('цена «от» сайта: только тариф брони, 30 ночей, полная вместимость (integration)', () => {
  let db: Db;
  const run = randomBytes(4).toString('hex');
  const org = randomUUID();
  const today = localDate(new Date(), 'Asia/Almaty');
  const day = (n: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const asDate = (n: number) => new Date(`${day(n)}T00:00:00Z`);
  type Site = { propertyId: string; key: string; host: string };
  const ids: string[] = [];
  let A: Site, B: Site, D: Site, E: Site, OFF: Site;

  async function property(label: string) {
    const p = await createPropertyInChain(db, org, {
      name: `Q276 ${label} ${run}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    ids.push(p.id);
    return p.id;
  }
  const category = (propertyId: string, code: string, capacityAdults: number, kind: 'PRIVATE_ROOM' | 'DORM_BED' = 'PRIVATE_ROOM') =>
    db.accommodationType.create({ data: { propertyId, code, name: `Служебное ${code}`, kind, capacityAdults } });
  const plan = (propertyId: string, code: string, extra: Record<string, unknown> = {}) =>
    db.ratePlan.create({ data: { propertyId, code, name: `Тариф ${code}`, currency: 'KZT', ...extra } });
  const link = (ratePlanId: string, accommodationTypeId: string) =>
    db.ratePlanAccommodationType.create({ data: { ratePlanId, accommodationTypeId } });
  const prices = (ratePlanId: string, accommodationTypeId: string, occupancy: number, nights: number[], price: (n: number) => bigint) =>
    db.dailyRate.createMany({
      data: nights.map((n) => ({ date: asDate(n), accommodationTypeId, ratePlanId, occupancy, price: price(n) })),
    });
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  async function site(propertyId: string, label: string, bookingRatePlanId: string | null, bookingEnabled = true): Promise<Site> {
    const host = `q276-${label}-${run}.example`;
    const key = `pms_${randomBytes(6).toString('hex')}`;
    await db.trackedSite.create({
      data: { propertyId, name: `Сайт ${label}`, hosts: [host], publicKey: key, bookingEnabled, bookingRatePlanId },
    });
    return { propertyId, key, host };
  }

  function service(): WebBookingService {
    const sites = new PrismaAnalyticsRepository({ db } as never);
    const uow = {
      run: <T>(fn: (repo: PrismaReservationsRepository) => Promise<T>) =>
        db.$transaction((tx) => fn(new PrismaReservationsRepository(tx)), { timeout: 60_000 }),
      read: <T>(fn: (repo: PrismaReservationsRepository) => Promise<T>) => fn(new PrismaReservationsRepository(db)),
    };
    const reservations = new ReservationsService(uow as never, new NoopAriPublisher());
    const incidents = { record: async () => undefined } as never;
    return new WebBookingService(sites, uow as never, reservations, new CollectService(sites), incidents);
  }
  const ctx = (s: Site, ip: string | null = null): RequestContext => ({ originHost: s.host, ownHost: 'api.wetop.ai', ip });

  beforeAll(async () => {
    db = createPrismaClient(url);
    forgetPropertyRef();
    await db.organization.create({ data: { id: org, name: `Q276 ${run}`, status: 'ACTIVE' } });

    // A: тариф брони BASE и более дешёвый CHEAP на ту же категорию
    const a = await property('A');
    const std = await category(a, 'standard-double', 2);
    const dorm = await category(a, 'dorm-bed', 1, 'DORM_BED');
    const unlinked = await category(a, 'unlinked', 2);
    const noRates = await category(a, 'no-rates', 2);
    const base = await plan(a, 'BASE');
    const cheap = await plan(a, 'CHEAP');
    for (const c of [std, dorm, noRates]) await link(base.id, c.id);
    await link(cheap.id, std.id);
    await link(cheap.id, unlinked.id);
    // STD на BASE: 30 000 на все ночи окна, ночь 10 за 25 000, ночь 3 за 20 000 под стоп-продажей, ночь 30 (31-я) за 1 000
    await prices(base.id, std.id, 2, range(0, 29), (n) => (n === 10 ? 25_000_00n : n === 3 ? 20_000_00n : 30_000_00n));
    await prices(base.id, std.id, 2, [30, 31], () => 1_000_00n);
    // цена «за одного» дешевле, но вместимость категории 2
    await prices(base.id, std.id, 1, [5], () => 10_000_00n);
    await db.restriction.create({ data: { date: asDate(3), accommodationTypeId: std.id, ratePlanId: base.id, stopSell: true } });
    await prices(base.id, dorm.id, 1, range(0, 29), () => 8_000_00n);
    // у категории без связи с тарифом брони цены BASE есть, но тариф её не продаёт
    await prices(base.id, unlinked.id, 2, range(0, 29), () => 2_000_00n);
    await prices(cheap.id, std.id, 2, range(0, 29), () => 5_000_00n);
    await prices(cheap.id, unlinked.id, 2, range(0, 29), () => 5_000_00n);
    A = await site(a, 'a', base.id);

    // B: соседний объект той же организации с дешёвой ценой той же категории
    const b = await property('B');
    const bStd = await category(b, 'standard-double', 2);
    const bBase = await plan(b, 'BASE');
    await link(bBase.id, bStd.id);
    await prices(bBase.id, bStd.id, 2, range(0, 29), () => 1_000_00n);
    B = await site(b, 'b', bBase.id);

    // D: тариф брони производный: скидка 10 %, заезд не раньше чем через 2 дня, минимум 5 ночей
    const d = await property('D');
    const dStd = await category(d, 'standard-double', 2);
    const parent = await plan(d, 'PARENT');
    await link(parent.id, dStd.id);
    const derived = await plan(d, 'EARLY', {
      parentRatePlanId: parent.id,
      discountPercent: 10,
      minDaysBeforeArrival: 2,
      minNights: 5,
    });
    await prices(parent.id, dStd.id, 2, range(0, 29), (n) => (n < 2 ? 10_000_00n : 20_000_00n));
    D = await site(d, 'd', derived.id);

    // E: тариф брони выключен; OFF: бронь сайта выключена
    const e = await property('E');
    const eStd = await category(e, 'standard-double', 2);
    const eBase = await plan(e, 'BASE', { active: false });
    await link(eBase.id, eStd.id);
    await prices(eBase.id, eStd.id, 2, range(0, 29), () => 30_000_00n);
    E = await site(e, 'e', eBase.id);
    OFF = await site(e, 'off', eBase.id, false);
  }, 120_000);

  afterAll(async () => {
    if (!db) return;
    const properties = { propertyId: { in: ids } };
    try {
      await db.trackedSite.deleteMany({ where: properties });
      await db.restriction.deleteMany({ where: { ratePlan: properties } });
      await db.dailyRate.deleteMany({ where: { ratePlan: properties } });
      await db.ratePlanAccommodationType.deleteMany({ where: { ratePlan: properties } });
      await db.ratePlan.deleteMany({ where: { ...properties, parentRatePlanId: { not: null } } });
      await db.ratePlan.deleteMany({ where: properties });
      await db.accommodationType.deleteMany({ where: properties });
      await db.property.deleteMany({ where: { id: { in: ids } } });
      await deleteOrganizationChain(db, [org]);
      await purgeAuditRows(db, { organizationId: org });
      await db.organization.deleteMany({ where: { id: org } });
      expect(await db.organization.count({ where: { id: org } })).toBe(0);
      expect(await db.property.count({ where: { id: { in: ids } } })).toBe(0);
    } finally {
      forgetPropertyRef();
      await db.$disconnect();
    }
  }, 120_000);

  it('только тариф брони сайта: более дешёвый тариф объекта не участвует; 30 ночей; полная вместимость; стоп-продажа', async () => {
    const r = await service().fromPrices({ k: A.key }, ctx(A));
    expect({ ...r, categories: [...r.categories].sort((x, y) => x.code.localeCompare(y.code)) }).toEqual({
      currency: 'KZT',
      window: { from: day(0), to: day(29) },
      categories: [
        { code: 'dorm-bed', fromMinor: '800000' },
        // минимум 25 000 (ночь 10): 20 000 под стоп-продажей, 1 000 за окном, 10 000 при вместимости 1, 5 000 у CHEAP
        { code: 'standard-double', fromMinor: '2500000' },
      ],
    });
  });

  it('категория без связи с тарифом брони и категория без цен в ответ не попадают', async () => {
    const r = await service().fromPrices({ k: A.key }, ctx(A));
    expect(r.categories.map((c) => c.code)).not.toContain('unlinked');
    expect(r.categories.map((c) => c.code)).not.toContain('no-rates');
  });

  it('в ответе нет внутренних идентификаторов: только код категории, цена, валюта и окно', async () => {
    const r = await service().fromPrices({ k: A.key }, ctx(A));
    expect(Object.keys(r).sort()).toEqual(['categories', 'currency', 'window']);
    for (const c of r.categories) expect(Object.keys(c).sort()).toEqual(['code', 'fromMinor']);
    const text = JSON.stringify(r);
    expect(text).not.toContain(A.propertyId);
    expect(text).not.toContain(org);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(text).not.toContain('Служебное');
    expect(text).not.toContain('BASE');
  });

  it('соседний объект той же организации не используется: у сайта B своя цена', async () => {
    const r = await service().fromPrices({ k: B.key }, ctx(B));
    expect(r.categories).toEqual([{ code: 'standard-double', fromMinor: '100000' }]);
  });

  it('производный тариф брони: скидка 10 % и окно продаж к ночи, минимум ночей не применяется', async () => {
    const r = await service().fromPrices({ k: D.key }, ctx(D));
    // ночи 0 и 1 (10 000) раньше двух дней до заезда; дальше 20 000 со скидкой 10 % = 18 000
    expect(r.categories).toEqual([{ code: 'standard-double', fromMinor: '1800000' }]);
  });

  it('тариф брони выключен: цен нет, другой тариф не подставляется', async () => {
    const r = await service().fromPrices({ k: E.key }, ctx(E));
    expect(r.categories).toEqual([]);
  });

  it('бронирование сайта выключено, неизвестный ключ: 404, как у брони', async () => {
    await expect(service().fromPrices({ k: OFF.key }, ctx(OFF))).rejects.toBeInstanceOf(NotFoundException);
    await expect(service().fromPrices({ k: 'pms_000000000000' }, ctx(A))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('домен: только домен своего сайта, как у брони; чужой и пустой Origin получают 403', async () => {
    await expect(service().fromPrices({ k: A.key }, ctx(B))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service().fromPrices({ k: A.key }, { originHost: null, ownHost: 'api.wetop.ai', ip: null }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('лимит запросов с одного адреса', async () => {
    const svc = service();
    for (let i = 0; i < FROM_PRICES_PER_IP_PER_MINUTE; i++) await svc.fromPrices({ k: A.key }, ctx(A, '203.0.113.7'));
    const err = await svc.fromPrices({ k: A.key }, ctx(A, '203.0.113.7')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(429);
  }, 60_000);
});
