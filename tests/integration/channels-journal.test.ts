import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { LUXX_APARTS_PROPERTY } from '@pms/domain';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Срез 7.2, журнал интеграции для показа Channex. Проверяется то, чего фальшивка репозитория не
 * видит: прямой SQL по `external_events` (`jsonb_typeof`, `payload->>'unique_id'`, приведение
 * перечислений к тексту) и сводка по payload сообщения очереди.
 *
 * Пишутся только свои строки с меткой в идентификаторах, и они удаляются за собой.
 */
describe.skipIf(!url)('журнал каналов: очередь строками, ревизия с номером брони (integration)', () => {
  let db: Db;
  let repo: PrismaChannelsRepository;
  const mark = `INTEGRATION-CHANNELS-${Date.now().toString(36)}`;
  const uniqueId = `${mark}-unique`;
  const number = `${mark}-20260917-BDC`;
  const provider = `channex-test-${mark}`;
  let reservationId = '';

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaChannelsRepository({ db } as PrismaService);
    const property = await db.property.findFirstOrThrow({
      where: { name: LUXX_APARTS_PROPERTY.name },
      select: { id: true, currency: true },
    });
    const r = await db.reservation.create({
      data: {
        propertyId: property.id,
        confirmationNumber: number,
        source: 'OTA',
        channel: 'Booking.com',
        externalId: uniqueId,
        status: 'CONFIRMED',
        arrivalDate: new Date('2027-12-10T00:00:00Z'),
        departureDate: new Date('2027-12-12T00:00:00Z'),
        adults: 1,
        currency: property.currency,
        totalAmount: 0n,
      },
      select: { id: true },
    });
    reservationId = r.id;
    await db.externalEvent.createMany({
      data: [
        {
          id: randomUUID(),
          provider,
          externalEventId: `${mark}-rev-linked`,
          type: 'booking_new',
          payloadHash: 'h1',
          payload: { unique_id: uniqueId, ota_reservation_code: 'BDC-777' },
          status: 'PROCESSED',
          receivedVia: 'WEBHOOK',
        },
        {
          id: randomUUID(),
          provider,
          externalEventId: `${mark}-rev-orphan`,
          type: 'booking_modification',
          payloadHash: 'h2',
          payload: { unique_id: `${mark}-no-such-booking` },
          status: 'FAILED',
          attemptCount: 6,
          lastError: 'не сопоставлена',
        },
      ],
    });
    await db.channelOutbox.createMany({
      data: [
        {
          id: randomUUID(),
          provider,
          kind: 'AVAILABILITY',
          payload: [
            { property_id: 'p1', room_type_id: 'rt-1', date_from: '2027-12-10', date_to: '2027-12-12', availability: 3 },
            { property_id: 'p1', room_type_id: 'rt-2', date_from: '2027-12-09', date_to: '2027-12-11', availability: 1 },
          ],
        },
        {
          id: randomUUID(),
          provider,
          kind: 'RESTRICTIONS',
          payload: [
            { property_id: 'p1', rate_plan_id: 'rp-1', date_from: '2027-12-15', date_to: '2027-12-15', rate: '12000.00' },
          ],
          status: 'FAILED',
          attempts: 3,
          lastError: 'Channex: 422',
        },
      ],
    });
  });

  afterAll(async () => {
    if (!db) return;
    await db.externalEvent.deleteMany({ where: { provider } });
    await db.channelOutbox.deleteMany({ where: { provider } });
    if (reservationId) await db.reservation.delete({ where: { id: reservationId } });
    await db.$disconnect();
  });

  it('ревизия несёт номер брони PMS, несопоставленная — null', async () => {
    const events = await repo.recentEvents(provider, 10);
    const linked = events.find((e) => e.externalEventId === `${mark}-rev-linked`);
    const orphan = events.find((e) => e.externalEventId === `${mark}-rev-orphan`);
    expect(linked).toMatchObject({
      type: 'booking_new',
      status: 'PROCESSED',
      receivedVia: 'WEBHOOK',
      reservationNumber: number,
    });
    expect(orphan).toMatchObject({
      status: 'FAILED',
      attempts: 6,
      lastError: 'не сопоставлена',
      reservationNumber: null,
    });
  });

  it('строка очереди говорит, что именно уехало: вид, число строк, крайние даты, адреса Channex', async () => {
    const rows = await repo.recentOutbox(provider, 10);
    const availability = rows.find((r) => r.kind === 'AVAILABILITY');
    const restrictions = rows.find((r) => r.kind === 'RESTRICTIONS');
    expect(availability).toMatchObject({
      status: 'PENDING',
      attempts: 0,
      lines: 2,
      dateFrom: '2027-12-09',
      dateTo: '2027-12-12',
      roomTypeIds: ['rt-1', 'rt-2'],
      ratePlanIds: [],
      sentAt: null,
    });
    expect(restrictions).toMatchObject({
      status: 'FAILED',
      attempts: 3,
      lastError: 'Channex: 422',
      lines: 1,
      dateFrom: '2027-12-15',
      dateTo: '2027-12-15',
      ratePlanIds: ['rp-1'],
    });
  });
});
