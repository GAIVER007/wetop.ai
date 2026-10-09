/**
 * Деньги за период (RPT2.4a, ADR-155, `docs/metrics.md` §2): поступления, возвраты, расходы и денежный поток раздельно,
 * по дням и за период. Источник один, общая лента денег (`GET /finance/operations`): оплаты и возвраты броней и операции
 * кассы. Аннулированное не считается, переводы между кассами в потоке не участвуют. Деньги целыми минорными единицами,
 * наружу строками (ADR-008). Начисления, долг и прибыль сюда не входят.
 */
import { dateRange } from '../chessboard/build';
import { NON_CASH_METHODS } from './cash';

export type CashFlowKind = 'PAYMENT' | 'REFUND' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

/** Строка ленты: `localAt` — «YYYY-MM-DD HH:mm» по часам объекта, как отдаёт `OperationView` */
export interface CashFlowRow {
  kind: CashFlowKind;
  localAt: string;
  method: string;
  amountMinor: bigint;
  status: 'COMPLETED' | 'VOIDED';
  /** статья кассы словом; у денег броней null */
  category: string | null;
}

export interface CashFlowDay {
  date: string;
  /** Проведённые оплаты всеми способами */
  receiptsMinor: string;
  /** из них в кассе (живые способы) и вне кассы (площадка, депозит, гарантия картой) */
  receiptsCashMinor: string;
  receiptsOffCashMinor: string;
  refundsMinor: string;
  refundsCashMinor: string;
  /** Поступления минус возвраты по всем способам */
  netReceiptsMinor: string;
  /** Приход кассы мимо броней */
  incomeMinor: string;
  expenseMinor: string;
  /** По кассе: оплаты в кассу − возвраты из кассы + приход − расходы */
  cashFlowMinor: string;
}

export interface CashFlow {
  from: string;
  to: string;
  days: CashFlowDay[];
  totals: Omit<CashFlowDay, 'date'>;
  expensesByCategory: Array<{ category: string; amountMinor: string }>;
}

const NO_CATEGORY = 'Без статьи';
const offCash = (method: string) => (NON_CASH_METHODS as readonly string[]).includes(method);

interface Acc {
  receipts: bigint;
  receiptsCash: bigint;
  refunds: bigint;
  refundsCash: bigint;
  income: bigint;
  expense: bigint;
}
const zero = (): Acc => ({
  receipts: 0n,
  receiptsCash: 0n,
  refunds: 0n,
  refundsCash: 0n,
  income: 0n,
  expense: 0n,
});

function view(a: Acc): Omit<CashFlowDay, 'date'> {
  return {
    receiptsMinor: a.receipts.toString(),
    receiptsCashMinor: a.receiptsCash.toString(),
    receiptsOffCashMinor: (a.receipts - a.receiptsCash).toString(),
    refundsMinor: a.refunds.toString(),
    refundsCashMinor: a.refundsCash.toString(),
    netReceiptsMinor: (a.receipts - a.refunds).toString(),
    incomeMinor: a.income.toString(),
    expenseMinor: a.expense.toString(),
    cashFlowMinor: (a.receiptsCash - a.refundsCash + a.income - a.expense).toString(),
  };
}

export function buildCashFlow(rows: CashFlowRow[], from: string, to: string): CashFlow {
  const dates = dateRange(from, to);
  const byDay = new Map(dates.map((d) => [d, zero()]));
  const total = zero();
  const categories = new Map<string, bigint>();
  for (const r of rows) {
    if (r.status !== 'COMPLETED' || r.kind === 'TRANSFER') continue;
    const day = byDay.get(r.localAt.slice(0, 10));
    if (!day) continue;
    for (const a of [day, total]) {
      if (r.kind === 'PAYMENT') {
        a.receipts += r.amountMinor;
        if (!offCash(r.method)) a.receiptsCash += r.amountMinor;
      } else if (r.kind === 'REFUND') {
        a.refunds += r.amountMinor;
        if (!offCash(r.method)) a.refundsCash += r.amountMinor;
      } else if (r.kind === 'INCOME') a.income += r.amountMinor;
      else a.expense += r.amountMinor;
    }
    if (r.kind === 'EXPENSE') {
      const key = r.category?.trim() || NO_CATEGORY;
      categories.set(key, (categories.get(key) ?? 0n) + r.amountMinor);
    }
  }
  return {
    from,
    to,
    days: dates.map((date) => ({ date, ...view(byDay.get(date)!) })),
    totals: view(total),
    expensesByCategory: [...categories]
      .sort((a, b) => (a[1] === b[1] ? a[0].localeCompare(b[0], 'ru') : a[1] > b[1] ? -1 : 1))
      .map(([category, amount]) => ({ category, amountMinor: amount.toString() })),
  };
}
