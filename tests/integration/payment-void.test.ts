import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, type Db } from '@pms/database';
import { PrismaFinanceRepository } from '../../apps/api/src/finance/finance.repository';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

loadEnv({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });
const url = process.env.DATABASE_URL;

/**
 * Аннулирование и замена платежа (план `plans/finance-payments-direct-2026-10-07.md`, ADR-151): правило У3
 * («без возвратов и чека») и смена статуса идут в одной транзакции под блокировкой строки платежа, как предел
 * возврата в `createRefund`. Возврат и аннулирование наперегонки: проходит ровно одно. Запрос оплаты (§24),
 * закрытый платежом, при аннулировании снова ждёт оплаты, при замене переходит на новый платёж.
 * Строки теста свои и удаляются в конце.
 */
describe.skipIf(!url)('аннулирование платежа под блокировкой (integration)', () => {
  let db: Db;
  let repo: PrismaFinanceRepository;
  let folioId = '';
  let propertyId = '';
  let currency = 'KZT';
  const mark = `PAYMENT-VOID-${Date.now().toString(36)}`;
  const created = { payments: [] as string[], requests: [] as string[] };

  async function payment(amount: bigint): Promise<string> {
    const p = await db.payment.create({
      data: {
        propertyId,
        method: 'CASH',
        amount,
        currency,
        note: mark,
        allocations: { create: [{ folioId, amount }] },
      },
      select: { id: true },
    });
    created.payments.push(p.id);
    return p.id;
  }

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
    await db.paymentRequest.deleteMany({ where: { id: { in: created.requests } } });
    await db.refund.deleteMany({ where: { paymentId: { in: created.payments } } });
    await db.paymentAllocation.deleteMany({ where: { paymentId: { in: created.payments } } });
    await db.payment.deleteMany({ where: { OR: [{ id: { in: created.payments } }, { note: mark }] } });
    await db.$disconnect();
  });

  it('аннулированный платёж уходит из распределений счёта; второй раз не аннулируется', async () => {
    const id = await payment(5_000n);
    await repo.voidPayment(id);
    const row = await db.payment.findUniqueOrThrow({ where: { id }, select: { status: true } });
    expect(row.status).toBe('VOIDED');
    await expect(repo.voidPayment(id)).rejects.toThrow(/уже аннулирован/);
    // счёт не видит аннулированного платежа в оплаченном: как folioView API
    const folio = (await repo.folioById(folioId))!;
    const live = folio.allocations.filter(
      (a) => a.paymentId === id && a.payment.status === 'COMPLETED',
    );
    expect(live).toHaveLength(0);
  });

  it('возврат и аннулирование наперегонки: проходит ровно одно', async () => {
    const id = await payment(10_000n);
    const results = await Promise.allSettled([
      repo.createRefund({ paymentId: id, folioId, amountMinor: 10_000n, reason: mark }),
      repo.voidPayment(id),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    const row = await db.payment.findUniqueOrThrow({ where: { id }, select: { status: true } });
    const refunded = await db.refund.aggregate({ where: { paymentId: id }, _sum: { amount: true } });
    // либо платёж аннулирован и возвратов нет, либо возврат прошёл и платёж остался проведённым
    expect(
      (row.status === 'VOIDED' && (refunded._sum.amount ?? 0n) === 0n) ||
        (row.status === 'COMPLETED' && refunded._sum.amount === 10_000n),
    ).toBe(true);
  });

  it('платёж с возвратом не аннулируется и не заменяется: отказ из транзакции словами', async () => {
    const id = await payment(4_000n);
    await repo.createRefund({ paymentId: id, folioId, amountMinor: 1_000n, reason: mark });
    await expect(repo.voidPayment(id)).rejects.toThrow(/возврат/);
    await expect(
      repo.replacePayment(id, {
        method: 'KASPI',
        amountMinor: 3_000n,
        currency,
        paidAt: null,
        note: mark,
        allocations: [{ folioId, amountMinor: 3_000n }],
      }),
    ).rejects.toThrow(/возврат/);
    const row = await db.payment.findUniqueOrThrow({ where: { id }, select: { status: true } });
    expect(row.status).toBe('COMPLETED');
  });

  it('запрос оплаты: аннулирование возвращает его в ожидание, замена переводит на новый платёж', async () => {
    const first = await payment(2_000n);
    const request = await db.paymentRequest.create({
      data: {
        propertyId,
        folioId,
        amount: 2_000n,
        currency,
        method: 'KASPI',
        status: 'PAID',
        paymentId: first,
        closedAt: new Date(),
        note: mark,
      },
      select: { id: true },
    });
    created.requests.push(request.id);

    await repo.voidPayment(first);
    const reopened = await db.paymentRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { status: true, paymentId: true, closedAt: true },
    });
    expect(reopened).toEqual({ status: 'PENDING', paymentId: null, closedAt: null });

    const second = await payment(2_000n);
    await db.paymentRequest.update({
      where: { id: request.id },
      data: { status: 'PAID', paymentId: second, closedAt: new Date() },
    });
    const replacement = await repo.replacePayment(second, {
      method: 'HALYK',
      amountMinor: 2_500n,
      currency,
      paidAt: null,
      note: mark,
      allocations: [{ folioId, amountMinor: 2_500n }],
    });
    created.payments.push(replacement);
    const moved = await db.paymentRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { status: true, paymentId: true },
    });
    expect(moved).toEqual({ status: 'PAID', paymentId: replacement });
    const old = await db.payment.findUniqueOrThrow({ where: { id: second }, select: { status: true } });
    expect(old.status).toBe('VOIDED');
    const fresh = await db.payment.findUniqueOrThrow({
      where: { id: replacement },
      select: { status: true, method: true, amount: true },
    });
    expect(fresh).toEqual({ status: 'COMPLETED', method: 'HALYK', amount: 2_500n });
  });
});
