import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createBarSupplierAction: vi.fn() }));

import { SupplierForm } from './supplier-form';

const context = { propertyId: 'p1', currency: 'USD' } as never;

/** Владелец 25.10.2026, ТЗ склада п.D: «Новый поставщик» без Email и без казахского примера телефона */
describe('форма нового поставщика', () => {
  it('название и телефон, реквизиты необязательные, Email в форме нет', () => {
    const html = renderToStaticMarkup(createElement(SupplierForm, { context }));
    expect(html).toContain('name="name"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('name="details"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('Email');
    expect(html).not.toContain('+7 701');
    expect(html).toContain('необязательно');
  });
});
