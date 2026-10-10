import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  ORDER_DELAY_MINUTES,
  orderNext,
  orderDelayed,
  ingredientCost,
  techCardTotals,
  payrollTotals,
  parseMenuCategoryInput,
  parseMenuItemInput,
  parseIngredientInput,
  parseOrderCreate,
  parsePayAdjustment,
  parsePaySettings,
} from './restaurant';

describe('статусная машина заказа (§33.2)', () => {
  it('перечисление полное', () => {
    expect(ORDER_STATUSES).toEqual(['NEW', 'COOKING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED']);
  });
  it('переходы ровно по модели', () => {
    expect(orderNext('NEW')).toEqual(['COOKING', 'CANCELLED']);
    expect(orderNext('COOKING')).toEqual(['READY', 'CANCELLED']);
    expect(orderNext('READY')).toEqual(['SERVED', 'CANCELLED']);
    expect(orderNext('SERVED')).toEqual(['CLOSED']);
    expect(orderNext('CLOSED')).toEqual([]);
    expect(orderNext('CANCELLED')).toEqual([]);
  });
  it('задержка: NEW и COOKING старше 20 минут', () => {
    const opened = new Date('2026-10-09T12:00:00Z');
    const before = new Date(opened.getTime() + (ORDER_DELAY_MINUTES * 60 - 1) * 1000);
    const after = new Date(opened.getTime() + ORDER_DELAY_MINUTES * 60000);
    expect(orderDelayed('NEW', opened, before)).toBe(false);
    expect(orderDelayed('NEW', opened, after)).toBe(true);
    expect(orderDelayed('COOKING', opened, after)).toBe(true);
    expect(orderDelayed('READY', opened, after)).toBe(false);
    expect(orderDelayed('SERVED', opened, after)).toBe(false);
  });
});

describe('деньги техкарты (§33.1): целые minor units, округление к ближайшему', () => {
  it('граммы и миллилитры: норма × цена за кг или л / 1000', () => {
    expect(ingredientCost({ normQty: '100', unit: 'г', unitCost: 12000n })).toBe(1200n);
    expect(ingredientCost({ normQty: '80', unit: 'мл', unitCost: 35000n })).toBe(2800n);
  });
  it('штуки: норма × цена за штуку', () => {
    expect(ingredientCost({ normQty: '2', unit: 'шт', unitCost: 5000n })).toBe(10000n);
    expect(ingredientCost({ normQty: '0.5', unit: 'шт', unitCost: 1201n })).toBe(601n);
  });
  it('округление половины вверх', () => {
    expect(ingredientCost({ normQty: '500', unit: 'г', unitCost: 1n })).toBe(1n);
    expect(ingredientCost({ normQty: '499', unit: 'г', unitCost: 1n })).toBe(0n);
    expect(ingredientCost({ normQty: '33.333', unit: 'г', unitCost: 10000n })).toBe(333n);
  });
  it('итоги карточки: числа макета 390 / 110', () => {
    const t = techCardTotals(39000n, [
      { normQty: '100', unit: 'г', unitCost: 100000n },
      { normQty: '1', unit: 'шт', unitCost: 1000n },
    ]);
    expect(t.cost).toBe(11000n);
    expect(t.profit).toBe(28000n);
    expect(t.foodCostPct).toBe(28);
    expect(t.marginPct).toBe(255);
  });
  it('нулевая цена и пустая техкарта не делят на ноль', () => {
    const t = techCardTotals(0n, []);
    expect(t.cost).toBe(0n);
    expect(t.foodCostPct).toBeNull();
    expect(t.marginPct).toBeNull();
  });
});

describe('зарплата (§33.4): числа макета 40 000 + 5% + бонусы − штрафы', () => {
  const setting = { model: 'FIXED_PLUS_PERCENT' as const, fixedMinor: 4000000n, percent: 5 };
  it('оклад + процент от заказов CLOSED + корректировки', () => {
    const t = payrollTotals(setting, 36400000n, [500000n, -200000n]);
    expect(t.base).toBe(4000000n);
    expect(t.percentPart).toBe(1820000n);
    expect(t.bonus).toBe(500000n);
    expect(t.penalty).toBe(-200000n);
    expect(t.total).toBe(6120000n);
  });
  it('модели PERCENT и BONUS_ONLY не платят оклад', () => {
    expect(payrollTotals({ ...setting, model: 'PERCENT' }, 36400000n, []).base).toBe(0n);
    const bonusOnly = payrollTotals({ ...setting, model: 'BONUS_ONLY' }, 36400000n, [100n]);
    expect(bonusOnly.base).toBe(0n);
    expect(bonusOnly.percentPart).toBe(0n);
    expect(bonusOnly.total).toBe(100n);
  });
  it('FIXED не берёт процент', () => {
    const t = payrollTotals({ ...setting, model: 'FIXED' }, 36400000n, []);
    expect(t.percentPart).toBe(0n);
    expect(t.total).toBe(4000000n);
  });
});

describe('разбор входа', () => {
  it('категория: имя обязательно', () => {
    expect(parseMenuCategoryInput({ name: 'Паста' })).toEqual({ name: 'Паста' });
    expect(() => parseMenuCategoryInput({})).toThrow();
    expect(() => parseMenuCategoryInput({ name: ' ' })).toThrow();
  });
  it('блюдо: цена целым числом minor units, вес больше нуля', () => {
    const b = parseMenuItemInput({
      categoryId: '11111111-1111-4111-8111-111111111111',
      name: 'Паста Карбонара',
      price: 39000,
      weightGrams: 320,
    });
    expect(b.price).toBe(39000n);
    expect(() => parseMenuItemInput({ name: 'X', price: -1 })).toThrow();
    expect(() => parseMenuItemInput({ name: 'X', price: 10.5 })).toThrow();
    expect(() => parseMenuItemInput({ name: 'X', price: 1, weightGrams: 0 })).toThrow();
  });
  it('ингредиент: норма, единица из списка, цена', () => {
    const i = parseIngredientInput({ name: 'Спагетти', normQty: '100', unit: 'г', unitCost: 12000 });
    expect(i.unitCost).toBe(12000n);
    expect(() => parseIngredientInput({ name: 'X', normQty: '1', unit: 'kg', unitCost: 1 })).toThrow();
    expect(() => parseIngredientInput({ name: 'X', normQty: '0', unit: 'г', unitCost: 1 })).toThrow();
  });
  it('заказ: хотя бы одна строка, количество целое', () => {
    const o = parseOrderCreate({
      guestCount: 2,
      items: [{ menuItemId: '11111111-1111-4111-8111-111111111111', qty: 2 }],
    });
    expect(o.items).toHaveLength(1);
    expect(() => parseOrderCreate({ guestCount: 2, items: [] })).toThrow();
    expect(() =>
      parseOrderCreate({
        guestCount: 2,
        items: [{ menuItemId: '11111111-1111-4111-8111-111111111111', qty: 0 }],
      }),
    ).toThrow();
  });
  it('корректировка: сумма не ноль, причина обязательна', () => {
    const a = parsePayAdjustment({ period: '2026-10', amountMinor: -200000, reason: 'Опоздание' });
    expect(a.period).toBe('2026-10-01');
    expect(a.amountMinor).toBe(-200000n);
    expect(() => parsePayAdjustment({ period: '2026-10', amountMinor: 0, reason: 'X' })).toThrow();
    expect(() => parsePayAdjustment({ period: '2026-13', amountMinor: 1, reason: 'X' })).toThrow();
  });
  it('настройка оплаты: процент 0..100', () => {
    const s = parsePaySettings({ model: 'FIXED_PLUS_PERCENT', fixedMinor: 4000000, percent: 5 });
    expect(s.fixedMinor).toBe(4000000n);
    expect(() => parsePaySettings({ model: 'FIXED', fixedMinor: 0, percent: 101 })).toThrow();
    expect(() => parsePaySettings({ model: 'NOPE', fixedMinor: 0, percent: 0 })).toThrow();
  });
});
