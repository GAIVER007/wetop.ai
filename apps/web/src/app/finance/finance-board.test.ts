import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children, ...rest }: Record<string, unknown>) =>
    createElement('a', { href, 'data-prefetch': String(prefetch), ...rest }, children as never),
}));
import {
  FinanceAccrualTotals,
  FinanceDynamics,
  FinanceEmptyMonth,
  FinanceReports,
  FinanceTotals,
  financeMonthEmpty,
} from './finance-board';

const totals = {
  charged: 2400000n,
  income: 800000n,
  refunds: 100000n,
  expense: 50000n,
  balance: '1200000',
  currency: 'KZT',
};

describe('«Финансы» гостиницы без плиток (аудит 22.10.2026, P1-3b)', () => {
  it('итоги одной строкой money-summary, метки прежних плиток и сводки сохранены', () => {
    const html = renderToStaticMarkup(createElement(FinanceTotals, totals));
    expect(html).toContain('class="money-summary"');
    expect(html).not.toContain('fin-kpi');
    expect(html).not.toContain('stat__');
    expect(html).not.toContain('нет базы для сравнения');
    for (const [id, label, value] of [
      ['fin-charged', 'Общий доход', '24 000 ₸'],
      ['cash-period-income', 'Поступления', '8 000 ₸'],
      ['cash-period-refunds', 'Возвраты', '1 000 ₸'],
      ['cash-period-expense', 'Расходы', '500 ₸'],
      ['fin-profit', 'Чистая прибыль', '6 500 ₸'],
      ['cash-balance', 'Остаток на счетах', '12 000 ₸'],
    ] as const) {
      expect(html).toContain(`<dt>${label}</dt>`);
      expect(html).toMatch(new RegExp(`data-testid="${id}"[^>]*>${value}<`));
    }
    // одна строка вместо второго блока «Финансовый обзор» с плитками
    expect(html).toContain('data-testid="cash-summary"');
    expect((html.match(/<dl/g) ?? []).length).toBe(1);
  });

  it('недоступная сумма пишется словами, прибыль не считается из пустоты', () => {
    const html = renderToStaticMarkup(
      createElement(FinanceTotals, { ...totals, income: null, balance: null }),
    );
    expect(html).toMatch(/data-testid="cash-period-income"[^>]*>Нет данных</);
    expect(html).not.toContain('Чистая прибыль');
    expect(html).not.toContain('Остаток на счетах');
  });

  it('пустой месяц: одна заглушка с действием «Добавить первую бронь» вместо нулей', () => {
    const html = renderToStaticMarkup(createElement(FinanceEmptyMonth));
    expect(html).toContain('data-testid="finance-empty"');
    expect(html).toMatch(/<a[^>]*href="\/reservations\/new"[^>]*>Добавить первую бронь<\/a>/);
    expect(html).not.toContain('0 ₸');
  });

  it('пустой месяц определяется по всем источникам периода', () => {
    const empty = {
      report: { chargedMinor: '0', paidMinor: '0', refundedMinor: '0' },
      ops: { rows: [], paidMinor: '0', incomeMinor: '0', refundedMinor: '0', expenseMinor: '0' },
      debts: { count: 0 },
    };
    expect(financeMonthEmpty(empty)).toBe(true);
    expect(financeMonthEmpty({ ...empty, report: { ...empty.report, chargedMinor: '1' } })).toBe(false);
    expect(financeMonthEmpty({ ...empty, ops: { ...empty.ops, expenseMinor: '5' } })).toBe(false);
    expect(financeMonthEmpty({ ...empty, debts: { count: 1 } })).toBe(false);
    // не загрузилось: это не «пусто», заглушка не прячет ошибку
    expect(financeMonthEmpty({ ...empty, report: null })).toBe(false);
    expect(financeMonthEmpty({ ...empty, ops: null })).toBe(false);
  });

  it('ось графика без копеек: нулевой месяц не печатает «0,01 ₸»', () => {
    const flow = ['2026-10-01', '2026-10-02', '2026-10-03'].map((date) => ({
      date,
      income: 0n,
      expense: 0n,
      cashExpense: 0n,
    }));
    const html = renderToStaticMarkup(createElement(FinanceDynamics, { flow, currency: 'KZT' }));
    expect(html).not.toContain('0,01');
    expect(html).not.toMatch(/0,0\d ₸/);
  });

  it('ссылка на скачивание CSV не предзагружается (предзагрузка /finance/export давала 400)', () => {
    const html = renderToStaticMarkup(
      createElement(FinanceReports, { exportHref: '/finance/export?from=a&to=b', from: 'a', to: 'b' }),
    );
    expect(html).toMatch(/<a[^>]*href="\/finance\/export\?from=a&amp;to=b"[^>]*data-prefetch="false"/);
  });

  it('«Начислено / Оплачено / Возвращено / К сбору» строкой со ссылками к строкам, без плиток', () => {
    const html = renderToStaticMarkup(
      createElement(FinanceAccrualTotals, {
        report: { chargedMinor: '2400000', paidMinor: '800000', refundedMinor: '0' },
        currency: 'KZT',
        due: '1600000',
        dueFailed: false,
        hrefs: { charged: '#charges', paid: '/p', refunded: '/r', due: '#debts' },
      }),
    );
    expect(html).toContain('<dl class="money-summary" data-testid="finance-kpis"');
    expect(html).not.toContain('stat');
    expect(html).toMatch(/href="#charges"[^>]*data-testid="kpi-charged"><span data-testid="charged">24 000 ₸</);
    expect(html).toMatch(/href="\/p"[^>]*data-testid="kpi-paid"><span data-testid="paid">8 000 ₸</);
    expect(html).toMatch(/data-testid="kpi-due"><span data-testid="balance">16 000 ₸</);
  });
});
