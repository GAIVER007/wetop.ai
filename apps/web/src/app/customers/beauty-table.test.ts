import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
import { BeautyCustomersTable } from './beauty-table';
import { BeautyCustomerTools } from './customer-tools';

vi.mock('server-only', () => ({}));

describe('Дата последнего визита клиента салона', () => {
  it('разделяет создание клиента и единый вход в импорт CSV или XLSX', () => {
    const table = renderToStaticMarkup(createElement(BeautyCustomersTable, {
      items: [], canCreate: true,
    }));
    const tools = renderToStaticMarkup(createElement(BeautyCustomerTools, {
      canEdit: true, scopeKey: 'business:location', showCreate: false,
    }));
    expect(table).toContain('Добавить клиента');
    expect(table).not.toContain('Импортировать клиентов');
    expect(table).not.toContain('Новый клиент добавляется при создании записи');
    expect(tools).toContain('Импортировать клиентов');
    expect(tools).toContain('CSV или XLSX');
    expect(tools).not.toContain('Добавить клиента');
  });
  it('не предлагает создание в режиме чтения', () => {
    const table = renderToStaticMarkup(createElement(BeautyCustomersTable, { items: [] }));
    const tools = renderToStaticMarkup(createElement(BeautyCustomerTools, {
      canEdit: false, scopeKey: 'business:location', showCreate: false,
    }));
    expect(table).not.toContain('Добавить клиента');
    expect(tools).not.toContain('Импортировать клиентов');
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
