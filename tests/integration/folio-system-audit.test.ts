import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaReservationsRepository } from '../../apps/api/src/reservations/reservations.repository';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;
class Rollback extends Error {}

/**
 * SECURITY.md §6: платёж, возврат и начисление пишутся в журнал. Со стойки — писались; то, что делает система на
 * брони канала — предоплата, её снятие и остаток под штраф, сам штраф — нет (проверка 24.09.2026). Всё в одной
 * транзакции, которая откатывается: тестовая схема остаётся как была.
 */
describe.skipIf(!url)('системные изменения счёта — в журнале (integration, DATABASE_URL required)', () => {
  let db: Db;
  beforeAll(() => {
    db = createPrismaClient(url);
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('штраф, предоплата канала, её остаток под штраф и снятие — строки журнала с суммами до и после', async () => {
    const item = await db.reservationItem.findFirst({
      where: { folio: { isNot: null } },
      select: { id: true, folio: { select: { id: true } } },
    });
    expect(item?.folio).toBeTruthy();
    const folioId = item!.folio!.id;
    const ref = `channex:INTEGRATION-AUDIT-${Date.now().toString(36)}:0`;
    let rows: Array<{ action: string; before: unknown; after: unknown }> = [];

    await expect(
      db.$transaction(async (tx) => {
        const repo = new PrismaReservationsRepository(tx);
        await repo.addPenaltyCharge(item!.id, 10_000n, 'Штраф (integration)');
        await repo.recordChannelPrepayment(item!.id, 50_000n, ref, 'Предоплата канала (integration)');
        // повтор той же ревизии с той же суммой ничего не меняет — строки нет
        await repo.recordChannelPrepayment(item!.id, 50_000n, ref, 'Предоплата канала (integration)');
        await repo.settleChannelPrepaymentAfterCancel(item!.id);
        await repo.voidChannelPrepayment(ref);
        rows = await tx.auditLog.findMany({
          where: { entityType: 'Folio', entityId: folioId },
          select: { action: true, before: true, after: true },
        });
        throw new Rollback();
      }),
    ).rejects.toBeInstanceOf(Rollback);

    const by = (action: string) => rows.filter((r) => r.action === action);
    expect(by('folio.penalty')).toEqual([
      expect.objectContaining({ after: expect.objectContaining({ amountMinor: '10000' }) }),
    ]);
    expect(by('folio.channelPrepayment')).toEqual([
      expect.objectContaining({
        after: { status: 'COMPLETED', amountMinor: '50000', externalReference: ref },
      }),
    ]);
    const reduce = by('folio.channelPrepayment.reduce')[0] ?? by('folio.channelPrepayment.void')[0];
    expect(reduce).toMatchObject({ before: { amountMinor: '50000' } });
    expect(by('folio.channelPrepayment.void').at(-1)).toMatchObject({
      after: { status: 'VOIDED', amountMinor: '0', externalReference: ref },
    });
  });
});
