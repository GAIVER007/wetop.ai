import { describe, expect, it } from 'vitest';
import { stockWords } from './stock-words';

describe('слова склада по направлению', () => {
  it('салон: товары и расходники, без бара, кухни, боя и угощения', () => {
    const w = stockWords('BEAUTY');
    const all = JSON.stringify(w);
    expect(w.goodsTitle).toBe('Склад: товары');
    expect(w.goods).toBe('Товары');
    expect(w.writeOffReasons).toEqual(['Порча', 'Истек срок', 'Для работы салона', 'Иное']);
    for (const word of ['бар', 'Бар', 'кухн', 'Бой', 'Угощение', 'объекта']) expect(all).not.toContain(word);
  });

  it('гостиница и ресторан: бар и прежние причины', () => {
    expect(stockWords('HOSPITALITY').goodsTitle).toBe('Склад: бар');
    expect(stockWords('HOSPITALITY').materials).toBe('Расходники');
    expect(stockWords('FOOD_SERVICE').materials).toBe('Склад кухни');
    expect(stockWords('HOSPITALITY').writeOffReasons).toContain('Бой');
  });
});
