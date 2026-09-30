import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db } from '@pms/database';
import { deleteOrganizationChain } from '../tools/property-owner';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaDiagnosticsRepository } from '../../apps/api/src/assistant/diagnostics.repository';
import { PrismaRequesterContextRepository } from '../../apps/api/src/assistant/requester-context.repository';
import { DiagnosticsService } from '../../apps/api/src/assistant/diagnostics.service';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Диагностика для помощника поддержки (S5) на настоящей базе: бронь ищется только среди объектов организации
 * обратившегося, чужая организация с тем же номером получает «нет такой», у организации без подключённых каналов
 * `channex: null`. Гости, брони и организации вымышленные (ADR-010), после себя всё убирается.
 */
describe.skipIf(!url)('диагностика помощника (integration, DATABASE_URL required)', () => {
  let db: Db;
  let service: DiagnosticsService;
  const mark = Date.now().toString(36);
  const [orgA, orgB] = [randomUUID(), randomUUID()];
  const [ownerA, ownerB] = [randomUUID(), randomUUID()];
  const number = `S5-${mark}`;
  const properties: string[] = [];

  beforeAll(async () => {
    db = createPrismaClient(url);
    const prisma = { db } as PrismaService;
    service = new DiagnosticsService(
      new PrismaRequesterContextRepository(prisma),
      new PrismaDiagnosticsRepository(prisma),
      null,
    );
    await db.organization.createMany({
      data: [
        { id: orgA, name: `Гостиница А ${mark}`, status: 'ACTIVE' },
        { id: orgB, name: `Гостиница Б ${mark}`, status: 'ACTIVE' },
      ],
    });
    await db.user.createMany({
      data: [
        { id: ownerA, email: `owner-a-${mark}@example.invalid`, name: 'Секретное Имя' },
        { id: ownerB, email: `owner-b-${mark}@example.invalid` },
      ],
    });
    await db.membership.createMany({
      data: [
        { userId: ownerA, organizationId: orgA, role: 'OWNER' },
        { userId: ownerB, organizationId: orgB, role: 'OWNER' },
      ],
    });
    // Одна и та же бронь по номеру в двух организациях: номер уникален только внутри объекта
    for (const [org, guestName] of [
      [orgA, 'Гость А'],
      [orgB, 'Гость Б'],
    ] as const) {
      const property = await db.$transaction((tx) =>
        createPropertyInChain(tx, org, {
          name: `Объект ${guestName} ${mark}`,
          timezone: 'Asia/Almaty',
          currency: 'KZT',
          checkInTime: '14:00',
          checkOutTime: '12:00',
        }),
      );
      properties.push(property.id);
      const type = await db.accommodationType.create({
        data: { propertyId: property.id, code: `std-${mark}`, name: 'Стандарт', kind: 'PRIVATE_ROOM', capacityAdults: 2 },
      });
      const guest = await db.guest.create({
        data: { organizationId: org, firstName: guestName, lastName: 'Вымышленный', phone: '+70000000001' },
      });
      await db.reservation.create({
        data: {
          propertyId: property.id,
          confirmationNumber: number,
          source: 'DESK',
          status: 'CONFIRMED',
          arrivalDate: new Date('2099-10-02'),
          departureDate: new Date('2099-10-05'),
          adults: 2,
          currency: 'KZT',
          totalAmount: 4_500_000n,
          notes: 'позвонить гостю',
          primaryGuestId: guest.id,
          items: {
            create: {
              accommodationTypeId: type.id,
              arrivalDate: new Date('2099-10-02'),
              departureDate: new Date('2099-10-05'),
              price: 4_500_000n,
              status: 'CONFIRMED',
              adults: 2,
              stayGuests: { create: { guestId: guest.id, isPrimary: true } },
            },
          },
        },
      });
    }
  });

  afterAll(async () => {
    if (!db) return;
    await db.stayGuest.deleteMany({ where: { reservationItem: { reservation: { propertyId: { in: properties } } } } });
    await db.reservationItem.deleteMany({ where: { reservation: { propertyId: { in: properties } } } });
    await db.reservation.deleteMany({ where: { propertyId: { in: properties } } });
    await db.guest.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.accommodationType.deleteMany({ where: { propertyId: { in: properties } } });
    await db.property.deleteMany({ where: { id: { in: properties } } });
    await deleteOrganizationChain(db, [orgA, orgB]);
    await db.membership.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
    await db.user.deleteMany({ where: { id: { in: [ownerA, ownerB] } } });
    await db.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await db.$disconnect();
  });

  it('владелец А видит свою бронь: факты без имени, телефона, заметок и сумм', async () => {
    const view = await service.reservation(ownerA, orgA, number);
    expect(view).toMatchObject({ number, status: 'CONFIRMED', nights: 3, problems: ['UNASSIGNED_ITEMS'] });
    expect(view?.items).toEqual([
      { category: 'Стандарт', status: 'CONFIRMED', unitAssigned: false, unitCode: null, housekeeping: null },
    ]);
    const text = JSON.stringify(view);
    for (const banned of ['Гость А', 'Гость Б', 'Вымышленный', '0000000001', 'позвонить', '4500000', ownerA, orgA])
      expect(text).not.toContain(banned);
  });

  it('владелец Б с тем же номером получает бронь своего объекта, а не А', async () => {
    const view = await service.reservation(ownerB, orgB, number);
    expect(view?.number).toBe(number);
    expect(JSON.stringify(view)).not.toContain('Гость А');
  });

  it('чужая пара «человек, организация» — нет обратившегося; несуществующий номер — нет брони', async () => {
    expect(await service.reservation(ownerA, orgB, number)).toBeUndefined();
    expect(await service.reservation(ownerA, orgA, `${number}-нет`)).toBeNull();
  });

  it('организация без подключённых каналов — channex: null', async () => {
    expect(await service.integrationHealth(ownerA, orgA)).toEqual({ channex: null });
    expect(await service.integrationHealth(ownerA, orgB)).toBeNull();
  });
});
