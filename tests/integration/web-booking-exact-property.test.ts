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

  function service(): WebBookingService {
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
      new TurnstileService(),
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
      await db.organization.deleteMany({ where: { id: { in: orgs } } });
    } catch (e) {
      console.warn(`[mkt1b] уборка не закончена: ${(e as Error).message}`);
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

  it('BOOK-4: котировка агента B — объект B; по организации с двумя сайтами — отказ, а не самый ранний', async () => {
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
});
