import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BarStockRow } from '../../../lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../actions', () => ({
  setBarProductPriceAction: vi.fn(),
  toggleBarCatalogAction: vi.fn(),
  createBarProductAction: vi.fn(),
  createBarCategoryAction: vi.fn(),
}));

import { ProductsTable } from './products-table';
import { ProductPriceForm } from '../product-price-form';

const context = { propertyId: 'synthetic-property', currency: 'QAR' };
const juices = { id: 'cat-juice', name: 'Соки', defaultMarkupBasis: 3000, active: true } as never;
const row = (over: Partial<BarStockRow>): BarStockRow => ({
  id: 'p1', code: 'SOK-RICH', name: 'Сок Rich 0.2', categoryId: 'cat-juice', barcode: null, unitsPerPackage: 1,
  markupBasis: null, salePrice: '1500', minimumStockUnits: '3', active: true, category: juices,
  currency: 'QAR', availableUnits: '12', stockCostMinor: '0', lastUnitCostMinor: null, lastReceivedDate: null,
  lastSupplier: null, nearestExpiry: null, ...over,
});
const rights = { updateCatalog: true, archiveCatalog: true };

describe('«Склад: номенклатура» аккуратной таблицей (владелец 25.10.2026)', () => {
  it('отдельные колонки: товар с кодом под ним, категория, остаток, минимум, цена, действия; поиск и категория', () => {
    const html = renderToStaticMarkup(createElement(ProductsTable, {
      rows: [row({}), row({ id: 'p2', name: 'Вода Bonaqua', code: 'VODA', category: null, categoryId: null })],
      categories: [juices], context, rights, label: 'Товары бара',
    }));
    const head = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
    expect(head.match(/<th[^>]*>(.*?)<\/th>/g)?.map((th) => th.replace(/<[^>]+>/g, ''))).toEqual([
      'Товар', 'Категория', 'Остаток', 'Минимум', 'Цена продажи', 'Действия',
    ]);
    expect(html).toContain('class="bar-product-code"');
    expect(html).not.toContain('Минимум: 3 шт.');
    expect(html).toContain('aria-label="Поиск товара"');
    expect(html).toMatch(/<select[^>]*aria-label="Категория"/);
    expect(html).toContain('>Без категории<');
    expect(html).toContain('class="btn btn--ghost btn--xs"');
    expect(html).toContain('aria-label="Товары бара"');
  });

  it('цена: поле с валютой, кнопка сохранения скрыта, пока цена не изменена', () => {
    const html = renderToStaticMarkup(createElement(ProductPriceForm, { productId: 'p1', salePrice: '1500', context }));
    expect(html).toContain('class="bar-price-form__suffix"');
    expect(html).toContain('>QAR<');
    expect(html).not.toContain('aria-label="Сохранить цену"');
  });
});
