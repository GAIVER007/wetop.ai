import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { PrismaAnalyticsRepository } from '../../apps/api/src/analytics/analytics.repository';
import { CollectService } from '../../apps/api/src/analytics/collect.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { forgetPropertyRef } from '../../apps/api/src/database/property-ref';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { WidgetCorsMiddleware } from '../../apps/api/src/web-booking/web-booking.module';
import {
  WebBookingService,
  type RequestContext,
} from '../../apps/api/src/web-booking/web-booking.service';
import { TurnstileService } from '../../apps/api/src/web-booking/turnstile';
import { deleteOrganizationChain } from '../tools/property-owner';
import { purgeAuditRows } from '../tools/audit-purge';

const url = process.env.DATABASE_URL;
const local = !!url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * MKT1B (ADR-149, plans/mkt1b-booking-hardening-2026-10-06.md) на настоящей базе: публичная бронь с сайта работает строго
 * в объекте своего сайта и для сайтов всех организаций.
 *
 * Организация M: Business HOSPITALITY → филиал A → объект A → сайт A, филиал B → объект B → сайт B (A заведён раньше).
 * Организация N: свой объект и сайт. Организация S: один объект и один сайт (совместимость котировки по организации).
 * У объектов разные имена категории, поэтому по ответу видно, чей фонд посчитан.
 */
describe.skipIf(!local)('публичная бронь: сайты всех организаций и точный объект сайта (integration)', () => {
  let db: Db;
  const run = randomBytes(4).toString('hex');
  const orgM = randomUUID();
  const orgN = randomUUID();
  const orgS = randomUUID();
  const user = randomUUID();
  const agentB = randomUUID();
  const mails: unknown[] = [];
  type Hotel = { propertyId: string; locationId: string; businessId: string; siteKey: string; host: string };
  let A: Hotel;
  let B: Hotel;
  let N: Hotel;
  let S: Hotel;

  async function hotel(organizationId: string, label: string): Promise<Hotel> {
    const property = await createPropertyInChain(db, organizationId, {
      name: `MKT1B ${label} ${run}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });
    const chain = await db.property.findUniqueOrThrow({
      where: { id: property.id },
      select: { location: { select: { id: true, businessId: true } } },
    });
    const building = await db.building.create({ data: { propertyId: property.id, name: 'Корпус' } });
    const floor = await db.floor.create({ data: { buildingId: building.id, name: '1', sortOrder: 1 } });
    const room = await db.physicalRoom.create({ data: { floorId: floor.id, roomNumber: '101', capacity: 2, isDorm: false } });
    const type = await db.accommodationType.create({
      data: { propertyId: property.id, code: 'STD', name: `Номер ${label}`, kind: 'PRIVATE_ROOM', capacityAdults: 2 },
    });
    await db.inventoryUnit.create({
      data: {
        propertyId: property.id,
        physicalRoomId: room.id,
        accommodationTypeId: type.id,
        kind: 'ROOM',
        code: `U-${label}`,
        housekeepingStatus: 'INSPECTED',
      },
    });
    const plan = await db.ratePlan.create({
      data: { propertyId: property.id, code: 'BASE', name: 'Базовый', currency: 'KZT' },
    });
    await db.ratePlanAccommodationType.create({ data: { ratePlanId: plan.id, accommodationTypeId: type.id } });
    const rates = [];
    for (let n = 30; n <= 60; n++)
      for (const occupancy of [1, 2])
        rates.push({
          date: new Date(`${day(n)}T00:00:00Z`),
          accommodationTypeId: type.id,
          ratePlanId: plan.id,
          occupancy,
          price: 20_000_00n,
        });
    await db.dailyRate.createMany({ data: rates });
    const host = `mkt1b-${label.toLowerCase()}-${run}.example`;
    const siteKey = `pms_${randomBytes(6).toString('hex')}`;
    await db.trackedSite.create({
      data: {
        propertyId: property.id,
        name: `Сайт ${label}`,
        hosts: [host],
        publicKey: siteKey,
        bookingEnabled: true,
        bookingRatePlanId: plan.id,
      },
    });
    return {
      propertyId: property.id,
      locationId: chain.location!.id,
      businessId: chain.location!.businessId,
      siteKey,
      host,
    };
  }

  /** Поддельная проверка Turnstile: токен одноразовый, как у Cloudflare; считает обращения */
  function oneTimeTurnstile() {
    const used = new Set<string>();
    const calls: string[] = [];
    return {
      calls,
      enabled: () => true,
      verify: async (token: unknown) => {
        calls.push(String(token));
        if (typeof token !== 'string' || !token) return { ok: false as const, reason: 'missing' as const };
        if (used.has(token)) return { ok: false as const, reason: 'invalid' as const };
        used.add(token);
        return { ok: true as const };
      },
    };
  }

  function service(turnstile: unknown = new TurnstileService()): WebBookingService {
    const sites = new PrismaAnalyticsRepository({ db } as never);
    const uow = {
      run: <T>(fn: (repo: PrismaReservationsRepository) => Promise<T>) =>
        db.$transaction((tx) => fn(new PrismaReservationsRepository(tx)), { timeout: 60_000 }),
      read: <T>(fn: (repo: PrismaReservationsRepository) => Promise<T>) => fn(new PrismaReservationsRepository(db)),
    };
    const reservations = new ReservationsService(uow as never, new NoopAriPublisher());
    const incidents = { report: async () => undefined, open: async () => [] } as never;
    const mailer = { send: async (letter: unknown) => void mails.push(letter) };
    return new WebBookingService(
      sites,
      uow as never,
      reservations,
      new CollectService(sites),
      incidents,
      turnstile as never,
      mailer as never,
    );
  }
  const ctx = (h: Hotel): RequestContext => ({ originHost: h.host, ownHost: 'api.wetop.ai', ip: null });
  const quoteBody = (h: Hotel) => ({ k: h.siteKey, arrival: day(41), departure: day(43), adults: '1' });
  const bookBody = (h: Hotel) => ({
    k: h.siteKey,
    arrival: day(41),
    departure: day(43),
    adults: 1,
    category: 'STD',
    guest: { firstName: 'Тест', lastName: 'Сайтов', phone: '+77010000000', email: null },
    creationKey: randomUUID(),
  });

  beforeAll(async () => {
    // гость брони с сайта пишется псевдонимом (ADR-018); соль только для этого прогона
    process.env.ANONYMIZE_SALT ??= `mkt1b-${run}`;
    db = createPrismaClient(url);
    forgetPropertyRef();
    await db.organization.createMany({
      data: [
        { id: orgM, name: `MKT1B M ${run}` },
        { id: orgN, name: `MKT1B N ${run}` },
        { id: orgS, name: `MKT1B S ${run}` },
      ],
    });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
    A = await hotel(orgM, 'A');
    B = await hotel(orgM, 'B');
    N = await hotel(orgN, 'N');
    S = await hotel(orgS, 'S');
    // один AI-продавец организации M, на филиале B
    await db.sellerAgent.create({
      data: { id: agentB, organizationId: orgM, createdBy: user, name: 'Продавец B', locationId: B.locationId },
    });
  }, 120_000);

  afterAll(async () => {
    if (!db) return;
    const orgs = [orgM, orgN, orgS];
    const properties = { propertyId: { in: [A, B, N, S].filter(Boolean).map((h) => h.propertyId) } };
    try {
      const reservations = await db.reservation.findMany({ where: properties, select: { id: true } });
      const ids = reservations.map((r) => r.id);
      await db.webSession.updateMany({ where: { reservationId: { in: ids } }, data: { reservationId: null } });
      await db.allocation.deleteMany({ where: { reservationItem: { reservationId: { in: ids } } } });
      await db.paymentAllocation.deleteMany({ where: { folio: { reservationItem: { reservationId: { in: ids } } } } });
      await db.charge.deleteMany({ where: { folio: { reservationItem: { reservationId: { in: ids } } } } });
      await db.folio.deleteMany({ where: { reservationItem: { reservationId: { in: ids } } } });
      await db.stayGuest.deleteMany({ where: { reservationItem: { reservationId: { in: ids } } } });
      await db.reservationItem.deleteMany({ where: { reservationId: { in: ids } } });
      await db.reservation.deleteMany({ where: { id: { in: ids } } });
      await db.guest.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.sellerAgent.deleteMany({ where: { organizationId: { in: orgs } } });
      await db.trackedSite.deleteMany({ where: properties });
      await db.dailyRate.deleteMany({ where: { ratePlan: properties } });
      await db.ratePlanAccommodationType.deleteMany({ where: { ratePlan: properties } });
      await db.ratePlan.deleteMany({ where: properties });
      await db.inventoryUnit.deleteMany({ where: properties });
      await db.physicalRoom.deleteMany({ where: { floor: { building: properties } } });
      await db.floor.deleteMany({ where: { building: properties } });
      await db.building.deleteMany({ where: properties });
      await db.accommodationType.deleteMany({ where: properties });
      await db.property.deleteMany({ where: { id: properties.propertyId } });
      await deleteOrganizationChain(db, orgs);
      await db.user.deleteMany({ where: { id: user } });
      await purgeAuditRows(db, { organizationId: { in: orgs } });
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
      // уборка не глотает ошибок: сбой здесь роняет набор, а не оставляет строки этого прогона в общей тестовой базе
      const left = {
        organizations: await db.organization.count({ where: { id: { in: orgs } } }),
        businesses: await db.business.count({ where: { organizationId: { in: orgs } } }),
        properties: await db.property.count({ where: { id: properties.propertyId } }),
        reservations: await db.reservation.count({ where: properties }),
        guests: await db.guest.count({ where: { organizationId: { in: orgs } } }),
        audit: await db.auditLog.count({ where: { organizationId: { in: orgs } } }),
        users: await db.user.count({ where: { id: user } }),
      };
      expect(left).toEqual({ organizations: 0, businesses: 0, properties: 0, reservations: 0, guests: 0, audit: 0, users: 0 });
    } finally {
      forgetPropertyRef();
      await db.$disconnect();
    }
  }, 120_000);

  it('BOOK-1: CORS виджета пускает домены сайтов разных организаций, без вошедшего человека', async () => {
    const mw = new WidgetCorsMiddleware(new PrismaAnalyticsRepository({ db } as never));
    const allow = async (host: string) => {
      const headers = new Map<string, string>();
      const res = {
        setHeader: (k: string, v: string) => headers.set(k, v),
        status: () => ({ end: () => undefined }),
      } as unknown as Response;
      await mw.use({ method: 'OPTIONS', headers: { origin: `https://${host}`, host: 'api.wetop.ai' } } as unknown as Request, res, () => undefined);
      return headers.get('Access-Control-Allow-Origin') ?? null;
    };
    expect(await allow(A.host)).toBe(`https://${A.host}`);
    expect(await allow(B.host)).toBe(`https://${B.host}`);
    expect(await allow(N.host)).toBe(`https://${N.host}`);
    expect(await allow(`unknown-${run}.example`)).toBeNull();
  });

  it('BOOK-4: расчёт и бронь по ключу сайта B идут в объект B, не в более ранний A', async () => {
    const svc = service();
    const quote = await svc.quote(quoteBody(B), ctx(B));
    expect(quote.categories.map((c) => c.name)).toEqual(['Номер B']);
    const booked = await svc.book(bookBody(B), ctx(B));
    const row = await db.reservation.findFirstOrThrow({
      where: { confirmationNumber: booked.confirmationNumber },
      select: { propertyId: true, source: true },
    });
    expect(row).toEqual({ propertyId: B.propertyId, source: 'WEBSITE' });
    expect(await db.reservation.count({ where: { propertyId: A.propertyId } })).toBe(0);
  }, 60_000);

  it('BOOK-4: котировка агента B: объект B; по организации с двумя сайтами: отказ, а не самый ранний', async () => {
    const svc = service();
    const byAgent = await svc.quoteForAgent(agentB, { arrival: day(41), departure: day(43), adults: '1' });
    expect(byAgent.categories.map((c) => c.name)).toEqual(['Номер B']);
    await expect(
      svc.quoteForOrganization(orgM, { arrival: day(41), departure: day(43), adults: '1' }),
    ).rejects.toMatchObject({ status: 409 });
    const single = await svc.quoteForOrganization(orgS, { arrival: day(41), departure: day(43), adults: '1' });
    expect(single.categories.map((c) => c.name)).toEqual(['Номер S']);
  }, 60_000);

  it('BOOK-4: архивный филиал, архивный Business и чужая цепочка закрывают сайт', async () => {
    const svc = service();
    await db.location.update({ where: { id: B.locationId }, data: { status: 'ARCHIVED' } });
    try {
      await expect(svc.quote(quoteBody(B), ctx(B))).rejects.toMatchObject({ status: 404 });
    } finally {
      await db.location.update({ where: { id: B.locationId }, data: { status: 'ACTIVE' } });
    }
    // филиал N уходит в Business организации M: объект N остаётся за N, а цепочка ведёт в M
    const nBusiness = N.businessId;
    await db.location.update({ where: { id: N.locationId }, data: { businessId: A.businessId } });
    try {
      await expect(svc.quote(quoteBody(N), ctx(N))).rejects.toMatchObject({ status: 404 });
    } finally {
      await db.location.update({ where: { id: N.locationId }, data: { businessId: nBusiness } });
    }
    await db.business.update({ where: { id: S.businessId }, data: { status: 'ARCHIVED' } });
    try {
      await expect(svc.quote(quoteBody(S), ctx(S))).rejects.toMatchObject({ status: 404 });
    } finally {
      await db.business.update({ where: { id: S.businessId }, data: { status: 'ACTIVE' } });
    }
    // после возврата сайт снова работает
    expect((await svc.quote(quoteBody(S), ctx(S))).categories.map((c) => c.name)).toEqual(['Номер S']);
  }, 60_000);
  // MKT1B BOOK-2: идемпотентность /w/book существующими creationKey и creationFingerprint ReservationsService
  // у каждого объекта один номер: каждая новая бронь берёт свои даты
  const withKey = (h: Hotel, creationKey: string | undefined, at: number, over: Record<string, unknown> = {}) => ({
    ...bookBody(h),
    arrival: day(at),
    departure: day(at + 1),
    creationKey,
    guest: { firstName: 'Тест', lastName: 'Повтор', phone: '+77010000001', email: 'guest@example.invalid' },
    comment: 'Приеду вечером',
    ...over,
  });
  const reservationsWithKey = (h: Hotel, key: string) =>
    db.reservation.count({ where: { propertyId: h.propertyId, creationKey: key } });

  it('BOOK-2: K+A дважды: та же бронь, одна запись, одно письмо, проверка Turnstile один раз', async () => {
    const ts = oneTimeTurnstile();
    const svc = service(ts);
    const key = randomUUID();
    const before = mails.length;
    const first = await svc.book({ ...withKey(S, key, 33), turnstileToken: 't-1' }, ctx(S));
    // клиент не узнал исход и повторил тот же запрос с тем же, уже потраченным токеном
    const again = await svc.book({ ...withKey(S, key, 33), turnstileToken: 't-1' }, ctx(S));
    expect(again.confirmationNumber).toBe(first.confirmationNumber);
    expect(again.totalMinor).toBe(first.totalMinor);
    expect(await reservationsWithKey(S, key)).toBe(1);
    expect(mails.length - before).toBe(1);
    expect(ts.calls).toEqual(['t-1']);
  }, 60_000);

  it('BOOK-2: K+A, затем K+B: 409 без данных первой брони', async () => {
    const svc = service(oneTimeTurnstile());
    const key = randomUUID();
    const first = await svc.book({ ...withKey(S, key, 36), turnstileToken: 'a-1' }, ctx(S));
    const tampered = svc.book(
      { ...withKey(S, key, 36, { comment: 'Другой комментарий' }), turnstileToken: 'a-2' },
      ctx(S),
    );
    await expect(tampered).rejects.toMatchObject({ status: 409 });
    const error = (await tampered.catch((e: unknown) => e)) as { message: string; getResponse?: () => unknown };
    expect(JSON.stringify(error.getResponse?.() ?? error.message)).not.toContain(first.confirmationNumber);
    expect(await reservationsWithKey(S, key)).toBe(1);
  }, 60_000);

  it('BOOK-2: два одновременных K+A: ровно одна бронь', async () => {
    const svc = service(oneTimeTurnstile());
    const key = randomUUID();
    const before = mails.length;
    // двойной щелчок: один и тот же одноразовый токен в обоих запросах
    const results = await Promise.allSettled([
      svc.book({ ...withKey(S, key, 39), turnstileToken: 'c-1' }, ctx(S)),
      svc.book({ ...withKey(S, key, 39), turnstileToken: 'c-1' }, ctx(S)),
    ]);
    expect(await reservationsWithKey(S, key)).toBe(1);
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<{ confirmationNumber: string }>).value.confirmationNumber);
    expect(new Set(ok).size).toBe(1);
    expect(mails.length - before).toBe(1);
    // повтор виджета с тем же ключом после отказа проверки получает ту же бронь
    const retry = await svc.book({ ...withKey(S, key, 39), turnstileToken: 'c-2' }, ctx(S));
    expect(retry.confirmationNumber).toBe(ok[0]);
    expect(mails.length - before).toBe(1);
    // разные токены (две вкладки): оба ответа: одна бронь
    const key2 = randomUUID();
    const pair = await Promise.all([
      svc.book({ ...withKey(S, key2, 44), turnstileToken: 'd-1' }, ctx(S)),
      svc.book({ ...withKey(S, key2, 44), turnstileToken: 'd-2' }, ctx(S)),
    ]);
    expect(pair[0].confirmationNumber).toBe(pair[1].confirmationNumber);
    expect(await reservationsWithKey(S, key2)).toBe(1);
    expect(mails.length - before).toBe(2);
  }, 60_000);

  it('BOOK-2: новый ключ требует действующего токена; ключ не UUID v4: 400', async () => {
    const ts = oneTimeTurnstile();
    const svc = service(ts);
    await svc.book({ ...withKey(S, randomUUID(), 47), turnstileToken: 'n-1' }, ctx(S));
    const reused = randomUUID();
    await expect(svc.book({ ...withKey(S, reused, 49), turnstileToken: 'n-1' }, ctx(S))).rejects.toMatchObject({
      status: 403,
    });
    expect(await reservationsWithKey(S, reused)).toBe(0);
    await expect(svc.book({ ...withKey(S, 'not-a-key', 49), turnstileToken: 'n-2' }, ctx(S))).rejects.toMatchObject({
      status: 400,
    });
    await expect(svc.book({ ...withKey(S, '', 49), turnstileToken: 'n-3' }, ctx(S))).rejects.toMatchObject({
      status: 400,
    });
    expect(ts.calls).toEqual(['n-1', 'n-1']);
  }, 60_000);

  // MKT1B: старый виджет из кэша браузера (до выкладки) ключа не шлёт. Переходный путь: бронь проходит обычным
  // путём с ключом, который сервер создал на этот один запрос; Turnstile, лимиты и письмо прежние
  it('BOOK-2: тело старого виджета без creationKey бронирует, Turnstile для него действует', async () => {
    const ts = oneTimeTurnstile();
    const svc = service(ts);
    const legacy = (token?: string) => {
      const body: Record<string, unknown> = { ...withKey(S, undefined, 52), turnstileToken: token };
      delete body['creationKey'];
      return body;
    };
    // без токена: отказ проверки Turnstile (400 «Подтвердите…» по правилу BOOK-SEC1), брони нет
    await expect(svc.book(legacy(undefined), ctx(S))).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('Подтвердите'),
    });
    const before = mails.length;
    const card = await svc.book(legacy('l-1'), ctx(S));
    expect(card.confirmationNumber).toBeTruthy();
    const row = await db.reservation.findFirstOrThrow({
      where: { propertyId: S.propertyId, confirmationNumber: card.confirmationNumber },
      select: { creationKey: true, source: true },
    });
    expect(row.source).toBe('WEBSITE');
    expect(row.creationKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(mails.length - before).toBe(1);
    expect(ts.calls).toEqual(['undefined', 'l-1']);
  }, 60_000);
});
