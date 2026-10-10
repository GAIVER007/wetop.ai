import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { PrismaSalesRepository } from '../../apps/api/src/sales/sales.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { deleteOrganizationChain } from '../tools/property-owner';

const url = process.env.DATABASE_URL;

/**
 * Сводка хаба «Продажи» на настоящей базе (SALES2.2): подтверждённые намерения бота с бронью. Отменённая бронь и
 * «незаезд» в числа не входят, неподтверждённое предложение считается как предложение, граница суток идёт по поясу
 * объекта (Алматы, +5), а не по UTC. Своя организация и объект, удаляются в конце.
 */
describe.skipIf(!url)('хаб «Продажи»: числа по намерениям (integration)', () => {
  let db: Db;
  let repo: PrismaSalesRepository;
  const org = randomUUID();
  const user = randomUUID();
  const agent = randomUUID();
  let propertyId = '';
  let typeId = '';
  let planId = '';
  let seq = 0;
  const saved = process.env.INTEGRATION_PROPERTY_ID;

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: `Сводка продаж ${org}` } });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
    propertyId = (
      await createPropertyInChain(db, org, {
        name: `Объект сводки ${org}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      })
    ).id;
    typeId = (
      await db.accommodationType.create({
        data: { propertyId, code: `s-${org.slice(0, 8)}`, name: 'Двойная', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
        select: { id: true },
      })
    ).id;
    planId = (
      await db.ratePlan.create({
        data: { propertyId, code: `sp-${org.slice(0, 8)}`, name: 'Сайт', currency: 'KZT' },
        select: { id: true },
      })
    ).id;
    await db.sellerAgent.create({ data: { id: agent, organizationId: org, createdBy: user, name: 'Продавец сводки' } });
    // объект установки задан явно: репозиторий берёт его, а не «Luxx Aparts» по имени
    process.env.INTEGRATION_PROPERTY_ID = propertyId;
    repo = new PrismaSalesRepository({ db } as PrismaService);
  });

  afterAll(async () => {
    if (saved === undefined) delete process.env.INTEGRATION_PROPERTY_ID;
    else process.env.INTEGRATION_PROPERTY_ID = saved;
    if (!db) return;
    await db.competitorOccupancy.deleteMany({ where: { propertyId } });
    await db.competitor.deleteMany({ where: { propertyId } });
    await db.sellerBookingIntent.deleteMany({ where: { organizationId: org } });
    await db.reservation.deleteMany({ where: { propertyId } });
    await db.sellerAgent.deleteMany({ where: { organizationId: org } });
    await db.ratePlan.deleteMany({ where: { propertyId } });
    await db.accommodationType.deleteMany({ where: { propertyId } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await deleteOrganizationChain(db, [org]);
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  /** Намерение с бронью нужного состояния; createdAt задаётся явно, чтобы попасть в нужные сутки */
  async function intent(createdAt: string, booking?: { status: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_OUT'; total: bigint }) {
    seq += 1;
    let reservationId: string | null = null;
    if (booking) {
      reservationId = (
        await db.reservation.create({
          data: {
            propertyId,
            confirmationNumber: `S${org.slice(0, 6)}${seq}`,
            source: 'WHATSAPP',
            status: booking.status,
            arrivalDate: new Date('2031-06-20T00:00:00Z'),
            departureDate: new Date('2031-06-22T00:00:00Z'),
            adults: 2,
            currency: 'KZT',
            totalAmount: booking.total,
          },
          select: { id: true },
        })
      ).id;
    }
    await db.sellerBookingIntent.create({
      data: {
        agentId: agent,
        organizationId: org,
        propertyId,
        conversationId: `conv-${seq}`,
        channel: 'whatsapp',
        accommodationTypeId: typeId,
        ratePlanId: planId,
        arrivalDate: new Date('2031-06-20T00:00:00Z'),
        departureDate: new Date('2031-06-22T00:00:00Z'),
        adults: 2,
        totalMinor: booking?.total ?? 1_000_000n,
        currency: 'KZT',
        expiresAt: new Date('2031-06-12T00:00:00Z'),
        requestHash: 'b'.repeat(64),
        state: booking ? 'CONFIRMED' : 'QUOTED',
        reservationId,
        createdAt: new Date(createdAt),
      },
    });
  }

  it('считает предложения и подтверждённые брони; отменённая и «незаезд» не входят', async () => {
    // 2031-06-11 по Алматы: от 10 июня 19:00 UTC до 11 июня 18:59 UTC
    await intent('2031-06-11T08:00:00Z'); // предложение без брони
    await intent('2031-06-11T08:05:00Z', { status: 'CONFIRMED', total: 3_000_000n });
    await intent('2031-06-11T08:10:00Z', { status: 'CHECKED_OUT', total: 1_000_000n });
    await intent('2031-06-11T08:15:00Z', { status: 'CANCELLED', total: 9_000_000n });
    await intent('2031-06-11T08:20:00Z', { status: 'NO_SHOW', total: 7_000_000n });
    const totals = await repo.totals({ from: '2031-06-11', to: '2031-06-11' });
    expect(totals.offered).toBe(5);
    expect(totals.booked).toBe(2);
    expect(totals.revenueMinor).toBe(4_000_000n);
    expect(totals.currency).toBe('KZT');
  });

  it('граница суток по поясу объекта: 01:30 по Алматы уже следующий день, хотя в UTC ещё вчера', async () => {
    await intent('2031-06-14T20:30:00Z', { status: 'CONFIRMED', total: 500_000n }); // 15 июня 01:30 Алматы
    const day14 = await repo.totals({ from: '2031-06-14', to: '2031-06-14' });
    const day15 = await repo.totals({ from: '2031-06-15', to: '2031-06-15' });
    expect(day14.booked).toBe(0);
    expect(day15.booked).toBe(1);
    expect(day15.revenueMinor).toBe(500_000n);
  });

  it('пустой отрезок это нули и валюта null, а не ошибка', async () => {
    const totals = await repo.totals({ from: '2031-07-01', to: '2031-07-07' });
    expect(totals).toEqual({ offered: 0, booked: 0, revenueMinor: 0n, currency: null });
  });

  it('конкуренты: действующие, добавленные за 30 суток, день последнего снимка', async () => {
    const a = await db.competitor.create({ data: { propertyId, name: 'Сосед А' } });
    await db.competitor.create({ data: { propertyId, name: 'Сосед Б', active: false } });
    await db.competitor.create({
      data: { propertyId, name: 'Сосед В', createdAt: new Date(Date.now() - 90 * 86_400_000) },
    });
    await db.competitorOccupancy.create({
      data: {
        propertyId,
        competitorId: a.id,
        stayDate: new Date('2031-06-20T00:00:00Z'),
        observedOn: new Date('2031-06-18T00:00:00Z'),
        occupancyBp: 9000,
        source: 'MANUAL',
      },
    });
    const c = await repo.competitors();
    expect(c.count).toBe(2); // архивный не считается
    expect(c.addedLast30).toBe(1); // «Сосед В» старше месяца
    expect(c.lastObservedOn).toBe('2031-06-18');
  });
});
