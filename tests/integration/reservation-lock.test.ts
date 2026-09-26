import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Аудит 26.09, С-15: команды брони (отмена, незаезд, заселение, выезд, смена дат…) читали её статус без блокировки, и
 * две одновременные отмены начисляли штраф дважды. Здесь — что замок брони на настоящей базе держит вторую транзакцию,
 * пока первая не закончится. Ничего не пишется: замок — advisory, строк не трогает.
 */
describe.skipIf(!url)('замок брони (integration, DATABASE_URL required)', () => {
  let db: Db;
  let number = '';
  beforeAll(async () => {
    db = createPrismaClient(url);
    const r = await db.reservation.findFirst({ select: { confirmationNumber: true } });
    expect(r, 'в тестовой базе нужна бронь').toBeTruthy();
    number = r!.confirmationNumber;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('вторая транзакция по той же брони ждёт первую', async () => {
    const order: string[] = [];
    const first = db.$transaction(async (tx) => {
      await new PrismaReservationsRepository(tx).lockReservation(number);
      order.push('первая взяла');
      await new Promise((ok) => setTimeout(ok, 400));
      order.push('первая закончила');
    });
    await new Promise((ok) => setTimeout(ok, 100));
    const second = db.$transaction(async (tx) => {
      await new PrismaReservationsRepository(tx).lockReservation(number);
      order.push('вторая взяла');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['первая взяла', 'первая закончила', 'вторая взяла']);
  });
});
