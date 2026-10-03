import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Намерение брони ИИ-продавца (DATA_MODEL §25, ADR-143) на настоящей схеме: CHECK канала, дат, гостей и суммы;
 * «подтверждено ⇔ есть бронь»; одно сообщение гостя подтверждает одно предложение агента (UNIQUE). Логику подтверждения
 * доказывает unit `bot-booking.controller.test.ts`. Своя организация и объект, удаляются в конце.
 */
describe.skipIf(!url)('намерения брони продавца (integration, DATA_MODEL §25)', () => {
  let db: Db;
  const org = randomUUID();
  const user = randomUUID();
  const agent = randomUUID();
  let propertyId = '';
  let typeId = '';
  let planId = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    await db.organization.create({ data: { id: org, name: `Бронь из чата ${org}` } });
    await db.user.create({ data: { id: user, email: `${user}@example.invalid` } });
    propertyId = (
      await createPropertyInChain(db, org, {
        name: `Объект чата ${org}`,
        timezone: 'Asia/Almaty',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      })
    ).id;
    typeId = (
      await db.accommodationType.create({
        data: { propertyId, code: `chat-${org.slice(0, 8)}`, name: 'Двойная', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
        select: { id: true },
      })
    ).id;
    planId = (
      await db.ratePlan.create({
        data: { propertyId, code: `chat-plan-${org.slice(0, 8)}`, name: 'Сайт', currency: 'KZT' },
        select: { id: true },
      })
    ).id;
    await db.sellerAgent.create({ data: { id: agent, organizationId: org, createdBy: user, name: 'Продавец чата' } });
  });

  afterAll(async () => {
    if (!db) return;
    await db.sellerBookingIntent.deleteMany({ where: { organizationId: org } });
    await db.sellerAgent.deleteMany({ where: { organizationId: org } });
    await db.ratePlan.deleteMany({ where: { propertyId } });
    await db.accommodationType.deleteMany({ where: { propertyId } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await deleteOrganizationChain(db, [org]);
    await db.user.deleteMany({ where: { id: user } });
    await db.organization.deleteMany({ where: { id: org } });
    await db.$disconnect();
  });

  const intent = (over: Record<string, unknown> = {}) => ({
    agentId: agent,
    organizationId: org,
    propertyId,
    conversationId: 'conv-1',
    channel: 'whatsapp',
    accommodationTypeId: typeId,
    ratePlanId: planId,
    arrivalDate: new Date('2031-06-01T00:00:00Z'),
    departureDate: new Date('2031-06-03T00:00:00Z'),
    adults: 2,
    totalMinor: 3_000_000n,
    currency: 'KZT',
    expiresAt: new Date(Date.now() + 30 * 60_000),
    requestHash: 'a'.repeat(64),
    ...over,
  });

  it('котировка записывается; по умолчанию QUOTED без брони', async () => {
    const row = await db.sellerBookingIntent.create({ data: intent() });
    expect(row).toMatchObject({ state: 'QUOTED', reservationId: null, channelMessageId: null });
  });

  it.each([
    ['Telegram', { channel: 'telegram' }],
    ['выезд не позже заезда', { departureDate: new Date('2031-06-01T00:00:00Z') }],
    ['ноль гостей', { adults: 0 }],
    ['нулевая сумма', { totalMinor: 0n }],
    ['подтверждено без брони', { state: 'CONFIRMED' }],
  ])('CHECK базы: %s — отказ', async (_n, over) => {
    await expect(db.sellerBookingIntent.create({ data: intent(over) })).rejects.toThrow();
  });

  it('одно сообщение гостя подтверждает одно предложение агента', async () => {
    await db.sellerBookingIntent.create({ data: intent({ channelMessageId: 'msg-same-0001' }) });
    await expect(
      db.sellerBookingIntent.create({ data: intent({ channelMessageId: 'msg-same-0001' }) }),
    ).rejects.toThrow();
  });
});
