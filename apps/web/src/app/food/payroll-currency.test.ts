import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PayrollView } from '../../lib/food-types';
import {
  PayrollBoard,
  PayrollMonthNav,
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
  rows: [{
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
  }],
  adjustments: [],
};

describe('payroll in the configured currency', () => {
  it('renders exact decimal minor units without rounding to whole tenge', () => {
    const html = renderToStaticMarkup(createElement(PayrollBoard, {
      scopeKey: 'synthetic-business:synthetic-location',
      write: false,
      payroll,
      basis: 'visits',
    }));

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
    const html = renderToStaticMarkup(createElement(PayrollBoard, {
      scopeKey: 'synthetic-business:synthetic-location',
      write: true,
      payroll,
      basis: 'visits',
    }));
    expect(html).not.toContain('class="stats');
    expect(html).toMatch(/<tfoot>[\s\S]*Итого[\s\S]*data-testid="payroll-total"[\s\S]*<\/tfoot>/);
    // месяц переехал в строку заголовка (вариант A владельца 25.10.2026): по-русски там
    expect(renderToStaticMarkup(createElement(PayrollMonthNav, { month: '2026-10' }))).toContain('октябрь 2026');
    // четыре итога месяца строкой над таблицей
    expect(html).toMatch(/data-testid="payroll-totals"[\s\S]*Начислено[\s\S]*Выплачено[\s\S]*Осталось выплатить[\s\S]*Без настройки оплаты/);
    const row = html.slice(html.indexOf('Synthetic master'), html.indexOf('</tr>', html.indexOf('Synthetic master')));
    expect(row.match(/class="btn(?! btn--secondary| btn--ghost| action-menu)[^"]*"/g) ?? []).toHaveLength(1);
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
    expect(paySettingsBody('FIXED', '3 000', '30', 'QAR')).toEqual({ model: 'FIXED', fixedMinor: 300000, percent: 0 });
    expect(paySettingsBody('PERCENT', '3 000', '30', 'QAR')).toEqual({ model: 'PERCENT', fixedMinor: 0, percent: 30 });
    expect(paySettingsBody('FIXED_PLUS_PERCENT', '3000', '30', 'QAR')).toEqual({ model: 'FIXED_PLUS_PERCENT', fixedMinor: 300000, percent: 30 });
    // пустое или нулевое поле выбранного способа это ошибка, а не молча сохранённый ноль
    expect(() => paySettingsBody('FIXED', '', '', 'QAR')).toThrow('QAR');
    expect(() => paySettingsBody('FIXED', '0', '', 'QAR')).toThrow('больше нуля');
    expect(() => paySettingsBody('PERCENT', '', '0', 'QAR')).toThrow('от 1 до 100');
    expect(() => paySettingsBody('PERCENT', '', '101', 'QAR')).toThrow('от 1 до 100');
    expect(() => paySettingsBody('FIXED_PLUS_PERCENT', '1000', '', 'QAR')).toThrow('от 1 до 100');
  });
});
