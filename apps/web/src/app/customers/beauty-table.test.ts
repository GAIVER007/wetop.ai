import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BeautyCustomersTable } from './beauty-table';

describe('Дата последнего визита клиента салона', () => {
  it('показывает локальный день визита вместо предыдущего дня UTC', () => {
    const html = renderToStaticMarkup(createElement(BeautyCustomersTable, {
      items: [{
        id: 'synthetic-customer', firstName: 'Тестовый клиент', lastName: null,
        phone: null, status: 'ACTIVE', visits: 1,
        lastVisitAt: '2026-10-11T19:30:00.000Z',
        lastVisitLocalDate: '2026-10-12',
        avgCheckMinor: '800000', avgCheckCurrency: 'KZT', isVip: false, birthDate: null, birthdayInDays: null,
      }],
    }));
    expect(html).toContain('dateTime="2026-10-12"');
    expect(html).not.toContain('dateTime="2026-10-11"');
  });
});
