import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WarehouseSummary } from './warehouse-summary';

const html = (cards: Parameters<typeof WarehouseSummary>[0]['cards']) =>
  renderToStaticMarkup(createElement(WarehouseSummary, { cards }));

describe('warehouse summary', () => {
  it('shows bar and kitchen stock side by side with what runs low', () => {
    const out = html([
      { id: 'bar', title: 'Бар', href: '/bar/products', items: 12, low: 3, value: null },
      { id: 'kitchen', title: 'Кухня', href: '/bar/consumables', items: 5, low: 0, value: '1 000 ₸' },
    ]);
    expect(out).toContain('12 позиций');
    expect(out).toContain('Заканчивается: 3');
    expect(out).toContain('5 позиций на 1 000 ₸');
    expect(out).toContain('В норме');
    expect(out).toContain('href="/bar/consumables"');
  });
  it('says so when a stock could not be read instead of showing zeros', () => {
    const out = html([{ id: 'kitchen', title: 'Кухня', href: '/stock', items: null, low: 0, value: null }]);
    expect(out).toContain('Нет данных');
    expect(out).toContain('Остатки не загрузились');
  });
});
