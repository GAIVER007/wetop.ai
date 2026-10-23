import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createBarProductAction: vi.fn(), createBarCategoryAction: vi.fn() }));

import { ProductForm, productFieldErrors } from './catalog-forms';

/** Аудит салона 22.10.2026 P1: «Новый товар» показывал браузерное «Please fill out this field.» */
describe('«Новый товар»: свои русские сообщения', () => {
  it('пустые обязательные поля называются по-русски', () => {
    expect(productFieldErrors({ name: '', salePrice: '', unitsPerPackage: '', minimumStockUnits: '' })).toEqual({
      name: 'Укажите название товара',
      salePrice: 'Укажите цену продажи, например 4500',
      unitsPerPackage: 'Укажите, сколько штук в упаковке, например 1',
      minimumStockUnits: 'Укажите минимальный остаток, например 0',
    });
  });

  it('неверные числа называются словами, верная форма без ошибок', () => {
    expect(productFieldErrors({ name: 'Шампунь', salePrice: '45 00x', unitsPerPackage: '0', minimumStockUnits: '-1' })).toEqual({
      salePrice: 'Цена продажи: число, например 4500 или 4500,50',
      unitsPerPackage: 'Штук в упаковке: целое число больше нуля',
      minimumStockUnits: 'Мин. остаток: целое число, 0 или больше',
    });
    expect(productFieldErrors({ name: 'Шампунь', salePrice: '4 500', unitsPerPackage: '1', minimumStockUnits: '2' })).toEqual({});
  });

  it('форма выключает браузерные подсказки', () => {
    const html = renderToStaticMarkup(createElement(ProductForm, { categories: [], context: { propertyId: 'p', currency: 'KZT' } }));
    expect(html.toLowerCase()).toContain('novalidate=""');
  });
});
