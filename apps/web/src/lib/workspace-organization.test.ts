import { expect, it } from 'vitest';
import { activeMenuRoute, menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
// верхнее меню по решению владельца 17.10.2026 (черновик `plans/top-nav-draft-2026-10-17.html`): одна строка
// разделов у всех направлений, слова гостиницы «Шахматка», «Гости», «Номера»
it('organizes the menu by tasks: one row of sections shared by all verticals', () => {
  expect(menuSections.map((s) => [s.label, s.items.map((i) => i.href)])).toEqual([
    ['Главная', ['/today']],
    ['Журнал', ['/chessboard']],
    ['Персонал', ['/team', '/staff-schedule', '/payroll']],
    ['Клиенты', ['/guests', '/reservations']],
    ['Услуги', ['/inventory']],
    ['Статистика', ['/management/analytics', '/reports']],
    // «Бар» (ADR-157) стал разделом «Склад»
    ['Склад', ['/warehouse', '/bar', '/bar/consumables', '/bar/receipts', '/bar/products', '/bar/suppliers', '/bar/operations']],
    ['Финансы', ['/finance', '/reports/finance']],
    ['Настройки', ['/hotel-settings', '/channels', '/connections', '/incidents', '/journal', '/settings', '/platform']],
    // «Продвижение» (ADR-184) вместе с бывшими «Продажами»
    [
      'Продвижение',
      ['/marketing', '/marketing/ads', '/marketing/content', '/ai-agents', '/market', '/sales', '/marketing/budget', '/marketing/analytics'],
    ],
    ['Помощь', ['/help']],
  ]);
  // «Организации» главного администратора лежат в «Настройках» последним пунктом (ADR-ORG-PAGE)
  expect(menuSections.find((s) => s.id === 'settings')?.items.at(-1)?.href).toBe('/platform');
});
it('phone bottom bar: the four leading tabs; a group tab opens its first item under the group name', () => {
  expect(phoneNavigation.map((i) => [i.href, i.label])).toEqual([
    ['/today', 'Главная'],
    ['/chessboard', 'Журнал'],
    ['/guests', 'Клиенты'],
    ['/inventory', 'Услуги'],
  ]);
});

// «Гости и бронирования» (09.10.2026) одной вкладкой; с верхним меню 17.10.2026 список броней пункт той же вкладки
it('guests and bookings are one menu tab: the reservations list is an item of it', () => {
  const guests = menuSections.find((s) => s.id === 'clients');
  expect(guests?.items.map((i) => i.href)).toEqual(['/guests', '/reservations']);
  expect(activeMenuRoute('/guests')).toBe('/guests');
  expect(activeMenuRoute('/guests/birthdays')).toBe('/guests');
  expect(activeMenuRoute('/guests/42')).toBe('/guests');
  expect(activeMenuRoute('/reservations')).toBe('/reservations');
  expect(activeMenuRoute('/reservations/20260927-ABC123')).toBe('/reservations');
});
