import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Проверка исправлений 26.09 (к С-25): выезд читал долг по счёту без блокировки и закрывал счёт при нуле. Начисление со
 * стойки, записанное между чтением и закрытием, оставалось в закрытом счёте, и принять по нему деньги было уже нельзя.
 * Теперь выезд читает долг под той же блокировкой строки счёта, что берут начисления и платежи: чтение ждёт начисление
 * в полёте и видит его. Своя строка начисления удаляется в конце.
 */
describe.skipIf(!url)('долг при выезде — под блокировкой счёта (integration, DATABASE_URL required)', () => {
  let db: Db;
  let folioId = '';
  let itemId = '';
  const DESCRIPTION = 'integration: выезд под блокировкой';

  beforeAll(async () => {
    db = createPrismaClient(url);
    const folio = await db.folio.findFirst({
      where: { status: 'OPEN' },
      select: { id: true, reservationItemId: true },
    });
    expect(folio, 'в тестовой базе нужен открытый счёт').toBeTruthy();
    folioId = folio!.id;
    itemId = folio!.reservationItemId;
  });

  afterAll(async () => {
    if (!db) return;
    await db.charge.deleteMany({ where: { folioId, description: DESCRIPTION } });
    await db.$disconnect();
  });

  it('чтение долга для выезда ждёт начисление, которое пишется сейчас, и видит его', async () => {
    const base = await new PrismaReservationsRepository(db).stayBalanceMinor(itemId);
    const charge = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "folios" WHERE "id" = ${folioId}::uuid FOR UPDATE`;
      await tx.charge.create({
        data: {
          folioId,
          kind: 'SERVICE',
          description: DESCRIPTION,
          quantity: 1,
          unitPrice: 777n,
          amount: 777n,
          serviceDate: new Date('2026-09-26T00:00:00Z'),
        },
      });
      await new Promise((ok) => setTimeout(ok, 400));
    });
    await new Promise((ok) => setTimeout(ok, 100));
    const seen = await db.$transaction((tx) =>
      new PrismaReservationsRepository(tx).stayBalanceMinor(itemId, { forUpdate: true }),
    );
    await charge;
    expect(seen).toBe(base + 777n);
  });
});
