import { describe, expect, it } from 'vitest';
import { receiptMarkupInput } from './bar-markup';

/**
 * Аудит салона 22.10.2026 P1: товар создан с ценой продажи 4 500 ₸ без наценки, приход по 2 500 ставил наценку 0 %
 * и проведение затирало цену продажи до 2 500 ₸. Наценка строки прихода сохраняет заданную цену, пока своей
 * наценки у товара или категории нет.
 */
describe('наценка строки прихода', () => {
  const product = (over: Partial<Parameters<typeof receiptMarkupInput>[0]> = {}) => ({
    markupBasis: null,
    salePrice: '450000',
    category: null,
    ...over,
  });

  it('без своей наценки держит заданную цену продажи', () => {
    expect(receiptMarkupInput(product(), '2500')).toBe('80.00');
    expect(receiptMarkupInput(product(), '2 500,00')).toBe('80.00');
    // дробная наценка округляется вверх: цена не ниже заданной
    expect(receiptMarkupInput(product({ salePrice: '100000' }), '300')).toBe('233.34');
  });

  it('своя наценка товара или категории важнее', () => {
    expect(receiptMarkupInput(product({ markupBasis: 3000 }), '2500')).toBe('30.00');
    expect(receiptMarkupInput(product({ category: { defaultMarkupBasis: 5000 } }), '2500')).toBe('50.00');
  });

  it('цена не задана, закупка пустая или дороже цены: наценка 0', () => {
    expect(receiptMarkupInput(product({ salePrice: '0' }), '2500')).toBe('0.00');
    expect(receiptMarkupInput(product(), '')).toBe('0.00');
    expect(receiptMarkupInput(product(), '5000')).toBe('0.00');
    expect(receiptMarkupInput(undefined, '2500')).toBe('0.00');
  });
});
