import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { FoodWorkspace, StockMovementView, StockProductView } from '../../lib/food-types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
vi.mock('./stock-actions', () => ({ mutateStock: vi.fn(), loadLots: vi.fn() }));
vi.mock('./restaurant-actions', () => ({ mutateMenu: vi.fn(), dishPhoto: vi.fn() }));
vi.mock('./actions', () => ({ saveFoodCatalog: vi.fn() }));

import { MenuBoard } from './menu-board';
import { StockBoard } from './stock-board';
import { CatalogBoard } from './catalog-board';
import { ReservationForm } from './reservation-form';

const source = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

/** Тексты ресторана по аудиту 22.10.2026: меню, склад, залы и столы */
describe('меню: по-русски и с подсказкой без категорий', () => {
  it('нет «Food cost», есть «Себестоимость, %»', () => {
    const menu = source('./menu-board.tsx');
    expect(menu).not.toContain('Food cost');
    expect(menu).toContain('Себестоимость, %');
  });
  it('без категорий кнопка «+ Добавить блюдо» объясняет: «Сначала добавьте категорию»', () => {
    const html = renderToStaticMarkup(
      createElement(MenuBoard, { ctx: { scopeKey: 'b:l', write: true, currencyHint: '₸' }, categories: [], items: [] }),
    );
    expect(html).toContain('Сначала добавьте категорию');
  });
});

describe('склад: срок и время движений', () => {
  const product: StockProductView = {
    id: 'p', name: 'Соль', unit: 'г', minQty: '0', active: true, onHand: '10', valueMinor: '100', low: false,
    nearestExpiry: null, kind: 'RAW' as const,
  };
  const movement: StockMovementView = {
    id: 'm', productId: 'p', productName: 'Соль', unit: 'г', lotId: null, kind: 'RECEIPT', qty: '10',
    costMinor: '100', reason: null, createdAt: '2026-10-21T20:00:00.000Z',
  };
  const html = renderToStaticMarkup(
    createElement(StockBoard as never, {
      ctx: { scopeKey: 'b:l', currency: 'KZT', canDesk: true, canProperty: true, timezone: 'Asia/Almaty' },
      products: [product],
      movements: [movement],
    }),
  );
  it('у ингредиента без срока «Годен до» = «—», а не «Нет»', () => {
    expect(html).not.toMatch(/<td>Нет<\/td>/);
  });
  it('время движения в поясе филиала: приход в 01:00 по Алматы, не 20:00 UTC', () => {
    expect(html).toContain('22 окт., 01:00');
    expect(source('./stock-board.tsx')).not.toContain("toLocaleString('ru-RU'");
  });
});

describe('залы и столы', () => {
  const data = {
    areas: [{ id: 'a', name: 'Основной зал', sortOrder: 0, active: true }],
    tables: [
      { id: 't2', areaId: 'a', name: 'Стол 2', capacity: 4, sortOrder: 0, active: true },
      { id: 't10', areaId: 'a', name: 'Стол 10', capacity: 2, sortOrder: 0, active: true },
      { id: 't1', areaId: 'a', name: 'Стол 1', capacity: 1, sortOrder: 0, active: true },
    ],
    periods: [],
    reservations: [],
    date: '2026-10-22',
    time: '12:00',
    timezone: 'Asia/Almaty',
    scopeKey: 'b:l',
    readOnly: false,
    canDesk: true,
    canProperty: true,
  } as unknown as FoodWorkspace;
  const html = renderToStaticMarkup(createElement(CatalogBoard, { data }));
  it('склонения: «3 стола», «4 места», «2 места», «1 место»', () => {
    expect(html).toContain('3 стола');
    expect(html).toContain('4 места');
    expect(html).toContain('2 места');
    expect(html).toContain('1 место');
    expect(html).not.toMatch(/\d мест</);
    expect(html).not.toContain('3 столов');
  });
  it('столы по порядку и числу: Стол 1, Стол 2, Стол 10', () => {
    const order = ['Стол 1', 'Стол 2', 'Стол 10'].map((n) => html.indexOf(`<strong>${n}</strong>`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });
  it('окна называются «Новый зал / Новый стол / Новый период», а не «Добавить: Зал»', () => {
    const form = source('./catalog-form.tsx');
    expect(form).not.toContain("'Добавить'");
    for (const t of ['Новый зал', 'Новый стол', 'Новый период']) expect(form).toContain(t);
  });
});

describe('посадить без брони', () => {
  it('форма без браузерной проверки (noValidate), гость без брони сразу «Новый», имя необязательно', () => {
    const data = {
      areas: [{ id: 'a', name: 'Зал', sortOrder: 0, active: true }],
      tables: [{ id: 't', areaId: 'a', name: 'Стол 1', capacity: 4, sortOrder: 0, active: true }],
      periods: [{ id: 'p', name: 'Весь день', weekday: 4, timeFrom: '09:00', timeTo: '23:00', endsNextDay: false, defaultDurationMinutes: 120, active: true }],
      customers: [{ id: 'c', firstName: 'Айгерим', lastName: null, phone: null }],
      reservations: [],
      date: '2026-10-22',
      time: '12:00',
      timezone: 'Asia/Almaty',
      scopeKey: 'b:l',
      readOnly: false,
      canDesk: true,
      canProperty: true,
    } as unknown as FoodWorkspace;
    const html = renderToStaticMarkup(
      createElement(ReservationForm, { data, walkIn: true, tableId: 't', created: () => {}, onStale: () => {} }),
    );
    expect(html.toLowerCase()).toContain('novalidate');
    expect(html).toMatch(/<input type="radio" name="customerMode" checked=""[^>]*\/>Новый/);
    const first = html.match(/<input[^>]*name="firstName"[^>]*>/)?.[0] ?? '';
    expect(first).toContain('placeholder="Гость"');
    expect(first).not.toContain('required');
  });
});

describe('карточка оплаченного заказа', () => {
  it('не обещает «закроется сам»: после «Подать» заказ закрывают кнопкой «Закрыть заказ» (orderStatus SERVED не закрывает)', () => {
    const drawer = source('./order-drawer.tsx');
    expect(drawer).not.toContain('закроется сам');
    expect(drawer).toContain('Оплачено полностью. Когда заказ подадут, нажмите «Закрыть заказ».');
  });
});
