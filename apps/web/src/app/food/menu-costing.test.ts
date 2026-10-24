import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { MenuCostingReport } from '../../lib/food-types';
import { MenuCostingPanel, foodCostTone } from './menu-costing';

/** «Себестоимость и маржа» меню (DATA_MODEL §62.4, K4): таблица по позициям, раскрытие техкарты и добавок */
describe('MenuCostingPanel', () => {
  const report: MenuCostingReport = {
    currency: 'KZT',
    items: [
      {
        id: 'c', name: 'Американо', categoryName: 'Кофе', active: true, priceMinor: '80000', costMinor: '21600', profitMinor: '58400',
        foodCostPct: 27, marginPct: 270,
        lines: [{ name: 'Кофе', normQty: '18', unit: 'г', costMinor: '21600', source: 'STOCK' }],
        modifiers: [{ id: 'm', name: 'Молоко', priceDeltaMinor: '20000', costMinor: '3000', profitMinor: '17000' }],
        missing: [],
      },
      {
        id: 'l', name: 'Лимонад', categoryName: 'Напитки', active: true, priceMinor: '60000', costMinor: '30000', profitMinor: '30000',
        foodCostPct: 50, marginPct: 100,
        lines: [{ name: 'Мята', normQty: '2', unit: 'г', costMinor: '0', source: 'NONE' }],
        modifiers: [],
        missing: ['Мята'],
      },
      { id: 'x', name: 'Снято', categoryName: 'Кофе', active: false, priceMinor: '1', costMinor: '0', profitMinor: '1', foodCostPct: 0, marginPct: null, lines: [], modifiers: [], missing: [] },
    ],
  };

  it('строка позиции: цена, себестоимость, прибыль, доля; техкарта и добавки в раскрытии; снятые не показаны', () => {
    const html = renderToStaticMarkup(createElement(MenuCostingPanel, { report }));
    expect(html).toContain('Себестоимость и маржа');
    expect(html.match(/data-testid="menu-costing-row"/g)).toHaveLength(2);
    expect(html).toContain('Американо');
    expect(html).toMatch(/216/);
    expect(html).toMatch(/584/);
    expect(html).toContain('27%');
    expect(html).toContain('по складу');
    expect(html).toContain('Добавка «Молоко»');
    expect(html).toContain('нет цены: 1');
    expect(html).toContain('Без цены продукта: 1 поз.');
    expect(html).not.toContain('Снято');
  });

  it('цвет доли продуктов: до 30% хорошо, до 40% внимание, выше дорого', () => {
    expect([foodCostTone(27), foodCostTone(35), foodCostTone(50), foodCostTone(null)]).toEqual(['ok', 'warn', 'danger', 'neutral']);
  });

  it('пустое меню: подсказка без таблицы', () => {
    expect(renderToStaticMarkup(createElement(MenuCostingPanel, { report: { currency: 'KZT', items: [] } }))).toContain('Позиций в меню пока нет');
  });
});
