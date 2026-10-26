import { createElement as h, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('./restaurant-actions', () => ({ mutateStaff: vi.fn() }));
vi.mock('../../components/overlay', () => ({
  Overlay: ({ title, children }: { title: string; children: ReactNode }) =>
    h('section', { 'data-title': title }, children),
}));
vi.mock('../branch-payment-methods/use-branch-methods', () => ({ useBranchPaymentMethods: () => [] }));

import { PayDrawer } from './payroll-board';

const row = {
  employeeId: 'e1',
  name: 'Dina Example',
  model: 'FIXED_PLUS_PERCENT',
  fixedMinor: '300000',
  percent: 20,
  salesMinor: '25000',
} as never;
const render = () =>
  renderToStaticMarkup(
    h(PayDrawer, { scopeKey: 'b:l', row, basis: 'visits', currency: 'QAR', close() {} }),
  ).replace(/<!-- -->/g, '');

/**
 * Окно «Оплата» (вариант B владельца 26.10.2026): три способа строками на всю ширину с иконкой и пояснением, поля с
 * валютой и знаком процента внутри. Расчёта «к выплате» и строки про премии нет: условия задаются один раз.
 */
describe('окно оплаты: вариант B', () => {
  it('три способа строками с иконкой, названием и пояснением', () => {
    const html = render();
    expect(html.match(/class="pay-choice"/g)).toHaveLength(3);
    expect(html.match(/class="pay-choice__icon"/g)).toHaveLength(3);
    expect(html).toContain('Одна сумма каждый месяц');
    expect(html).toContain('Доля от выполненных записей специалиста');
    expect(html).toContain('Оклад плюс доля от записей');
  });
  it('поля с валютой и процентом внутри, значения из условий', () => {
    const html = render();
    expect(html).toMatch(/value="3000(\.00)?"[^>]*>[\s\S]*?class="pay-unit"[^>]*>QAR</);
    expect(html).toMatch(/value="20"[^>]*>[\s\S]*?class="pay-unit"[^>]*>%</);
  });
  it('нет расчёта к выплате и строки про премии', () => {
    const html = render();
    expect(html).not.toContain('pay-example');
    expect(html).not.toContain('Расчёт за');
    expect(html).not.toContain('Премии');
  });
  it('подпись поля ведёт на само поле ввода, id без повторов (читалка и тесты находят поле по подписи)', () => {
    const html = render();
    const fors = [...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]);
    expect(fors.length).toBeGreaterThan(0);
    for (const id of fors) {
      expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
      expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"`));
    }
  });
});
