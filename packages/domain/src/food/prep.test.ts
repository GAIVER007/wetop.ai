import { describe, expect, it } from 'vitest';
import { parsePrepRecipe, parseProduction, prepCycle, prepNeed, prepUnitCost } from './prep';
import { parseKitchenProduct } from './stock';

/** Заготовки (DATA_MODEL §62, план `plans/2026-10-24-kitchen-for-all-verticals.md`, срез K1) */
describe('заготовки: расход на партию', () => {
  it('норма на выход пересчитывается на партию: колбаса 1 кг из 800 г мяса и 20 г соли, варим 2.5 кг', () => {
    const need = prepNeed(
      [
        { ingredientId: 'meat', normQty: 800_000n },
        { ingredientId: 'salt', normQty: 20_000n },
      ],
      1_000_000n,
      2_500_000n,
    );
    expect(need.get('meat')).toBe(2_000_000n);
    expect(need.get('salt')).toBe(50_000n);
  });

  it('дробный пересчёт округляется до тысячной доли половиной вверх, ноль не списывается', () => {
    // 1 г на выход 3 шт, партия 1 шт → 0.333 г
    expect(prepNeed([{ ingredientId: 'x', normQty: 1_000n }], 3_000n, 1_000n).get('x')).toBe(333n);
    // 2 г на 3 шт, партия 1 шт → 0.667 г
    expect(prepNeed([{ ingredientId: 'x', normQty: 2_000n }], 3_000n, 1_000n).get('x')).toBe(667n);
    expect(prepNeed([{ ingredientId: 'x', normQty: 1n }], 1_000_000n, 1_000n).has('x')).toBe(false);
  });

  it('одинаковый ингредиент в двух строках складывается', () => {
    expect(
      prepNeed(
        [
          { ingredientId: 'milk', normQty: 100_000n },
          { ingredientId: 'milk', normQty: 50_000n },
        ],
        1_000n,
        2_000n,
      ).get('milk'),
    ).toBe(300_000n);
  });
});

describe('заготовки: цена единицы партии', () => {
  it('за кг или л: 2.5 кг колбасы за 7 500 ₸ (750 000 тиынов) → 300 000 тиынов за кг', () => {
    expect(prepUnitCost(750_000n, 2_500_000n, 'г')).toBe(300_000n);
    expect(prepUnitCost(750_000n, 2_500_000n, 'мл')).toBe(300_000n);
  });
  it('за штуку: 10 бутербродов за 5 000 тиынов → 500 за штуку; округление половиной вверх', () => {
    expect(prepUnitCost(5_000n, 10_000n, 'шт')).toBe(500n);
    expect(prepUnitCost(1_000n, 3_000n, 'шт')).toBe(333n);
    expect(prepUnitCost(2_000n, 3_000n, 'шт')).toBe(667n);
  });
  it('нулевая себестоимость (всё в недостаче) даёт цену 1, партия не может стоить ноль', () => {
    expect(prepUnitCost(0n, 1_000n, 'шт')).toBe(1n);
  });
});

describe('заготовки: циклы запрещены', () => {
  it('заготовка не может входить сама в себя ни прямо, ни через другую заготовку', () => {
    const graph = new Map([
      ['sauce', ['tomato']],
      ['pizza-base', ['dough', 'sauce']],
    ]);
    expect(prepCycle(graph, 'sauce', ['sauce'])).toBe(true);
    expect(prepCycle(graph, 'sauce', ['tomato', 'pizza-base'])).toBe(true);
    expect(prepCycle(graph, 'sauce', ['tomato', 'basil'])).toBe(false);
    expect(prepCycle(graph, 'pizza-base', ['dough', 'sauce'])).toBe(false);
  });
});

describe('заготовки: разбор форм', () => {
  it('техкарта заготовки: выход и строки, ингредиент один раз', () => {
    expect(
      parsePrepRecipe({
        yieldQty: '1000',
        lines: [
          { ingredientId: '11111111-1111-4111-8111-111111111111', normQty: '800' },
          { ingredientId: '22222222-2222-4222-8222-222222222222', normQty: '20,5' },
        ],
      }),
    ).toEqual({
      yieldQty: 1_000_000n,
      lines: [
        { ingredientId: '11111111-1111-4111-8111-111111111111', normQty: 800_000n },
        { ingredientId: '22222222-2222-4222-8222-222222222222', normQty: 20_500n },
      ],
    });
    const id = '11111111-1111-4111-8111-111111111111';
    expect(() => parsePrepRecipe({ yieldQty: '1', lines: [] })).toThrow(/от 1 до 50/);
    expect(() =>
      parsePrepRecipe({ yieldQty: '1', lines: [{ ingredientId: id, normQty: '1' }, { ingredientId: id, normQty: '2' }] }),
    ).toThrow(/один раз/);
    expect(() => parsePrepRecipe({ yieldQty: '0', lines: [{ ingredientId: id, normQty: '1' }] })).toThrow(/больше нуля/);
  });

  it('«Приготовили»: заготовка, количество, срок годности по желанию', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(parseProduction({ productId: id, qty: '2.5' })).toEqual({ productId: id, qty: 2_500n, expiresOn: null });
    expect(parseProduction({ productId: id, qty: '3', expiresOn: '2026-10-27' }).expiresOn).toBe('2026-10-27');
    expect(() => parseProduction({ productId: id, qty: '0' })).toThrow(/больше нуля/);
  });

  it('новый продукт склада: вид «сырьё» по умолчанию или «заготовка»', () => {
    expect(parseKitchenProduct({ name: 'Колбаса', unit: 'г', kind: 'PREP' }).kind).toBe('PREP');
    expect(parseKitchenProduct({ name: 'Мука', unit: 'г' }).kind).toBeUndefined();
    expect(() => parseKitchenProduct({ name: 'Мука', unit: 'г', kind: 'X' })).toThrow(/сырьё или заготовка/);
  });
});
