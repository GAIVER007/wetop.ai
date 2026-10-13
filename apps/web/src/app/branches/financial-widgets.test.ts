import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FinancialWidgets } from './financial-widgets';
import type { OrganizationSummary } from '../../lib/api';
it('orders the overview from expenses to received income without changing values', () => {
  const summary: OrganizationSummary = {
    from: '2026-10-01',
    to: '2026-10-31',
    complete: true,
    covered: 1,
    total: 1,
    orders: 10,
    rows: [],
    currencies: [
      {
        currency: 'KZT',
        expensesMinor: '500000',
        receiptsMinor: '2000000',
        orders: 10,
        averageMinor: '200000',
      },
    ],
  };
  const html = renderToStaticMarkup(createElement(FinancialWidgets, { summary }));
  const labels = ['Расходы', 'Средний чек', 'Оплаченные заказы', 'Доход от оплат'];
  const positions = labels.map((label) => html.indexOf(`<p>${label}</p>`));
  expect(positions.every((index) => index >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(html).toContain('5 000 ₸');
  expect(html).toContain('20 000 ₸');
  expect(html).toContain('2 000 ₸');
});
