import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderView } from '../../lib/food-types';
import type { OrderContext } from './order-drawer';

const query = vi.hoisted(() => ({ value: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {} }),
  useSearchParams: () => new URLSearchParams(query.value),
}));
vi.mock('./order-drawer', () => ({ OrderDrawer: () => null }));
import { OrdersBoard } from './orders-board';

const ctx: OrderContext = {
  scopeKey: 'test-business:test-location',
  timezone: 'Asia/Almaty',
  write: false,
  refunds: false,
  areas: [],
  tables: [],
  employees: [],
  categories: [],
  menuItems: [],
};
const order = (number: number, waiter: string, openedAt: string): OrderView => ({
  id: String(number),
  number,
  status: 'NEW',
  tableId: null,
  table: null,
  waiter: { id: waiter, name: `Тестовый ${waiter}` },
  guestCount: 1,
  notes: null,
  totalMinor: '10000',
  paidMinor: '0',
  refundedMinor: '0',
  currency: 'KZT',
  openedAt,
  cookingAt: null,
  readyAt: null,
  servedAt: null,
  closedAt: null,
  updatedAt: openedAt,
  delayed: false,
  nextStatuses: [],
  items: [],
  payments: [],
  refunds: [],
});
const orders = [
  order(101, 'Первый', '2026-10-12T05:00:00Z'),
  order(102, 'Второй', '2026-10-12T06:00:00Z'),
  order(103, 'Первый', '2026-10-11T05:00:00Z'),
];
beforeEach(() => {
  query.value = '';
});

describe('restaurant employee and date toolbar', () => {
  it('keeps earlier open orders in the operational list and adds date/report controls', () => {
    const html = renderToStaticMarkup(
      createElement(OrdersBoard, { ctx, orders, date: '2026-10-12' }),
    );
    expect(html).toContain('№101');
    expect(html).toContain('№102');
    expect(html).toContain('№103');
    expect(html).toContain('Быстрый отчёт');
    expect(html).toContain('Открыть календарь');
    expect(html).toContain('Все сотрудники');
  });
  it('filters by the URL employee, including a historical waiter absent from the current employee catalog', () => {
    query.value = 'employee=Первый';
    const html = renderToStaticMarkup(
      createElement(OrdersBoard, { ctx, orders, date: '2026-10-12' }),
    );
    expect(html).toContain('№101');
    expect(html).toContain('№103');
    expect(html).not.toContain('№102');
    expect(html).toContain('Тестовый Первый');
  });
  it('does not silently show all employees when an unknown employee is selected', () => {
    query.value = 'employee=missing';
    const html = renderToStaticMarkup(
      createElement(OrdersBoard, { ctx, orders, date: '2026-10-12' }),
    );
    expect(html).not.toContain('№101');
    expect(html).not.toContain('№102');
    expect(html).toContain('Сотрудник недоступен');
  });
});
