import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PayrollView } from '../../lib/food-types';
import {
  PayrollBoard,
  PayrollMonthNav,
  PayrollTotals,
  payoutPlan,
  paySettingsBody,
  payFields,
  payChoiceOf,
  payrollMinorToInput,
  payrollPositiveInputToMinor,
  payrollSalaryInputToMinor,
} from './payroll-board';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push() {}, refresh() {} }) }));
vi.mock('./restaurant-actions', () => ({ mutateStaff: vi.fn() }));

const payroll: PayrollView = {
  month: '2026-10',
  currency: 'USD',
  totals: {
    fundMinor: '123456',
    bonusMinor: '123456',
    penaltyMinor: '0',
    payoutMinor: '123456',
    paidMinor: '0',
  },
  rows: [
    {
      employeeId: 'synthetic-employee',
      name: 'Synthetic master',
      status: 'ACTIVE',
      model: 'FIXED',
      fixedMinor: '123456',
      percent: 0,
      salesMinor: '123456',
      baseMinor: '123456',
      percentMinor: '0',
      bonusMinor: '0',
      penaltyMinor: '0',
      totalMinor: '123456',
      paidMinor: '0',
      remainingMinor: '123456',
    },
  ],
  adjustments: [],
};

describe('столбец «Доход» (владелец 26.10.2026: «видно, с чего считается оплата»)', () => {
  const render = (basis: 'visits' | 'orders') =>
    renderToStaticMarkup(
      createElement(PayrollBoard, {
        scopeKey: 'synthetic-business:synthetic-location',
        write: false,
        payroll: { ...payroll, rows: [{ ...payroll.rows[0]!, salesMinor: '750000' }] },
        basis,
      }),
    );
  it('первый денежный столбец после имени: «Доход» с суммой услуг сотрудника и итог в подвале', () => {
    const html = render('visits');
    const heads = [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
    // владелец 29.10.2026: первый столбец денег называется «Выручка», не «Доход»
    expect(heads.slice(0, 3)).toEqual(['Сотрудник', 'Выручка', 'Как платим']);
    expect(html).toContain('data-testid="payroll-income"');
    expect(html).toMatch(/data-testid="payroll-income"[^>]*><strong>[^<]*7[\s\u00a0\u202f]?500/);
    expect(html).toMatch(/data-testid="payroll-income-total"[^>]*><strong>[^<]*7[\s\u00a0\u202f]?500/);
  });
  it('ресторан: тот же столбец «Доход» по закрытым заказам', () => {
    expect(render('orders')).toContain('data-testid="payroll-income"');
  });
});

describe('payroll in the configured currency', () => {
  it('renders exact decimal minor units without rounding to whole tenge', () => {
    const html = renderToStaticMarkup(
      createElement(PayrollBoard, {
        scopeKey: 'synthetic-business:synthetic-location',
        write: false,
        payroll,
        basis: 'visits',
      }),
    );

    expect(html).toContain('1 234,56 USD');
    expect(html).not.toContain('1 235 USD');
    expect(html).not.toContain('₸');
  });

  it('converts decimal salary settings to safe integer minor units', () => {
    expect(payrollSalaryInputToMinor('1 234,56', 'USD')).toBe(123456);
    expect(payrollSalaryInputToMinor('0', 'USD')).toBe(0);
    expect(payrollMinorToInput('123456')).toBe('1234.56');
    expect(() => payrollSalaryInputToMinor('12.345', 'USD')).toThrow('USD');
    expect(() => payrollSalaryInputToMinor('90071992547409.92', 'USD')).toThrow('слишком большая');
  });

  it('uses the same exact parser for payouts and adjustments and rejects zero', () => {
    expect(payrollPositiveInputToMinor('1 234,56', 'USD')).toBe(123456);
    expect(() => payrollPositiveInputToMinor('0', 'USD')).toThrow('больше нуля');
    expect(() => payrollPositiveInputToMinor('-1', 'USD')).toThrow('USD');
  });

  it('итоги строкой под таблицей вместо плиток, одна главная кнопка в строке, месяц по-русски (аудит 21.10.2026, п. 4, 29, 42)', () => {
    const html = renderToStaticMarkup(
      createElement(PayrollBoard, {
        scopeKey: 'synthetic-business:synthetic-location',
        write: true,
        payroll,
        basis: 'visits',
      }),
    );
    expect(html).not.toContain('class="stats');
    expect(html).toMatch(/<tfoot>[\s\S]*Итого[\s\S]*data-testid="payroll-total"[\s\S]*<\/tfoot>/);
    // месяц переехал в строку заголовка (вариант A владельца 25.10.2026): по-русски там
    expect(renderToStaticMarkup(createElement(PayrollMonthNav, { month: '2026-10' }))).toContain(
      'октябрь 2026',
    );
    // итоги месяца переехали в строку заголовка рядом с месяцем (владелец 26.10.2026), проверка ниже
    const row = html.slice(
      html.indexOf('Synthetic master'),
      html.indexOf('</tr>', html.indexOf('Synthetic master')),
    );
    expect(
      row.match(/class="btn(?! btn--secondary| btn--ghost| action-menu)[^"]*"/g) ?? [],
    ).toHaveLength(1);
    expect(row).toContain('aria-label="Ещё: Synthetic master"');
    expect(row).toContain('>Условия оплаты<');
    expect(row).toContain('>Премия или удержание<');
  });

  it('окно оплаты: три способа, поля только выбранного способа, премий в способах нет (владелец 25.10.2026)', () => {
    expect(payFields('FIXED')).toEqual({ fixed: true, percent: false });
    expect(payFields('PERCENT')).toEqual({ fixed: false, percent: true });
    expect(payFields('FIXED_PLUS_PERCENT')).toEqual({ fixed: true, percent: true });
    expect(payChoiceOf('BONUS_ONLY')).toBe('FIXED');
    // поле другого способа не уходит на сервер, даже если в нём что-то осталось
    expect(paySettingsBody('FIXED', '3 000', '30', 'QAR')).toEqual({
      model: 'FIXED',
      fixedMinor: 300000,
      percent: 0,
    });
    expect(paySettingsBody('PERCENT', '3 000', '30', 'QAR')).toEqual({
      model: 'PERCENT',
      fixedMinor: 0,
      percent: 30,
    });
    expect(paySettingsBody('FIXED_PLUS_PERCENT', '3000', '30', 'QAR')).toEqual({
      model: 'FIXED_PLUS_PERCENT',
      fixedMinor: 300000,
      percent: 30,
    });
    // пустое или нулевое поле выбранного способа это ошибка, а не молча сохранённый ноль
    expect(() => paySettingsBody('FIXED', '', '', 'QAR')).toThrow('QAR');
    expect(() => paySettingsBody('FIXED', '0', '', 'QAR')).toThrow('больше нуля');
    expect(() => paySettingsBody('PERCENT', '', '0', 'QAR')).toThrow('от 1 до 100');
    expect(() => paySettingsBody('PERCENT', '', '101', 'QAR')).toThrow('от 1 до 100');
    expect(() => paySettingsBody('FIXED_PLUS_PERCENT', '1000', '', 'QAR')).toThrow('от 1 до 100');
  });

  it('верх сжат: итоги рядом с месяцем в строке заголовка, не отдельной полосой над вкладками (владелец 26.10.2026)', () => {
    const board = renderToStaticMarkup(
      createElement(PayrollBoard, {
        scopeKey: 'synthetic-business:synthetic-location',
        write: true,
        payroll,
        basis: 'visits',
      }),
    );
    expect(board).not.toContain('data-testid="payroll-totals"');
    const totals = renderToStaticMarkup(createElement(PayrollTotals, { payroll }));
    expect(totals).toMatch(/data-testid="payroll-totals"[\s\S]*Начислено[\s\S]*Выплачено[\s\S]*Осталось/);
    // «Без настройки» видно, только когда такие есть
    expect(totals).not.toContain('Без настройки');
    const withUnset = renderToStaticMarkup(
      createElement(PayrollTotals, {
        payroll: { ...payroll, rows: [{ ...payroll.rows[0]!, fixedMinor: '0', percent: 0 }] },
      }),
    );
    expect(withUnset).toMatch(/Без настройки[\s\S]*data-testid="payroll-unset"[^>]*>1</);
  });

  it('месяц одной рамкой, как день в журнале: поле месяца и стрелки ‹ › внутри одной группы', () => {
    const nav = renderToStaticMarkup(createElement(PayrollMonthNav, { month: '2026-10' }));
    expect(nav).toMatch(/^<div class="board-period day-nav payroll-month" role="group"/);
    expect(nav).toContain('aria-label="Прошлый месяц"');
    expect(nav).toContain('aria-label="Следующий месяц"');
    expect(nav).not.toContain('class="btn');
  });

  it('в строке всегда «Выплатить», в том числе у ненастроенного; условия и премии в меню ⋯', () => {
    const unset = {
      ...payroll.rows[0]!,
      employeeId: 'synthetic-unset',
      name: 'Synthetic new',
      model: 'FIXED' as const,
      fixedMinor: '0',
      baseMinor: '0',
      totalMinor: '0',
      remainingMinor: '0',
    };
    const html = renderToStaticMarkup(
      createElement(PayrollBoard, {
        scopeKey: 'synthetic-business:synthetic-location',
        write: true,
        payroll: { ...payroll, rows: [...payroll.rows, unset] },
        basis: 'visits',
      }),
    );
    expect(html).not.toContain('>Настроить<');
    expect(html.match(/>Выплатить</g) ?? []).toHaveLength(2);
  });

  it('окно выплаты считает остаток: по умолчанию весь остаток, больше остатка нельзя, ноль нельзя', () => {
    expect(payoutPlan('123456', '23456', '1000.00', 'USD')).toEqual({
      amountMinor: 100000,
      afterMinor: '0',
      error: null,
    });
    expect(payoutPlan('123456', '23456', '400', 'USD')).toEqual({
      amountMinor: 40000,
      afterMinor: '60000',
      error: null,
    });
    expect(payoutPlan('123456', '23456', '1000.01', 'USD').error).toMatch(/остат/);
    expect(payoutPlan('0', '0', '', 'USD').error).toMatch(/нечего|Нечего/);
  });
});
