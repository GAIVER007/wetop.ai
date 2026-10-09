import { describe, expect, it } from 'vitest';
import { buildCashFlow, type CashFlowRow } from './cashflow';

const row = (over: Partial<CashFlowRow>): CashFlowRow => ({
  kind: 'PAYMENT',
  localAt: '2026-10-05 12:00',
  method: 'CASH',
  amountMinor: 100_000n,
  status: 'COMPLETED',
  category: null,
  ...over,
});

/** Деньги за период (ADR-155, `docs/metrics.md` §2): поступления, возвраты, расходы и денежный поток раздельно */
describe('buildCashFlow', () => {
  it('поступления делятся на «в кассе» и «вне кассы», возвраты вычитаются отдельно', () => {
    const f = buildCashFlow(
      [
        row({ amountMinor: 500_000n }),
        row({ method: 'KASPI', amountMinor: 300_000n }),
        row({ method: 'EXTERNAL', amountMinor: 200_000n }),
        row({ kind: 'REFUND', method: 'CASH', amountMinor: 50_000n }),
        row({ kind: 'REFUND', method: 'DEPOSIT', amountMinor: 20_000n }),
      ],
      '2026-10-05',
      '2026-10-05',
    );
    expect(f.totals).toMatchObject({
      receiptsMinor: '1000000',
      receiptsCashMinor: '800000',
      receiptsOffCashMinor: '200000',
      refundsMinor: '70000',
      refundsCashMinor: '50000',
      netReceiptsMinor: '930000',
    });
  });

  it('аннулированное не считается, переводы между кассами в потоке не участвуют', () => {
    const f = buildCashFlow(
      [
        row({ status: 'VOIDED', amountMinor: 999n }),
        row({ kind: 'TRANSFER', amountMinor: 700_000n }),
        row({ kind: 'EXPENSE', status: 'VOIDED', amountMinor: 123n }),
      ],
      '2026-10-05',
      '2026-10-05',
    );
    expect(f.totals.receiptsMinor).toBe('0');
    expect(f.totals.expenseMinor).toBe('0');
    expect(f.totals.cashFlowMinor).toBe('0');
  });

  it('денежный поток = поступления в кассу − возвраты из кассы + приход кассы − расходы', () => {
    const f = buildCashFlow(
      [
        row({ amountMinor: 1_000_000n }),
        row({ method: 'EXTERNAL', amountMinor: 400_000n }),
        row({ kind: 'REFUND', amountMinor: 100_000n }),
        row({ kind: 'INCOME', amountMinor: 50_000n, category: 'Прочее' }),
        row({ kind: 'EXPENSE', amountMinor: 300_000n, category: 'Хозяйственные' }),
      ],
      '2026-10-05',
      '2026-10-05',
    );
    expect(f.totals.cashFlowMinor).toBe('650000'); // 1 000 000 − 100 000 + 50 000 − 300 000
    expect(f.totals.incomeMinor).toBe('50000');
    expect(f.totals.expenseMinor).toBe('300000');
  });

  it('расходы по статьям по убыванию; без статьи — отдельной строкой', () => {
    const f = buildCashFlow(
      [
        row({ kind: 'EXPENSE', amountMinor: 100n, category: 'Зарплата' }),
        row({ kind: 'EXPENSE', amountMinor: 300n, category: 'Хозяйственные' }),
        row({ kind: 'EXPENSE', amountMinor: 50n, category: 'Зарплата' }),
        row({ kind: 'EXPENSE', amountMinor: 20n, category: null }),
      ],
      '2026-10-05',
      '2026-10-05',
    );
    expect(f.expensesByCategory).toEqual([
      { category: 'Хозяйственные', amountMinor: '300' },
      { category: 'Зарплата', amountMinor: '150' },
      { category: 'Без статьи', amountMinor: '20' },
    ]);
  });

  it('каждый день периода присутствует, строки вне периода не попадают, сумма дней равна итогу', () => {
    const f = buildCashFlow(
      [
        row({ localAt: '2026-10-04 23:59', amountMinor: 1n }),
        row({ localAt: '2026-10-05 00:00', amountMinor: 10n }),
        row({ localAt: '2026-10-07 23:59', amountMinor: 100n }),
        row({ localAt: '2026-10-08 00:00', amountMinor: 1000n }),
      ],
      '2026-10-05',
      '2026-10-07',
    );
    expect(f.days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect(f.days.map((d) => d.receiptsMinor)).toEqual(['10', '0', '100']);
    const sum = f.days.reduce((n, d) => n + BigInt(d.receiptsMinor), 0n);
    expect(sum.toString()).toBe(f.totals.receiptsMinor);
  });

  it('деньги целыми числами: суммы выше 2^53 не теряют тиыны', () => {
    const f = buildCashFlow(
      [row({ amountMinor: 9_007_199_254_740_993n }), row({ amountMinor: 2n })],
      '2026-10-05',
      '2026-10-05',
    );
    expect(f.totals.receiptsMinor).toBe('9007199254740995');
  });

  it('пустой период: нули, дни есть', () => {
    const f = buildCashFlow([], '2026-10-05', '2026-10-06');
    expect(f.days).toHaveLength(2);
    expect(f.totals.cashFlowMinor).toBe('0');
    expect(f.expensesByCategory).toEqual([]);
  });
});
