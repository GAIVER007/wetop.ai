import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';

const url = process.env.DATABASE_URL;
const local = url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe.skipIf(!local)('manual booking concurrency on isolated local PostgreSQL', () => {
  let db: Db;
  let propertyName: string;
  const marker = `ТЕСТ-RETRY-${randomUUID()}`;
  beforeAll(async () => {
    db = createPrismaClient(url);
    propertyName = (
      await db.property.findFirstOrThrow({ where: { inventoryUnits: { some: { code: 'L1' } } } })
    ).name;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  const service = () =>
    new ReservationsService(
      {
        run: (fn) =>
          db.$transaction((tx) => fn(new PrismaReservationsRepository(tx, propertyName)), {
            timeout: 60000,
          }),
        read: (fn) => fn(new PrismaReservationsRepository(db, propertyName)),
      },
      new NoopAriPublisher(),
    );
  const payload = (key: string, offset: number) => ({
    creationKey: key,
    source: 'DESK',
    notes: marker,
    arrivalDate: day(offset),
    departureDate: day(offset + 1),
    guest: { firstName: 'ТЕСТ', lastName: 'Повтор' },
    items: [
      { accommodationTypeCode: 'L-DOUBLE', ratePlanCode: 'L-BASE', adults: 1, unitCode: 'L85' },
    ],
  });

  it('concurrent duplicate and lost response replay persist one guest, booking, folio and allocation', async () => {
    const input = payload(randomUUID(), 220);
    const quote = await service().create(input, { preview: true });
    const before = await db.guest.count();
    const request = { ...input, expectedTotalMinor: quote.totalMinor };
    const [a, b] = await Promise.all([service().create(request), service().create(request)]);
    expect(a.confirmationNumber).toBe(b.confirmationNumber);
    const replay = await service().create(request);
    expect(replay.totalAmountMinor).toBe(quote.totalMinor);
    expect(replay.confirmationNumber).toBe(a.confirmationNumber);
    expect(await db.guest.count()).toBe(before + 1);
    const stored = await db.reservation.findFirstOrThrow({
      where: { creationKey: input.creationKey },
      include: { items: { include: { allocations: true, folio: true } } },
    });
    expect(stored.arrivalDate.toISOString().slice(0, 10)).toBe(input.arrivalDate);
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]!.allocations).toHaveLength(1);
    expect(stored.items[0]!.folio).toBeTruthy();
    expect(stored.totalAmount.toString()).toBe(quote.totalMinor);
    await expect(service().create({ ...request, notes: `${marker}-changed` })).rejects.toThrow(
      'другими данными',
    );
  });

  it('different requests for the same unit produce one success with no partial loser', async () => {
    const before = await db.guest.count();
    const results = await Promise.allSettled([
      service().create(payload(randomUUID(), 230)),
      service().create(payload(randomUUID(), 230)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db.guest.count()).toBe(before + 1);
    expect(await db.reservation.count({ where: { notes: marker } })).toBe(2);
  });
});
