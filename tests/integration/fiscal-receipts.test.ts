import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Фискальный чек по запросу гостя (DATA_MODEL §25, ADR-143) на настоящей схеме: отметка ложится у проведённого платежа и
 * видна в счёте брони; две одновременные отметки дают одну строку; аннулированный платёж чек не получает; CHECK базы
 * не пускает пустой номер. Строки теста удаляются в конце.
 */
describe.skipIf(!url)('фискальные чеки (integration, DATA_MODEL §25)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let folioId = '';
  let propertyId = '';
  let currency = 'KZT';
  let confirmationNumber = '';
  const created: string[] = [];
  const audit = { entityType: 'Payment', action: 'integration.receipt.issued', after: {} };

  async function payment(status: 'COMPLETED' | 'VOIDED' = 'COMPLETED') {
    const p = await db.payment.create({
      data: {
        propertyId,
        method: 'CASH',
        amount: 500_000n,
        currency,
        status,
        note: 'integration: чек',
        allocations: { create: [{ folioId, amount: 500_000n }] },
      },
      select: { id: true },
    });
    created.push(p.id);
    return p.id;
  }

  async function cleanup() {
    await db.fiscalReceipt.deleteMany({ where: { paymentId: { in: created } } });
    await db.paymentAllocation.deleteMany({ where: { paymentId: { in: created } } });
    await db.payment.deleteMany({ where: { id: { in: created } } });
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaFinanceRepository({ db } as unknown as PrismaService);
    const folio = await db.folio.findFirst({
      where: { status: 'OPEN' },
      select: {
        id: true,
        currency: true,
        reservationItem: {
          select: { reservation: { select: { propertyId: true, confirmationNumber: true } } },
        },
      },
    });
    expect(folio, 'в тестовой базе нужен открытый счёт').toBeTruthy();
    folioId = folio!.id;
    currency = folio!.currency.trim();
    propertyId = folio!.reservationItem.reservation.propertyId;
    confirmationNumber = folio!.reservationItem.reservation.confirmationNumber;
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('две одновременные отметки — одна строка, номер виден у платежа в счёте брони', async () => {
    const id = await payment();
    const results = await Promise.allSettled([
      repo.issueReceipt(id, 'ФП 000123', audit),
      repo.issueReceipt(id, 'ФП 000124', audit),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await db.fiscalReceipt.count({ where: { paymentId: id } })).toBe(1);
    const folios = await repo.foliosByReservation(confirmationNumber);
    const line = folios!.flatMap((f) => f.allocations).find((a) => a.paymentId === id)!;
    expect(line.payment.receipt?.number).toMatch(/^ФП 00012[34]$/);
    const log = await db.auditLog.findFirst({
      where: { entityId: id, action: 'integration.receipt.issued' },
    });
    expect(log).toBeTruthy();
    await db.auditLog
      .deleteMany({ where: { entityId: id, action: 'integration.receipt.issued' } })
      .catch(() => {});
  });

  it('аннулированный платёж чек не получает', async () => {
    const id = await payment('VOIDED');
    await expect(repo.issueReceipt(id, '42', audit)).rejects.toThrow('аннулирован');
  });

  it('база не пускает пустой номер', async () => {
    const id = await payment();
    await expect(
      db.fiscalReceipt.create({ data: { propertyId, paymentId: id, number: '   ' } }),
    ).rejects.toThrow();
  });
});
