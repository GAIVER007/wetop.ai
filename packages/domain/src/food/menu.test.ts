import { describe, expect, it } from 'vitest';
import {
  effectiveMenuItem,
  parseLocationMenuItem,
  parseMenuCategory,
  parseMenuItem,
} from './menu';

describe('parseMenuCategory', () => {
  it('принимает название, порядок и активность', () => {
    expect(parseMenuCategory({ name: ' Супы ', sortOrder: 2, active: false })).toEqual({
      name: 'Супы',
      sortOrder: 2,
      active: false,
    });
  });
  it('отклоняет пустое название и чужое поле', () => {
    expect(() => parseMenuCategory({ name: '  ' })).toThrow('Некорректный текст');
    expect(() => parseMenuCategory({ name: 'Супы', businessId: 'x' })).toThrow(
      'Неизвестное поле запроса',
    );
  });
  it('в частичной правке название не обязательно', () => {
    expect(parseMenuCategory({ active: true }, true)).toEqual({ active: true });
  });
});

describe('parseMenuItem', () => {
  const base = { name: 'Стейк Рибай', price: 590000, currency: 'KZT' };
  it('принимает карточку блюда целиком', () => {
    expect(
      parseMenuItem({
        ...base,
        sku: 'GRL-001',
        description: 'Премиальная говядина',
        outputWeightGrams: 300,
        prepTimeMinutes: 20,
        allergens: ['Горчица'],
        tags: ['hit', 'new', 'hit'],
      }),
    ).toEqual({
      name: 'Стейк Рибай',
      price: 590000,
      currency: 'KZT',
      sku: 'GRL-001',
      description: 'Премиальная говядина',
      outputWeightGrams: 300,
      prepTimeMinutes: 20,
      allergens: ['Горчица'],
      tags: ['hit', 'new'],
    });
  });
  it('цена только целым minor units не ниже нуля', () => {
    expect(() => parseMenuItem({ ...base, price: 59.9 })).toThrow('Некорректное целое число');
    expect(() => parseMenuItem({ ...base, price: -1 })).toThrow('Некорректное целое число');
    expect(parseMenuItem({ ...base, price: 0 }).price).toBe(0);
  });
  it('валюта из списка, пометки только hit и new', () => {
    expect(() => parseMenuItem({ ...base, currency: 'XXX' })).toThrow('Неизвестная валюта');
    expect(() => parseMenuItem({ ...base, tags: ['sale'] })).toThrow('Неизвестная пометка блюда');
  });
  it('без имени или цены создать нельзя, частично можно', () => {
    expect(() => parseMenuItem({ price: 100, currency: 'KZT' })).toThrow('Некорректный текст');
    expect(parseMenuItem({ price: 100 }, true)).toEqual({ price: 100 });
  });
});

describe('parseLocationMenuItem', () => {
  it('стоп-лист и своя цена филиала', () => {
    expect(parseLocationMenuItem({ available: false, priceOverride: 490000 })).toEqual({
      available: false,
      priceOverride: 490000,
    });
    expect(parseLocationMenuItem({ priceOverride: null })).toEqual({ priceOverride: null });
  });
  it('пустое переопределение отклоняется', () => {
    expect(() => parseLocationMenuItem({})).toThrow('Пустое переопределение');
  });
});

describe('effectiveMenuItem', () => {
  const item = { price: 590000n, active: true };
  it('без строки переопределения блюдо видно и в наличии по цене каталога', () => {
    expect(effectiveMenuItem(item, null)).toEqual({
      visible: true,
      available: true,
      price: 590000n,
    });
  });
  it('стоп-лист скрывает наличие, но не блюдо; выключение скрывает блюдо', () => {
    expect(
      effectiveMenuItem(item, { enabled: true, available: false, priceOverride: null }),
    ).toMatchObject({ visible: true, available: false });
    expect(
      effectiveMenuItem(item, { enabled: false, available: true, priceOverride: null }),
    ).toMatchObject({ visible: false, available: false });
  });
  it('цена филиала перекрывает каталог, архив каталога скрывает блюдо везде', () => {
    expect(
      effectiveMenuItem(item, { enabled: true, available: true, priceOverride: 490000n }).price,
    ).toBe(490000n);
    expect(effectiveMenuItem({ ...item, active: false }, null).visible).toBe(false);
  });
});
