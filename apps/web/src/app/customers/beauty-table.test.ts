import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
import { BeautyCustomersTable } from './beauty-table';

vi.mock('server-only', () => ({}));

describe('Дата последнего визита клиента салона', () => {
  it('позволяет добавить клиента без визита, если разрешена запись', () => {
    const html = renderToStaticMarkup(createElement(BeautyCustomersTable, {
      items: [], canCreate: true, canImportPreview: true,
    }));
    expect(html).toContain('Добавить клиента');
    expect(html).toContain('Проверить CSV');
    expect(html).not.toContain('Новый клиент добавляется при создании записи');
  });
  it('не предлагает создание в режиме чтения', () => {
    const html = renderToStaticMarkup(createElement(BeautyCustomersTable, { items: [] }));
    expect(html).not.toContain('Добавить клиента');
    expect(html).not.toContain('Проверить CSV');
  });
  it('показывает локальный день визита вместо предыдущего дня UTC', () => {
    const html = renderToStaticMarkup(createElement(BeautyCustomersTable, {
      items: [{
        id: 'synthetic-customer', firstName: 'Тестовый клиент', lastName: null,
        phone: null, status: 'ACTIVE', visits: 1,
        lastVisitAt: '2026-10-11T19:30:00.000Z',
        lastVisitLocalDate: '2026-10-12',
        avgCheckMinor: '800000', avgCheckCurrency: 'KZT', isVip: false, birthDate: null, birthdayInDays: null,
      }],
      scopeKey: 'business-test:location-test',
    }));
    expect(html).toContain('dateTime="2026-10-12"');
    expect(html).not.toContain('dateTime="2026-10-11"');
  });
});
