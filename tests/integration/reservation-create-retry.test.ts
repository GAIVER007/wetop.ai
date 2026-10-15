import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';
import { ReservationsService } from '../../apps/api/src/reservations/reservations.service';
import { NoopAriPublisher } from '../../apps/api/src/channels/ari-publisher';
import { ChessboardService } from '../../apps/api/src/chessboard/chessboard.service';
import { PrismaChessboardRepository } from '../../apps/api/src/chessboard/chessboard.repository';
import { PrismaChannelsRepository } from '../../apps/api/src/channels/channels.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withIntegrationPropertyScope } from '../../apps/api/src/auth/request-context';

const url = process.env.DATABASE_URL;
const local = url && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

describe.skipIf(!local)('manual booking concurrency on isolated local PostgreSQL', () => {
  let db: Db;
  let propertyName: string;
  const unitCode = `RETRY-${randomUUID()}`;
  const marker = `ТЕСТ-RETRY-${randomUUID()}`;
  beforeAll(async () => {
    db = createPrismaClient(url);
    propertyName = (
      await db.property.findFirstOrThrow({ where: { inventoryUnits: { some: { code: 'L1' } } } })
    ).name;
    const source = await db.inventoryUnit.findFirstOrThrow({ where: { code: 'L85' } });
    await db.inventoryUnit.create({
      data: {
        propertyId: source.propertyId,
        physicalRoomId: source.physicalRoomId,
        accommodationTypeId: source.accommodationTypeId,
        kind: source.kind,
        code: unitCode,
        housekeepingStatus: 'INSPECTED',
      },
    });
  });
  afterAll(async () => {
    if (!db) return;
    try {
      const records = await db.reservation.findMany({ where: { notes: marker } });
      for (const record of records) await service().cancel(record.confirmationNumber);
      await db.inventoryUnit.updateMany({ where: { code: unitCode }, data: { active: false } });
    } finally {
      await db.$disconnect();
    }
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
    guest: { firstName: 'ТЕСТ', lastName: 'Повтор', citizenship: 'KAZ' },
    items: [{ accommodationTypeCode: 'L-DOUBLE', ratePlanCode: 'L-BASE', adults: 1, unitCode }],
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
  it.each([false, true])(
    'same-day checkout restores availability counters, extended and moved: %s',
    async (moveAndExtend) => {
      class Rollback extends Error {}
      await db
        .$transaction(
          async (tx) => {
            const repo = new PrismaReservationsRepository(tx, propertyName);
            const svc = new ReservationsService(
              { run: (fn) => fn(repo), read: (fn) => fn(repo) },
              new NoopAriPublisher(),
            );
            const today = await repo.today();
            const input = {
              ...payload(randomUUID(), 0),
              arrivalDate: today,
              departureDate: new Date(Date.parse(today + 'T00:00:00Z') + 3 * 86400000)
                .toISOString()
                .slice(0, 10),
            };
            const typeId = (await tx.inventoryUnit.findFirstOrThrow({ where: { code: unitCode } }))
              .accommodationTypeId;
            const propertyId = (
              await tx.inventoryUnit.findFirstOrThrow({ where: { code: unitCode } })
            ).propertyId;
            const channels = new PrismaChannelsRepository({ db: tx } as unknown as PrismaService);
            const soldBefore = await withIntegrationPropertyScope(propertyId, () =>
              channels.soldItems(input.arrivalDate, input.departureDate),
            );
            const freeBefore = await repo.categoryAvailability(
              typeId,
              input.arrivalDate,
              input.departureDate,
            );
            const boardRepo = new PrismaChessboardRepository({
              db: tx,
            } as unknown as PrismaService);
            const availability = () =>
              withIntegrationPropertyScope(propertyId, () =>
                new ChessboardService(boardRepo).availability(
                  input.arrivalDate,
                  input.departureDate,
                ),
              );
            const beforeCounters = await availability();
            const boundaryDate = new Date(
              Date.parse(input.departureDate + 'T00:00:00Z') + (moveAndExtend ? 86400000 : 0),
            )
              .toISOString()
              .slice(0, 10);
            const boundaryCounters = () =>
              withIntegrationPropertyScope(propertyId, () =>
                new ChessboardService(boardRepo).availability(
                  boundaryDate,
                  new Date(Date.parse(boundaryDate + 'T00:00:00Z') + 86400000)
                    .toISOString()
                    .slice(0, 10),
                ),
              );
            const beforeBoundary = await boundaryCounters();
            const first = await svc.create(input);
            expect((await availability()).byCategory['L-DOUBLE']!.available).toBe(freeBefore - 1);
            const itemId = first.items[0]!.id;
            // Local synthetic guest card prerequisite, independent of pseudonymized creation mode.
            const stored = await tx.reservation.findFirstOrThrow({
              where: { creationKey: input.creationKey },
            });
            await tx.guest.update({
              where: { id: stored.primaryGuestId! },
              data: { citizenship: 'KAZ' },
            });
            await svc.checkIn(first.confirmationNumber, itemId);
            let target = { code: unitCode };
            if (moveAndExtend) {
              const extended = await svc.extend(first.confirmationNumber, itemId, { nights: 1 });
              input.departureDate = extended.items[0]!.departureDate;
              target = (await repo.freeUnits(typeId, today, input.departureDate))[0]!;
              await svc.assign(first.confirmationNumber, itemId, {
                unitCode: target.code,
                fromDate: today,
              });
            }
            const charges = await tx.charge.findMany({
              where: { folio: { reservationItemId: itemId } },
              orderBy: { id: 'asc' },
            });
            await svc.checkOut(first.confirmationNumber, itemId, { withDebt: true });
            expect(await tx.allocation.count({ where: { reservationItemId: itemId } })).toBe(0);
            expect(
              await tx.charge.findMany({
                where: { folio: { reservationItemId: itemId } },
                orderBy: { id: 'asc' },
              }),
            ).toEqual(charges);
            const unit = await tx.inventoryUnit.findFirstOrThrow({ where: { code: target.code } });
            expect(unit.housekeepingStatus).toBe('DIRTY');
            await repo.setUnitHousekeeping(unit.id, 'DIRTY', 'CLEAN');
            await repo.setUnitHousekeeping(unit.id, 'CLEAN', 'INSPECTED');
            expect(
              await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate),
            ).toBe(freeBefore);
            for (let reload = 0; reload < 2; reload += 1) {
              const counters = await availability();
              expect(counters.total).toEqual(beforeCounters.total);
              expect(counters.byCategory['L-DOUBLE']!.available).toBe(freeBefore);
              expect(counters.byCategory['L-DOUBLE']!.availableUnitCodes).toHaveLength(freeBefore);
              expect(
                Object.values(counters.byCategory).reduce((sum, c) => sum + c.available, 0),
              ).toBe(counters.total.available);
            }
            const sold = await withIntegrationPropertyScope(unit.propertyId, () =>
              channels.soldItems(input.arrivalDate, input.departureDate),
            );
            expect(sold.filter((s) => s.accommodationTypeCode === 'L-DOUBLE')).toEqual(
              soldBefore.filter((s) => s.accommodationTypeCode === 'L-DOUBLE'),
            );
            const group = {
              ...input,
              creationKey: randomUUID(),
              items: [
                {
                  accommodationTypeCode: 'L-DOUBLE',
                  ratePlanCode: 'L-BASE',
                  adults: 1,
                  quantity: freeBefore,
                },
              ],
            };
            const quote = await svc.create(group, { preview: true });
            const next = await svc.create({ ...group, expectedTotalMinor: quote.totalMinor });
            expect(next.confirmationNumber).not.toBe(first.confirmationNumber);
            expect(next.items).toHaveLength(freeBefore);
            expect(
              await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate),
            ).toBe(0);
            expect(
              await tx.allocation.count({ where: { reservationItemId: next.items[0]!.id } }),
            ).toBe(1);
            const reloaded = await repo.card(next.confirmationNumber);
            expect(reloaded?.items).toHaveLength(freeBefore);
            expect(new Set(reloaded!.items.map((i) => i.unitCode)).size).toBe(freeBefore);
            expect((await availability()).byCategory['L-DOUBLE']!.available).toBe(0);
            await svc.cancel(next.confirmationNumber);
            expect((await availability()).total).toEqual(beforeCounters.total);
            expect((await boundaryCounters()).total).toEqual(beforeBoundary.total);
            expect(
              await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate),
            ).toBe(freeBefore);
            throw new Rollback();
          },
          { timeout: 60000 },
        )
        .catch((error: unknown) => {
          if (!(error instanceof Rollback)) throw error;
        });
    },
  );
  it('две одновременные продажи всей категории сохраняют только одну группу', async () => {
    const repo = new PrismaReservationsRepository(db, propertyName);
    const typeId = (await db.inventoryUnit.findFirstOrThrow({ where: { code: unitCode } }))
      .accommodationTypeId;
    let input = payload(randomUUID(), 240);
    let free = await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate);
    for (let offset = 241; free < 2 && offset < 270; offset++) {
      input = payload(randomUUID(), offset);
      free = await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate);
    }
    expect(free).toBeGreaterThan(1);
    const group = {
      ...input,
      items: [
        { accommodationTypeCode: 'L-DOUBLE', ratePlanCode: 'L-BASE', adults: 1, quantity: free },
      ],
    };
    const guests = await db.guest.count();
    const results = await Promise.allSettled([
      service().create(group),
      service().create({ ...group, creationKey: randomUUID() }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await db.guest.count()).toBe(guests + 1);
    expect(await repo.categoryAvailability(typeId, input.arrivalDate, input.departureDate)).toBe(0);
  });
});
