import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WarehouseSummary, type WarehouseCard } from './warehouse-summary';

const html = (cards: WarehouseCard[]) => renderToStaticMarkup(createElement(WarehouseSummary, { cards }));
const noun: WarehouseCard['noun'] = ['товар', 'товара', 'товаров'];

describe('warehouse summary', () => {
  it('says what to buy and which items, with the totals in small print', () => {
    const out = html([
      { id: 'bar', title: 'Бар', href: '/bar', noun, items: 12, lowNames: ['Red Bull', 'Чипсы'], value: null },
      { id: 'kitchen', title: 'Кухня', href: '/bar/consumables', noun: ['продукт', 'продукта', 'продуктов'], items: 5, lowNames: [], value: '1 000 ₸' },
    ]);
    expect(out).toContain('Докупить: 2 товара');
    expect(out).toContain('Red Bull, Чипсы');
    expect(out).toContain('Нужна закупка');
    expect(out).toContain('Всего на складе: 12 товаров');
    expect(out).toContain('Всё в порядке');
    expect(out).toContain('Всего на складе: 5 продуктов на 1 000 ₸');
    expect(out).toContain('href="/bar/consumables"');
  });
  it('lists three names and counts the rest', () => {
    const out = html([{ id: 'bar', title: 'Бар', href: '/bar', noun, items: 9, lowNames: ['А', 'Б', 'В', 'Г', 'Д'], value: null }]);
    expect(out).toContain('А, Б, В и ещё 2');
  });
  it('an empty warehouse is not reported as being in order', () => {
    const out = html([{ id: 'bar', title: 'Бар', href: '/bar', noun, items: 0, lowNames: [], value: '0 ₸' }]);
    expect(out).toContain('Пока пусто');
    expect(out).toContain('Пусто');
    expect(out).not.toContain('Всё в порядке');
    expect(out).not.toContain('В норме');
  });
  it('says so when a stock could not be read instead of showing zeros', () => {
    const out = html([{ id: 'kitchen', title: 'Кухня', href: '/stock', noun, items: null, lowNames: [], value: null }]);
    expect(out).toContain('Нет данных');
    expect(out).toContain('Остатки не загрузились');
  });
});
