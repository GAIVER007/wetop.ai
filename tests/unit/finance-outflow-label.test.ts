import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PeriodOperations } from '../../apps/web/src/lib/api';
import { dailyFlow, FinanceDynamics, FinanceTotals } from '../../apps/web/src/app/finance/finance-board';
import { formatMoney } from '../../apps/web/src/lib/money';

type Row = PeriodOperations['rows'][number];
const row = (kind: Row['kind'], amountMinor: string, extra: Partial<Row> = {}): Row => ({
  kind,
  id: `synthetic-${kind}`,
  at: '2030-04-07T07:00:00Z',
  localAt: '2030-04-07T12:00:00',
  method: 'CASH',
  methodTo: null,
  amountMinor,
  status: 'COMPLETED',
  confirmationNumber: null,
  reservations: 0,
  guestLabel: null,
  category: null,
  note: null,
  ...extra,
});
const from = '2030-04-07';
const to = '2030-04-08';
const returnedPayment = [row('PAYMENT', '730000'), row('REFUND', '730000')];

describe('finance presentation: refunds are not operating expenses', () => {
  it('labels combined cash outflow explicitly without changing its amount', () => {
    const flow = dailyFlow(returnedPayment, from, to);
    expect(flow[0]).toMatchObject({ income: 730000n, expense: 730000n });
    const html = renderToStaticMarkup(createElement(FinanceDynamics, { flow, currency: 'KZT' }));
    expect(html).toContain('Возвраты и расходы');
    expect(html).toContain('Динамика поступлений, возвратов и расходов');
    expect(html).toContain('<th scope="col">Поступления</th>');
    expect(html).toContain(formatMoney('730000', 'KZT'));
    // The summary comes from the unchanged combined outflow, not an inflated expense KPI.
    expect(flow.reduce((sum, day) => sum + day.expense, 0n)).toBe(730000n);
  });

  // плитки со спарклайнами сняты (аудит 22.10.2026 P1-3b): итоги строкой, возврат не попадает в «Расходы»
  it('keeps a refund out of the expenses total in the one-line summary', () => {
    const html = renderToStaticMarkup(createElement(FinanceTotals, {
      charged: 730000n, income: 730000n, refunds: 730000n, expense: 0n,
      balance: null, currency: 'KZT',
    }));
    expect(html).toMatch(/data-testid="cash-period-expense"[^>]*>0 ₸</);
    expect(html).toMatch(/data-testid="cash-period-refunds"[^>]*>7 300 ₸</);
    expect(html).not.toContain('fin-spark');
  });

  it('separates completed cash expenses from refunds and ignores voids and transfers', () => {
    const flow = dailyFlow([
      row('PAYMENT', '60000'), row('INCOME', '10000'),
      row('REFUND', '20000'), row('EXPENSE', '30000'),
      row('EXPENSE', '90000', { status: 'VOIDED' }),
      row('REFUND', '90000', { status: 'VOIDED' }),
      row('TRANSFER', '90000'),
      row('EXPENSE', '90000', { localAt: '2030-05-01T12:00:00' }),
    ], from, to);
    expect(flow[0]).toMatchObject({ income: 70000n, expense: 50000n, cashExpense: 30000n });
    expect(flow[1]).toMatchObject({ income: 0n, expense: 0n, cashExpense: 0n });
  });
});
