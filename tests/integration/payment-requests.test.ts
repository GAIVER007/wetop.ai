import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaPaymentRequestsRepository } from '../../apps/api/src/finance/payment-requests.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Запросы оплаты (DATA_MODEL §23, ADR-143) на настоящей схеме: «Оплачено» создаёт обычный платёж и закрывает запрос
 * одной транзакцией; два одновременных нажатия дают один платёж; отменённый не оплачивается, оплаченный не
 * отменяется; CHECK базы держит способ, ссылку и связку «оплачен ⇔ есть платёж». Строки теста удаляются в конце.
 */
describe.skipIf(!url)('запросы оплаты (integration, DATA_MODEL §23)', () => {
  let db: Db;
  let repo: PrismaPaymentRequestsRepository;
  let folioId = '';
  let propertyId = '';
  let currency = 'KZT';
  let confirmationNumber = '';
  const audit = (action: string) => ({ entityType: 'PaymentRequest', action, after: {} });

  async function cleanup() {
    const reqs = await db.paymentRequest.findMany({ where: { folioId }, select: { paymentId: true } });
    const payments = reqs.flatMap((r) => (r.paymentId ? [r.paymentId] : []));
    await db.paymentRequest.deleteMany({ where: { folioId } });
    await db.paymentAllocation.deleteMany({ where: { paymentId: { in: payments } } });
    await db.payment.deleteMany({ where: { id: { in: payments } } });
  }

  beforeAll(async () => {
    db = createPrismaClient(url);
    repo = new PrismaPaymentRequestsRepository({ db } as unknown as PrismaService);
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
    await cleanup();
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('создан, виден у брони; два одновременных «Оплачено» — один платёж на сумму запроса', async () => {
    const id = await repo.create(
      { folioId, amountMinor: 1_200_000n, currency, method: 'KASPI', link: null, note: null },
      audit('integration.payment_request.created'),
    );
    const list = await repo.byReservation(confirmationNumber);
    expect(list?.map((r) => r.id)).toContain(id);
    const results = await Promise.allSettled([
      repo.markPaid(id, null, audit('integration.payment_request.paid')),
      repo.markPaid(id, null, audit('integration.payment_request.paid')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await db.paymentRequest.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('PAID');
    expect(row.closedAt).not.toBeNull();
    const payment = await db.payment.findUniqueOrThrow({
      where: { id: row.paymentId! },
      include: { allocations: true },
    });
    expect(payment).toMatchObject({ method: 'KASPI', amount: 1_200_000n, propertyId });
    expect(payment.allocations).toEqual([
      expect.objectContaining({ folioId, amount: 1_200_000n }),
    ]);
    await expect(repo.cancel(id, audit('integration.payment_request.cancelled'))).rejects.toThrow(
      /возвратом/,
    );
    const journal = await db.auditLog.count({
      where: { entityId: id, action: 'integration.payment_request.paid' },
    });
    expect(journal).toBe(1);
  });

  it('отменённый не оплачивается: платежа нет', async () => {
    const id = await repo.create(
      { folioId, amountMinor: 500n, currency, method: 'HALYK', link: 'https://epay.example/p/1', note: null },
      audit('integration.payment_request.created'),
    );
    await repo.cancel(id, audit('integration.payment_request.cancelled'));
    await expect(repo.markPaid(id, null, audit('integration.payment_request.paid'))).rejects.toThrow(
      /отменён/,
    );
    const row = await db.paymentRequest.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'CANCELLED', paymentId: null });
  });

  it('CHECK базы: наличные, ссылка не https, «оплачен» без платежа — отказ', async () => {
    const base = { propertyId, folioId, amount: 100n, currency, method: 'KASPI' as const };
    await expect(db.paymentRequest.create({ data: { ...base, method: 'CASH' } })).rejects.toThrow();
    await expect(
      db.paymentRequest.create({ data: { ...base, link: 'http://bank.example' } }),
    ).rejects.toThrow();
    await expect(
      db.paymentRequest.create({ data: { ...base, status: 'PAID', closedAt: new Date() } }),
    ).rejects.toThrow();
    await expect(db.paymentRequest.create({ data: { ...base, amount: 0n } })).rejects.toThrow();
  });
});
