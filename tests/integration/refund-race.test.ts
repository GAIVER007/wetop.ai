import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * С-2 из ТЗ аудита 25.09.2026 (`plans/security-audit-fixes-2026-09-25.md`, блок 4): предел возврата
 * («не больше, чем платёж внёс на счёт, минус уже возвращённое») проверялся в сервисе ДО транзакции —
 * два одновременных возврата читали одну и ту же сумму «уже возвращено» и оба проходили. Теперь предел
 * держит репозиторий: замок платежа (`pg_advisory_xact_lock`) и перепроверка в той же транзакции,
 * что и вставка возврата.
 */
describe.skipIf(!url)('возврат платежа: предел держит транзакция, а не только код до неё (integration)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let folioId: string;
  const mark = `REFUND-RACE-${Date.now().toString(36)}`;

  async function paymentWithAllocation(amount: bigint): Promise<string> {
    const folio = await db.folio.findFirstOrThrow({ select: { id: true } });
    folioId = folio.id;
    const p = await db.payment.create({
      data: {
        propertyId: (await db.property.findFirstOrThrow({ select: { id: true } })).id,
        method: 'CASH',
        amount,
        currency: 'KZT',
        note: mark,
        allocations: { create: [{ folioId: folio.id, amount }] },
      },
      select: { id: true },
    });
    return p.id;
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as PrismaService);
  });
  afterAll(async () => {
    if (!db) return;
    await db.$executeRawUnsafe(
      `DELETE FROM refunds WHERE payment_id IN (SELECT id FROM payments WHERE note = '${mark}')`,
    );
    await db.$executeRawUnsafe(`DELETE FROM payment_allocations
       WHERE payment_id IN (SELECT id FROM payments WHERE note = '${mark}')`);
    await db.$executeRawUnsafe(`DELETE FROM payments WHERE note = '${mark}'`);
    await db.$disconnect();
  });

  it('второй возврат сверх внесённого отвергается самим репозиторием, без проверки в сервисе', async () => {
    const paymentId = await paymentWithAllocation(10_000n);
    await repo.createRefund({ paymentId, folioId, amountMinor: 6_000n, reason: mark });
    await expect(
      repo.createRefund({ paymentId, folioId, amountMinor: 6_000n, reason: mark }),
    ).rejects.toThrow(/не больше/);
    const sum = await db.refund.aggregate({ where: { paymentId }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(6_000n);
  });

  it('два одновременных возврата на всю сумму: проходит ровно один', async () => {
    const paymentId = await paymentWithAllocation(10_000n);
    const attempt = () =>
      repo.createRefund({ paymentId, folioId, amountMinor: 10_000n, reason: mark });
    const results = await Promise.allSettled([attempt(), attempt()]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(String((failed[0] as PromiseRejectedResult).reason)).toMatch(/не больше/);
    const sum = await db.refund.aggregate({ where: { paymentId }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(10_000n);
  });

  it('возврат по счёту, на который платёж не распределялся, отвергается в транзакции', async () => {
    const paymentId = await paymentWithAllocation(10_000n);
    const otherFolio = await db.folio.findFirstOrThrow({
      where: { id: { not: folioId } },
      select: { id: true },
    });
    await expect(
      repo.createRefund({
        paymentId,
        folioId: otherFolio.id,
        amountMinor: 1_000n,
        reason: mark,
      }),
    ).rejects.toThrow(/не распределялся/);
  });
});
