import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, createPropertyInChain, type Db, type DbTx } from '@pms/database';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { PrismaUnitsRepository } from '../../apps/api/src/units/units.repository';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';

const url = process.env.DATABASE_URL;
const date = (d: string) => new Date(`${d}T00:00:00Z`);
const from = '2032-11-10';
const to = '2032-11-13';

describe.skipIf(!url)('block creation protects sold category capacity on local PostgreSQL', () => {
  let db: Db;
  let orgId: string;
  let propertyId: string;
  let locationId: string;
  let businessId: string;
  let typeId: string;
  let units: Array<{ id: string; accommodationTypeId: string }>;
  beforeAll(async () => {
    if (
      !url ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname) ||
      process.env.DATABASE_SCHEMA !== 'pms_test'
    )
      throw new Error('Isolated local pms_test required');
    db = createPrismaClient(url, 'pms_test');
    expect(await db.$queryRaw`SELECT current_schema() AS schema`).toEqual([{ schema: 'pms_test' }]);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  afterEach(async () => {
    if (!orgId) return;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('wetop.audit_purge', 'on', true)`;
      await tx.auditLog.deleteMany({ where: { entityId: { in: units.map((u) => u.id) } } });
      await tx.inventoryBlock.deleteMany({ where: { inventoryUnit: { propertyId } } });
      await tx.allocation.deleteMany({
        where: { reservationItem: { reservation: { propertyId } } },
      });
      await tx.reservationItem.deleteMany({ where: { reservation: { propertyId } } });
      await tx.reservation.deleteMany({ where: { propertyId } });
      await tx.inventoryUnit.deleteMany({ where: { propertyId } });
      await tx.physicalRoom.deleteMany({ where: { floor: { building: { propertyId } } } });
      await tx.floor.deleteMany({ where: { building: { propertyId } } });
      await tx.building.deleteMany({ where: { propertyId } });
      await tx.accommodationType.deleteMany({ where: { propertyId } });
      await tx.property.delete({ where: { id: propertyId } });
      await tx.location.delete({ where: { id: locationId } });
      await tx.business.delete({ where: { id: businessId } });
      await tx.organization.delete({ where: { id: orgId } });
    });
    orgId = '';
  });
  async function fixture(count = 1) {
    const result = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: `Synthetic capacity ${randomUUID()}` },
      });
      const p = await createPropertyInChain(tx, org.id, {
        name: 'Synthetic capacity',
        timezone: 'UTC',
        currency: 'KZT',
        checkInTime: '14:00',
        checkOutTime: '12:00',
      });
      const loc = await tx.location.findUniqueOrThrow({ where: { id: p.locationId } });
      const cat = await tx.accommodationType.create({
        data: {
          propertyId: p.id,
          code: 'SYN',
          name: 'Synthetic',
          kind: 'PRIVATE_ROOM',
          capacityAdults: 1,
          capacityChildren: 0,
        },
      });
      const building = await tx.building.create({ data: { propertyId: p.id, name: 'Synthetic' } });
      const floor = await tx.floor.create({ data: { buildingId: building.id, name: 'Synthetic' } });
      const room = await tx.physicalRoom.create({
        data: { floorId: floor.id, roomNumber: 'Synthetic', capacity: count },
      });
      const rows = [];
      for (let i = 0; i < count; i++)
        rows.push(
          await tx.inventoryUnit.create({
            data: {
              propertyId: p.id,
              physicalRoomId: room.id,
              accommodationTypeId: cat.id,
              kind: 'ROOM',
              code: `SYN-${i}`,
              active: true,
            },
          }),
        );
      return { org, p, loc, cat, rows };
    });
    orgId = result.org.id;
    propertyId = result.p.id;
    locationId = result.loc.id;
    businessId = result.loc.businessId;
    typeId = result.cat.id;
    units = result.rows;
  }
  async function sold(
    client: Db | DbTx = db,
    start = from,
    end = to,
    status: 'CONFIRMED' | 'CANCELLED' | 'NO_SHOW' | 'CHECKED_OUT' = 'CONFIRMED',
  ) {
    return client.reservation.create({
      data: {
        propertyId,
        confirmationNumber: `SYN-${randomUUID()}`,
        source: 'WALK_IN',
        status,
        arrivalDate: date(start),
        departureDate: date(end),
        adults: 1,
        currency: 'KZT',
        totalAmount: 100n,
        bookedAt: new Date(),
        items: {
          create: {
            accommodationTypeId: typeId,
            arrivalDate: date(start),
            departureDate: date(end),
            status,
            adults: 1,
            price: 100n,
          },
        },
      },
    });
  }
  const block = (n = 0, start = from, end = to) =>
    new PrismaUnitsRepository({ db } as PrismaService).createBlock(
      units[n]!,
      { dateFrom: start, dateTo: end, type: 'MAINTENANCE', reason: 'Synthetic capacity' },
      { before: [], after: { synthetic: true } },
    );
  const existing = (n = 0, start = from, end = to) =>
    db.inventoryBlock.create({
      data: {
        inventoryUnitId: units[n]!.id,
        dateFrom: date(start),
        dateTo: date(end),
        type: 'OTHER',
        reason: 'Synthetic existing',
      },
    });
  async function unchangedRejection(action: () => Promise<unknown>) {
    const before = await db.inventoryBlock.findMany({ where: { inventoryUnit: { propertyId } } });
    await expect(action()).rejects.toThrow(/продан|доступн|мест/i);
    expect(await db.inventoryBlock.findMany({ where: { inventoryUnit: { propertyId } } })).toEqual(
      before,
    );
    expect(await db.auditLog.count({ where: { entityId: { in: units.map((u) => u.id) } } })).toBe(
      0,
    );
  }
  it('rejects blocking the last unit when category bookings have no allocation', async () => {
    await fixture();
    await sold();
    await unchangedRejection(() => block());
  });
  it('rejects a deficit only in the middle night', async () => {
    await fixture(2);
    await sold();
    await sold(db, '2032-11-11', '2032-11-12');
    await unchangedRejection(() => block());
  });
  it('allows using spare capacity', async () => {
    await fixture(2);
    await sold();
    expect(await block()).toBeTruthy();
  });
  it('allows dates outside the sold interval including the departure boundary', async () => {
    await fixture();
    await sold();
    expect(await block(0, to, '2032-11-14')).toBeTruthy();
  });
  it('allows a duplicate block that consumes no additional capacity', async () => {
    await fixture(2);
    await existing();
    await sold();
    expect(await block()).toBeTruthy();
  });
  it('checks only newly blocked nights, not an already full blocked night', async () => {
    await fixture(2);
    await existing(0, from, '2032-11-12');
    await sold();
    await sold(db, from, '2032-11-12');
    expect(await block()).toBeTruthy();
  });
  it('rejects extending a duplicate into a newly full night', async () => {
    await fixture(2);
    await existing(0, from, '2032-11-12');
    await sold();
    await sold(db, '2032-11-12', to);
    await unchangedRejection(() => block());
  });
  it.each(['CANCELLED', 'NO_SHOW', 'CHECKED_OUT'] as const)(
    'does not retain sold capacity for %s without allocations',
    async (status) => {
      await fixture();
      await sold(db, from, to, status);
      expect(await block()).toBeTruthy();
    },
  );
  it('does not consume active capacity when blocking an inactive unit', async () => {
    await fixture(2);
    await db.inventoryUnit.update({ where: { id: units[0]!.id }, data: { active: false } });
    await sold();
    expect(await block()).toBeTruthy();
  });
  it('ignores an existing inactive-unit block without stranding an unassigned booking', async () => {
    await fixture(3);
    await db.inventoryUnit.update({ where: { id: units[0]!.id }, data: { active: false } });
    const inactiveBlock = await existing();
    await sold();
    const availability = new PrismaReservationsRepository(db);
    expect.soft(await availability.categoryAvailability(typeId, from, to)).toBe(1);
    expect(await block(1)).toBeTruthy();
    expect(await db.inventoryBlock.findUniqueOrThrow({ where: { id: inactiveBlock.id } })).toEqual(
      inactiveBlock,
    );
    expect(await availability.categoryAvailability(typeId, from, to)).toBe(0);
    await expect(block(2)).rejects.toThrow(/продан|доступн|мест/i);
    expect(await db.inventoryBlock.count({ where: { inventoryUnit: { propertyId } } })).toBe(2);
  });
  it('rechecks sold inventory after the booking category lock is released', async () => {
    await fixture();
    let release!: () => void;
    let ready!: () => void;
    const wait = new Promise<void>((r) => {
      release = r;
    });
    const taken = new Promise<void>((r) => {
      ready = r;
    });
    const booking = db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`pms.category:${typeId}`}, 0))`;
      await sold(tx);
      ready();
      await wait;
    });
    await taken;
    const pending = block().then(
      () => 'created',
      (e) => e,
    );
    try {
      expect(
        await Promise.race([pending, new Promise((r) => setTimeout(() => r('waiting'), 150))]),
      ).toBe('waiting');
    } finally {
      release();
    }
    await booking;
    const result = await pending;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(/продан|доступн|мест/i);
    expect(await db.inventoryBlock.count({ where: { inventoryUnit: { propertyId } } })).toBe(0);
  });
});
