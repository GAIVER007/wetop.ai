import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { PrismaMarketingBudgetRepository } from '../../apps/api/src/marketing-budget/marketing-budget.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { deleteOrganizationChain } from '../tools/property-owner';

const url = process.env.DATABASE_URL;

/**
 * Результаты маркетинговых каналов на настоящей базе (МКТ-В5a, Q-MKT-ATTR): брони по источнику, диалоги
 * ИИ-продавца по каналу, заявки сайта. Месяц по поясу объекта (Алматы, +5), отмена и незаезд не входят
 * в брони и выручку, один диалог одно обращение, бронь из ИИ-продавца не считается обращением второй раз,
 * спам и чужой филиал не попадают. Данные вымышленные (ADR-010), своя организация, удаляется в конце.
 */
describe.skipIf(!url)('результаты маркетинга по каналам (integration)', () => {
  let db: Db;
  let repo: PrismaMarketingBudgetRepository;
  const org = randomUUID();
  const user = randomUUID();
  const agent = randomUUID();
  let propertyId = '';
  let locationId = '';
  let otherLocationId = '';
  let otherPropertyId = '';
  let siteId = '';
  let typeId = '';
  let planId = '';
  let seq = 0;

  const chain = async (name: string) =>
    createPropertyInChain(db, org, {
      name: `${name} ${org}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
      checkInTime: '14:00',
      checkOutTime: '12:00',
    });

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: `Маркетинг результаты ${org}` } });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
    const own = await chain('Объект маркетинга');
    propertyId = own.id;
    locationId = (await db.property.findUniqueOrThrow({ where: { id: propertyId }, select: { locationId: true } })).locationId;
    const other = await chain('Чужой филиал');
    otherPropertyId = other.id;
    otherLocationId = (await db.property.findUniqueOrThrow({ where: { id: otherPropertyId }, select: { locationId: true } })).locationId;
    typeId = (
      await db.accommodationType.create({
        data: { propertyId, code: `m-${org.slice(0, 8)}`, name: 'Двойная', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
        select: { id: true },
      })
    ).id;
    planId = (
      await db.ratePlan.create({
        data: { propertyId, code: `mp-${org.slice(0, 8)}`, name: 'Сайт', currency: 'KZT' },
        select: { id: true },
      })
    ).id;
    siteId = (
      await db.trackedSite.create({
        data: {
          locationId,
          propertyId,
          name: 'Сайт маркетинга',
          hosts: [`mkt-${org.slice(0, 8)}.example`],
          publicKey: `pms_${randomBytes(6).toString('hex')}`,
        },
        select: { id: true },
      })
    ).id;
    await db.sellerAgent.create({ data: { id: agent, organizationId: org, createdBy: user, name: 'Продавец маркетинга' } });
    repo = new PrismaMarketingBudgetRepository({ db } as PrismaService);
  });

  afterAll(async () => {
    if (!db) return;
    await db.siteLead.deleteMany({ where: { organizationId: org } });
    await db.sellerBookingIntent.deleteMany({ where: { organizationId: org } });
    await db.reservation.deleteMany({ where: { propertyId: { in: [propertyId, otherPropertyId] } } });
    await db.guest.deleteMany({ where: { organizationId: org } });
    await db.trackedSite.deleteMany({ where: { id: siteId } });
    await db.sellerAgent.deleteMany({ where: { organizationId: org } });
    await db.ratePlan.deleteMany({ where: { propertyId } });
    await db.accommodationType.deleteMany({ where: { propertyId } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await deleteOrganizationChain(db, [org]);
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  async function booking(opts: {
    source: 'WEBSITE' | 'WHATSAPP' | 'INSTAGRAM' | 'PHONE' | 'OTA' | 'DESK';
    status?: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_OUT';
    total: bigint;
    bookedAt: string;
    property?: string;
    guest?: string;
  }): Promise<string> {
    seq += 1;
    return (
      await db.reservation.create({
        data: {
          primaryGuestId: opts.guest ?? null,
          propertyId: opts.property ?? propertyId,
          confirmationNumber: `M${org.slice(0, 6)}${seq}`,
          source: opts.source,
          status: opts.status ?? 'CONFIRMED',
          arrivalDate: new Date('2031-06-20T00:00:00Z'),
          departureDate: new Date('2031-06-22T00:00:00Z'),
          adults: 2,
          currency: 'KZT',
          totalAmount: opts.total,
          bookedAt: new Date(opts.bookedAt),
        },
        select: { id: true },
      })
    ).id;
  }

  async function intent(conversationId: string, channel: 'whatsapp' | 'widget', createdAt: string, reservationId?: string) {
    await db.sellerBookingIntent.create({
      data: {
        agentId: agent,
        organizationId: org,
        propertyId,
        conversationId,
        channel,
        accommodationTypeId: typeId,
        ratePlanId: planId,
        arrivalDate: new Date('2031-06-20T00:00:00Z'),
        departureDate: new Date('2031-06-22T00:00:00Z'),
        adults: 2,
        totalMinor: 1_000_000n,
        currency: 'KZT',
        expiresAt: new Date('2031-06-12T00:00:00Z'),
        requestHash: randomBytes(32).toString('hex'),
        state: reservationId ? 'CONFIRMED' : 'QUOTED',
        reservationId: reservationId ?? null,
        createdAt: new Date(createdAt),
      },
    });
  }

  async function lead(status: 'NEW' | 'DONE' | 'SPAM', createdAt: string) {
    seq += 1;
    await db.siteLead.create({
      data: {
        organizationId: org,
        locationId,
        trackedSiteId: siteId,
        name: 'Гость Тестовый',
        phone: '+70000000000',
        status,
        requestKey: `k-${seq}`,
        requestFingerprint: `f-${seq}`,
        createdAt: new Date(createdAt),
      },
    });
  }

  it('октябрь филиала: каналы по правилу Q-MKT-ATTR', async () => {
    // Сайт: две живые брони, одна отменённая, одна на границе месяца (01.11 00:30 Алматы = 31.10 19:30 UTC)
    await booking({ source: 'WEBSITE', total: 300_000n, bookedAt: '2026-10-05T08:00:00Z' });
    await booking({ source: 'WEBSITE', total: 200_000n, bookedAt: '2026-10-31T18:00:00Z' }); // 31.10 23:00 Алматы
    await booking({ source: 'WEBSITE', status: 'CANCELLED', total: 999_000n, bookedAt: '2026-10-10T08:00:00Z' });
    await booking({ source: 'WEBSITE', total: 777_000n, bookedAt: '2026-10-31T19:30:00Z' }); // уже ноябрь
    // заявки сайта: две настоящие, спам не считается
    await lead('NEW', '2026-10-03T08:00:00Z');
    await lead('DONE', '2026-10-04T08:00:00Z');
    await lead('SPAM', '2026-10-05T08:00:00Z');
    // ИИ-продавец в виджете сайта: один диалог с двумя предложениями = одно обращение
    await intent('w-1', 'widget', '2026-10-06T08:00:00Z');
    await intent('w-1', 'widget', '2026-10-06T09:00:00Z');

    // WhatsApp: бронь через ИИ-продавца (обращение только диалогом), незаезд, прямая бронь без ИИ
    const viaBot = await booking({ source: 'WHATSAPP', total: 400_000n, bookedAt: '2026-10-07T08:00:00Z' });
    await intent('wa-1', 'whatsapp', '2026-10-07T07:00:00Z', viaBot);
    await intent('wa-2', 'whatsapp', '2026-10-08T07:00:00Z');
    await booking({ source: 'WHATSAPP', status: 'NO_SHOW', total: 500_000n, bookedAt: '2026-10-09T08:00:00Z' });
    await booking({ source: 'WHATSAPP', total: 150_000n, bookedAt: '2026-10-10T08:00:00Z' });

    // Instagram и телефон: только брони
    await booking({ source: 'INSTAGRAM', total: 120_000n, bookedAt: '2026-10-11T08:00:00Z' });
    await booking({ source: 'PHONE', total: 80_000n, bookedAt: '2026-10-12T08:00:00Z' });
    // не маркетинг: OTA и стойка в воронку не входят
    await booking({ source: 'OTA', total: 5_000_000n, bookedAt: '2026-10-12T08:00:00Z' });
    await booking({ source: 'DESK', total: 5_000_000n, bookedAt: '2026-10-12T08:00:00Z' });
    // чужой филиал той же организации
    await booking({ source: 'WEBSITE', total: 9_000_000n, bookedAt: '2026-10-12T08:00:00Z', property: otherPropertyId });

    const r = await repo.results(locationId, '2026-10-01', '2026-11-01');
    expect(r.supported).toBe(true);
    expect(r.revenueCurrency).toBe('KZT');
    const by = Object.fromEntries(r.channels.map((c) => [c.channel, c]));

    // Сайт: обращения = 3 брони без ИИ (в т. ч. отменённая) + 2 заявки + 1 диалог виджета = 6
    expect(by.SITE).toEqual({ channel: 'SITE', leads: 6, bookings: 2, revenueMinor: 500_000n });
    // WhatsApp: обращения = 2 диалога + 2 брони без ИИ (незаезд и прямая) = 4; брони: через ИИ и прямая
    expect(by.WHATSAPP).toEqual({ channel: 'WHATSAPP', leads: 4, bookings: 2, revenueMinor: 550_000n });
    expect(by.INSTAGRAM).toEqual({ channel: 'INSTAGRAM', leads: 1, bookings: 1, revenueMinor: 120_000n });
    expect(by.PHONE).toEqual({ channel: 'PHONE', leads: 1, bookings: 1, revenueMinor: 80_000n });

    // ноябрь видит бронь, сделанную 01.11 по Алматы
    const nov = await repo.results(locationId, '2026-11-01', '2026-12-01');
    expect(nov.channels.find((c) => c.channel === 'SITE')).toMatchObject({ bookings: 1, revenueMinor: 777_000n });

    // чужой филиал видит только свою бронь
    const foreign = await repo.results(otherLocationId, '2026-10-01', '2026-11-01');
    expect(foreign.channels.find((c) => c.channel === 'SITE')).toMatchObject({ leads: 1, bookings: 1, revenueMinor: 9_000_000n });
  });

  it('филиал без объекта размещения: результатов нет, а не ошибка', async () => {
    const business = await db.business.create({
      data: { organizationId: org, name: 'Салон', vertical: 'BEAUTY' },
      select: { id: true },
    });
    const salon = await db.location.create({
      data: { businessId: business.id, name: 'Салон', timezone: 'Asia/Almaty', currency: 'KZT' },
      select: { id: true },
    });
    const r = await repo.results(salon.id, '2026-10-01', '2026-11-01');
    expect(r).toEqual({ supported: false, revenueCurrency: null, channels: [], days: [] });
    await db.location.delete({ where: { id: salon.id } });
    await db.business.delete({ where: { id: business.id } });
  });

  it('календарь по дням: сумма дней равна месяцу, новые гости, диалог считается в день первого предложения', async () => {
    const guest = async (name: string) =>
      (await db.guest.create({ data: { organizationId: org, firstName: name, lastName: 'Тестовый' }, select: { id: true } })).id;
    const returning = await guest('Вернувшийся');
    const fresh = await guest('Новый');
    // гость приезжал раньше через Booking.com: он уже не новый клиент
    await booking({ source: 'OTA', total: 1n, bookedAt: '2026-08-01T08:00:00Z', guest: returning });
    // декабрь 2026, 03-е: две брони сайта, одна от нового гостя, одна от вернувшегося, одна без гостя
    await booking({ source: 'WEBSITE', total: 300_000n, bookedAt: '2026-12-03T08:00:00Z', guest: fresh });
    await booking({ source: 'WEBSITE', total: 200_000n, bookedAt: '2026-12-03T09:00:00Z', guest: returning });
    await booking({ source: 'PHONE', total: 50_000n, bookedAt: '2026-12-05T09:00:00Z' });
    // вторая бронь того же нового гостя позже в месяце: уже не новый
    await booking({ source: 'WHATSAPP', total: 70_000n, bookedAt: '2026-12-09T09:00:00Z', guest: fresh });
    // диалог начат 30.11 и продолжен 02.12: обращение ноября, в декабре не считается
    await intent('dec-span', 'whatsapp', '2026-11-30T08:00:00Z');
    await intent('dec-span', 'whatsapp', '2026-12-02T08:00:00Z');
    // диалог с двумя предложениями в разные дни декабря: одно обращение в день первого
    await intent('dec-two', 'widget', '2026-12-04T08:00:00Z');
    await intent('dec-two', 'widget', '2026-12-06T08:00:00Z');
    await lead('NEW', '2026-12-04T10:00:00Z');

    const r = await repo.results(locationId, '2026-12-01', '2027-01-01');
    const day = (d: string) => r.days.find((x) => x.date === d);
    expect(day('2026-12-03')).toEqual({ date: '2026-12-03', leads: 2, bookings: 2, newGuests: 1, revenueMinor: 500_000n });
    // 04.12: заявка сайта + первое предложение диалога dec-two
    expect(day('2026-12-04')).toEqual({ date: '2026-12-04', leads: 2, bookings: 0, newGuests: 0, revenueMinor: 0n });
    // бронь без гостя: бронь есть, новым гостем не считается
    expect(day('2026-12-05')).toEqual({ date: '2026-12-05', leads: 1, bookings: 1, newGuests: 0, revenueMinor: 50_000n });
    expect(day('2026-12-06')).toBeUndefined();
    expect(day('2026-12-09')).toEqual({ date: '2026-12-09', leads: 1, bookings: 1, newGuests: 0, revenueMinor: 70_000n });
    expect(day('2026-12-02')).toBeUndefined();
    // месяц ровно сумма дней
    const sum = (k: 'leads' | 'bookings') => r.days.reduce((s, d) => s + d[k], 0);
    expect(r.channels.reduce((s, c) => s + c.leads, 0)).toBe(sum('leads'));
    expect(r.channels.reduce((s, c) => s + c.bookings, 0)).toBe(sum('bookings'));
    expect(r.channels.find((c) => c.channel === 'WHATSAPP')!.leads).toBe(1);
  });
});
