import { describe, expect, it } from 'vitest';
import { stockWords } from './stock-words';

describe('слова склада по направлению', () => {
  // решение владельца 24.10.2026: «Бар» и «Кухня» на складе у всех направлений
  it('салон: «Бар» и «Кухня», причины списания салона без боя и угощения', () => {
    const w = stockWords('BEAUTY');
    expect(w.goodsTitle).toBe('Склад: бар');
    expect(w.goods).toBe('Бар');
    expect(w.materials).toBe('Кухня');
    expect(w.overviewSubtitle).toBe('Остатки бара и кухни и что заканчивается');
    expect(w.writeOffReasons).toEqual(['Порча', 'Истек срок', 'Для работы салона', 'Иное']);
  });

  it('гостиница: «Бар» и «Кухня»; ресторан: «Склад кухни» (его «Кухня» уже экран заказов)', () => {
    expect(stockWords('HOSPITALITY').goodsTitle).toBe('Склад: бар');
    expect(stockWords('HOSPITALITY').materials).toBe('Кухня');
    expect(stockWords('HOSPITALITY').overviewSubtitle).toBe('Остатки бара и кухни и что заканчивается');
    expect(stockWords('FOOD_SERVICE').materials).toBe('Склад кухни');
    expect(stockWords('HOSPITALITY').writeOffReasons).toContain('Бой');
  });
});
