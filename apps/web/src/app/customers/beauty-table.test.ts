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
    expect(table).toContain('CSV или Excel');
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
        phone: null, status: 'ACTIVE', visits: 1, paidVisits: 1, noShows: 0,
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

describe('аудит 21.10.2026 п.24 и п.44: пустой список и панель клиентов', () => {
  it('пустой список это EmptyState с «Добавить клиента» и импортом, импорт в той же панели', () => {
    const html = renderToStaticMarkup(createElement(BeautyCustomersTable, {
      items: [], canCreate: true, tools: createElement('button', { type: 'button' }, 'Импортировать клиентов'),
    }));
    expect(html).toContain('empty-state');
    expect(html).toContain('Клиентов пока нет');
    // кнопка пустого состояния названа иначе, чем кнопка панели: на экране нет двух одинаковых кнопок
    expect(html).toContain('Добавить первого клиента');
    expect(html.match(/<button[^>]*>Добавить клиента</g)).toHaveLength(1);
    expect(html).toContain('CSV или Excel');
    expect(html).not.toContain('<td colSpan');
    // импорт стоит в одной строке с поиском, перед «Скачать Excel»
    const bar = html.slice(html.indexOf('beauty-customers-controls'));
    expect(bar.indexOf('Импортировать клиентов')).toBeGreaterThan(-1);
    expect(bar.indexOf('Имя или телефон')).toBeLessThan(bar.indexOf('Импортировать клиентов'));
    expect(bar.indexOf('Импортировать клиентов')).toBeLessThan(bar.indexOf('Скачать Excel'));
  });
});
