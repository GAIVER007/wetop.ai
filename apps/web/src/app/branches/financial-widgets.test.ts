import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FinancialWidgets } from './financial-widgets';
import type { OrganizationSummary } from '../../lib/api';

const base: OrganizationSummary = {
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
const render = (summary: OrganizationSummary | null, verticals: string[] = ['FOOD_SERVICE']) =>
  renderToStaticMarkup(
    createElement(FinancialWidgets, {
      summary,
      verticals: verticals as Array<'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE'>,
    }),
  );

describe('итоги месяца «Организации» (аудит 22.10.2026, P1-3a, P2-4, P2-5)', () => {
  it('одна строка итогов как на других экранах, без плиток, порядок от расходов к доходу', () => {
    const html = render(base);
    expect(html).not.toContain('org-kpis');
    expect(html).toMatch(/<dl class="money-summary[^"]*" data-testid="org-totals"/);
    const labels = ['Расходы', 'Средний чек', 'Оплаченные заказы', 'Доход от оплат'];
    const positions = labels.map((label) => html.indexOf(`<dt>${label}</dt>`));
    expect(positions.every((index) => index >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(html).toContain('5 000 ₸');
    expect(html).toContain('20 000 ₸');
    expect(html).toContain('2 000 ₸');
  });

  it('слова по направлению: в салоне записи, в гостинице брони, без «заказов и броней»', () => {
    expect(render(base, ['BEAUTY'])).toContain('<dt>Оплаченные записи</dt>');
    expect(render(base, ['BEAUTY'])).not.toContain('заказ');
    expect(render(base, ['HOSPITALITY'])).toContain('<dt>Оплаченные брони</dt>');
    expect(render(base, ['HOSPITALITY', 'BEAUTY'])).toContain('<dt>Оплаченные брони и записи</dt>');
  });

  it('пустой месяц: одна фраза без «0 ₸», «Нет данных» и «Не определён»', () => {
    const html = render({ ...base, orders: 0, currencies: [] }, ['BEAUTY']);
    expect(html).toContain('data-testid="org-totals"');
    expect(html).toContain('За этот месяц оплат и расходов пока нет');
    expect(html).not.toContain('0 ₸');
    expect(html).not.toContain('Нет данных');
    expect(html).not.toContain('Не определён');
    expect(html).not.toContain('<dl');
  });

  it('неизвестный средний чек не печатается словом «Не определён»', () => {
    const html = render({
      ...base,
      currencies: [{ ...base.currencies[0]!, averageMinor: null }],
    });
    expect(html).not.toContain('Не определён');
    expect(html).not.toContain('<dt>Средний чек</dt>');
    expect(html).toContain('<dt>Доход от оплат</dt>');
  });

  it('сводка не загрузилась: одна понятная фраза без служебных оговорок', () => {
    const html = render(null);
    expect(html).toContain('Итоги месяца сейчас не загрузились');
    expect(html).not.toContain('Нет данных');
    expect(html).not.toContain('примерными значениями');
  });

  it('пояснения простыми словами, без «финансовых данных» и «Валюты показаны раздельно»', () => {
    const partial = render({
      ...base,
      complete: false,
      rows: [{ id: 'l', businessId: 'b', name: 'Example salon', state: 'UNAVAILABLE', orders: 0, currencies: [] }],
    });
    expect(partial).not.toContain('Example salon');
    expect(partial).not.toContain('доступными финансовыми данными');
    expect(partial).not.toContain('Валюты показаны раздельно');
    expect(partial).toContain('Только объекты, где ведётся учёт оплат');
    const full = render(base);
    expect(full).not.toContain('Все доступные объекты, включая архивные');
    expect(full).toContain('Все объекты, в том числе из архива');
    const two = render({
      ...base,
      currencies: [...base.currencies, { ...base.currencies[0]!, currency: 'USD' }],
    });
    expect(two).toContain('Суммы в разных валютах считаются отдельно');
    expect(full).not.toContain('валютах');
  });
});
