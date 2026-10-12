import { describe, expect, it } from 'vitest';
import { foodCostSummary, orderConsumption, splitShortage } from './consumption';

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

describe('фудкост за период по ленте склада (§38)', () => {
  it('себестоимость = расход минус возвраты, недостача нетто по продукту, проценты от выручки', () => {
    const r = foodCostSummary(1_000_000n, [
      { kind: 'CONSUMPTION', lotId: 'a', productId: 'beef', qty: '-600', cost: -360_000n },
      { kind: 'CONSUMPTION', lotId: 'a', productId: 'beef', qty: '-300', cost: -180_000n },
      { kind: 'CONSUMPTION_RETURN', lotId: 'a', productId: 'beef', qty: '300', cost: 180_000n },
      { kind: 'SHORTAGE', lotId: null, productId: 'beef', qty: '-300', cost: 0n },
      { kind: 'CONSUMPTION_RETURN', lotId: null, productId: 'beef', qty: '300', cost: 0n },
      { kind: 'SHORTAGE', lotId: null, productId: 'salt', qty: '-2.5', cost: 0n },
    ]);
    expect(r.costMinor).toBe(360_000n);
    expect(r.grossProfitMinor).toBe(640_000n);
    expect(r.foodCostPct).toBe(36);
    expect(r.shortages).toEqual([{ productId: 'salt', milli: 2_500n }]);
  });
  it('без выручки процента нет', () => {
    expect(foodCostSummary(0n, []).foodCostPct).toBeNull();
  });
});
