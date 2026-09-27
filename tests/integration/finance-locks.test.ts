import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Аудит 25.09 С-2 и 26.09 С-25: проверки денег шли до транзакции записи. Два одновременных возврата читали одну и ту же
 * сумму возвращённого и оба проходили — возвращали больше, чем платёж внёс; закрытие считало баланс вне транзакции, и
 * начисление успевало лечь в закрытый счёт. Теперь репозиторий держит правило сам, под блокировкой строки.
 * Строки теста свои и удаляются в конце; состояние счёта возвращается.
 */
describe.skipIf(!url)('деньги под блокировкой (integration, DATABASE_URL required)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let folioId = '';
  let propertyId = '';
  let currency = 'KZT';
  const created: { payments: string[] } = { payments: [] };

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const folio = await db.folio.findFirst({
      where: { status: 'OPEN' },
      select: {
        id: true,
        currency: true,
        reservationItem: { select: { reservation: { select: { propertyId: true } } } },
      },
    });
    expect(folio, 'в тестовой базе нужен открытый счёт').toBeTruthy();
    folioId = folio!.id;
    currency = folio!.currency;
    propertyId = folio!.reservationItem.reservation.propertyId;
  });

  afterAll(async () => {
    if (!db) return;
    await db.refund.deleteMany({ where: { paymentId: { in: created.payments } } });
    await db.paymentAllocation.deleteMany({ where: { paymentId: { in: created.payments } } });
    await db.payment.deleteMany({ where: { id: { in: created.payments } } });
    await db.charge.deleteMany({ where: { folioId, description: 'integration: блокировка' } });
    await db.folio.update({ where: { id: folioId }, data: { status: 'OPEN', closedAt: null } });
    await db.$disconnect();
  });

  it('два одновременных возврата на всю сумму: проходит один, возвращено не больше внесённого', async () => {
    const payment = await db.payment.create({
      data: {
        propertyId,
        method: 'CASH',
        amount: 1_000n,
        currency,
        allocations: { create: [{ folioId, amount: 1_000n }] },
      },
      select: { id: true },
    });
    created.payments.push(payment.id);
    const refund = () =>
      repo.createRefund(
        { paymentId: payment.id, folioId, amountMinor: 1_000n, reason: null },
        {
          entityType: 'Payment',
          entityId: payment.id,
          action: 'integration.refund',
          idField: 'refundId',
          after: {},
        },
      );
    const results = await Promise.allSettled([refund(), refund()]);
    const refunded = await db.refund.aggregate({
      where: { paymentId: payment.id },
      _sum: { amount: true },
    });
    expect(refunded._sum.amount ?? 0n).toBe(1_000n);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('закрыть счёт с ненулевым балансом репозиторий не даёт, в закрытый счёт начисление не ложится', async () => {
    await db.charge.create({
      data: {
        folioId,
        kind: 'ADJUSTMENT',
        description: 'integration: блокировка',
        quantity: 1,
        unitPrice: 777n,
        amount: 777n,
      },
    });
    await expect(repo.closeFolio(folioId)).rejects.toThrow();
    expect((await db.folio.findUniqueOrThrow({ where: { id: folioId } })).status).toBe('OPEN');

    await db.folio.update({
      where: { id: folioId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    await expect(
      repo.addCharge(folioId, {
        kind: 'ADJUSTMENT',
        serviceId: null,
        description: 'integration: блокировка',
        quantity: 1,
        unitPriceMinor: 1n,
        amountMinor: 1n,
        serviceDate: '2026-09-26',
      }),
    ).rejects.toThrow();
    await db.folio.update({ where: { id: folioId }, data: { status: 'OPEN', closedAt: null } });
  });

  // Проверка исправлений 26.09: «уже сторнировано» сервис проверял до транзакции, и два одновременных сторно проходили
  // оба — вторая запись журнала и повторное снятие блока доплаты. Теперь повтор отклоняется под блокировкой счёта.
  it('два одновременных сторно одного начисления: проходит одно', async () => {
    const charge = await db.charge.create({
      data: {
        folioId,
        kind: 'ADJUSTMENT',
        description: 'integration: блокировка',
        quantity: 1,
        unitPrice: 5n,
        amount: 5n,
      },
      select: { id: true },
    });
    const results = await Promise.allSettled([repo.voidCharge(charge.id), repo.voidCharge(charge.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});

