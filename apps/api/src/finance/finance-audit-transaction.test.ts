import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PrismaFinanceRepository } from './finance.repository';
import type { PrismaService } from '../database/prisma.provider';

/**
 * Деньги и строка журнала пишутся одной транзакцией (хвост Б6 плана wetop-domain).
 *
 * Было: платёж, возврат, начисление, сторно и закрытие счёта писались одним запросом, а журнал — вторым,
 * уже после. Обрыв связи между ними (на этой машине пул рвался не раз) оставлял деньги в базе без следа:
 * смена не видит, кто и когда провёл платёж, а разбор расхождения упирается в пустоту. Правила денег при
 * этом не меняются — только атомарность записи.
 *
 * База здесь не нужна: подделка Prisma проверяет, что обе записи идут внутри одного `$transaction` и что
 * отказ журнала не проглатывается. Настоящий откат обеспечивает Postgres.
 */
interface Call {
  table: string;
  on: 'tx' | 'db';
}

function fakePrisma(opts: { auditThrows?: boolean } = {}) {
  const calls: Call[] = [];
  let transactions = 0;
  const tables = (on: 'tx' | 'db') => ({
    payment: {
      create: async () => {
        calls.push({ table: 'payment', on });
        return { id: 'pay-1' };
      },
    },
    charge: {
      create: async () => {
        calls.push({ table: 'charge', on });
        return { id: 'chg-1' };
      },
      update: async () => {
        calls.push({ table: 'charge.update', on });
        return {};
      },
    },
    refund: {
      create: async () => {
        calls.push({ table: 'refund', on });
        return { id: 'ref-1' };
      },
    },
    folio: {
      update: async () => {
        calls.push({ table: 'folio.update', on });
        return {};
      },
    },
    auditLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push({ table: 'auditLog', on });
        if (opts.auditThrows) throw new Error('журнал недоступен');
        return args.data;
      },
    },
    property: { findFirstOrThrow: async () => ({ id: 'prop-1' }) },
  });
  const tx = tables('tx');
  const db = {
    ...tables('db'),
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
      transactions += 1;
      return fn(tx);
    },
  };
  return {
    prisma: { db } as unknown as PrismaService,
    calls,
    get transactions() {
      return transactions;
    },
  };
}

const PAYMENT = {
  method: 'CASH' as const,
  amountMinor: 1_000n,
  currency: 'KZT',
  paidAt: null,
  note: null,
  allocations: [{ folioId: 'f-1', amountMinor: 1_000n }],
};
const AUDIT = { entityType: 'Payment', action: 'finance.payment', after: { amountMinor: '1000' } };

describe('деньги и журнал — одной транзакцией', () => {
  it('платёж: обе записи внутри одного $transaction, id платежа попадает в строку журнала', async () => {
    const f = fakePrisma();
    const repo = new PrismaFinanceRepository(f.prisma);
    const id = await repo.createPayment(PAYMENT, AUDIT);
    expect(id).toBe('pay-1');
    expect(f.transactions).toBe(1);
    expect(f.calls.filter((c) => c.table !== 'property')).toEqual([
      { table: 'payment', on: 'tx' },
      { table: 'auditLog', on: 'tx' },
    ]);
  });

  it('журнал не записался — вся операция отклонена, а не «деньги без следа»', async () => {
    const f = fakePrisma({ auditThrows: true });
    const repo = new PrismaFinanceRepository(f.prisma);
    await expect(repo.createPayment(PAYMENT, AUDIT)).rejects.toThrow('журнал недоступен');
  });

  it('возврат, начисление, сторно и закрытие счёта — так же одной транзакцией', async () => {
    const refund = fakePrisma();
    await new PrismaFinanceRepository(refund.prisma).createRefund(
      { paymentId: 'pay-1', folioId: 'f-1', amountMinor: 500n, reason: null },
      { entityType: 'Payment', entityId: 'pay-1', action: 'finance.refund', after: {} },
    );
    expect(refund.calls).toEqual([
      { table: 'refund', on: 'tx' },
      { table: 'auditLog', on: 'tx' },
    ]);

    const charge = fakePrisma();
    await new PrismaFinanceRepository(charge.prisma).addCharge(
      'f-1',
      {
        kind: 'SERVICE',
        serviceId: null,
        description: 'Услуга',
        quantity: 1,
        unitPriceMinor: 100n,
        amountMinor: 100n,
        serviceDate: '2026-09-20',
      },
      { entityType: 'Folio', entityId: 'f-1', action: 'finance.charge', after: {} },
    );
    expect(charge.calls).toEqual([
      { table: 'charge', on: 'tx' },
      { table: 'auditLog', on: 'tx' },
    ]);

    const voided = fakePrisma();
    await new PrismaFinanceRepository(voided.prisma).voidCharge('chg-1', {
      entityType: 'Folio',
      entityId: 'f-1',
      action: 'finance.charge.void',
      after: {},
    });
    expect(voided.calls).toEqual([
      { table: 'charge.update', on: 'tx' },
      { table: 'auditLog', on: 'tx' },
    ]);

    const closed = fakePrisma();
    await new PrismaFinanceRepository(closed.prisma).closeFolio('f-1', {
      entityType: 'Folio',
      entityId: 'f-1',
      action: 'finance.folio.close',
      after: {},
    });
    expect(closed.calls).toEqual([
      { table: 'folio.update', on: 'tx' },
      { table: 'auditLog', on: 'tx' },
    ]);
  });

  it('без данных журнала методы работают как прежде — одним запросом, без транзакции', async () => {
    const f = fakePrisma();
    await new PrismaFinanceRepository(f.prisma).closeFolio('f-1');
    expect(f.transactions).toBe(0);
    expect(f.calls).toEqual([{ table: 'folio.update', on: 'db' }]);
  });
});
