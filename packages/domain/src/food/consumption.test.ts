import { describe, expect, it } from 'vitest';
import { orderConsumption, splitShortage } from './consumption';

/** Списание склада по заказу (DATA_MODEL §38, ADR-168): количества в тысячных долях, bigint */
describe('расход заказа по техкартам', () => {
  it('норма × количество блюд, одинаковые продукты складываются, строки без склада пропускаются', () => {
    const need = orderConsumption([
      {
        qty: 2,
        ingredients: [
          { productId: 'flour', normQty: '120' },
          { productId: null, normQty: '5' },
        ],
      },
      { qty: 1, ingredients: [{ productId: 'flour', normQty: '30.5' }, { productId: 'egg', normQty: '1' }] },
    ]);
    expect(need.get('flour')).toBe(270_500n);
    expect(need.get('egg')).toBe(1_000n);
    expect(need.size).toBe(2);
  });
  it('пустой заказ ничего не списывает', () => {
    expect(orderConsumption([]).size).toBe(0);
  });
});

describe('нехватка остатка (Q-KITCHEN-6 А)', () => {
  it('списать весь остаток, разницу в недостачу', () => {
    expect(splitShortage(300n, 1000n)).toEqual({ take: 300n, shortage: 700n });
    expect(splitShortage(5000n, 1000n)).toEqual({ take: 1000n, shortage: 0n });
    expect(splitShortage(0n, 1000n)).toEqual({ take: 0n, shortage: 1000n });
  });
});
