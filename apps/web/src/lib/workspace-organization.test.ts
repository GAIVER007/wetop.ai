import { expect, it } from 'vitest';
import { activeMenuRoute, menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
it('organizes the menu by tasks: desk screens first, groups only for multi-screen areas', () => {
  expect(menuSections.map((s) => s.id)).toEqual([
    'home',
    'chessboard',
    'guests',
    'finance',
    'sales',
    'marketing',
    'reports',
    'inventory',
    'settings',
  ]);
  // «Отчёты»: группа, хаб REP1 и «Аналитика» вместе (поручение владельца 03.10);
  // «Финансы»: группа с 09.10 (ADR-157), «Оплаты и касса» и «Бар» вместе
  expect(menuSections.filter((s) => !s.direct).map((s) => s.id)).toEqual([
    'finance',
    'sales',
    'marketing',
    'reports',
    'settings',
  ]);
  expect(menuSections.find((s) => s.id === 'finance')?.items.map((i) => i.href)).toEqual([
    '/finance',
    '/bar',
  ]);
  expect(menuSections.find((s) => s.id === 'sales')?.items.map((i) => i.href)).toEqual([
    '/market',
    '/channels',
    '/ai-agents',
  ]);
  expect(menuSections.find((s) => s.id === 'marketing')?.items.map((i) => i.href)).toEqual([
    '/marketing',
  ]);
  expect(
    menuSections.find((s) => s.id === 'settings')?.items.some((i) => i.href === '/journal'),
  ).toBe(true);
  // «Организации» главного администратора лежат в «Настройках» последним пунктом (ADR-ORG-PAGE)
  expect(menuSections.find((s) => s.id === 'settings')?.items.at(-1)?.href).toBe('/platform');
});
it('phone bottom bar: the four leading tabs; a group tab opens its first item under the group name', () => {
  expect(phoneNavigation.map((i) => i.href)).toEqual([
    '/today',
    '/chessboard',
    '/guests',
    '/finance',
  ]);
  // «Финансы» в шапке — группа (ADR-157): панель телефона зовёт её именем группы, не «Оплаты и касса»
  expect(phoneNavigation[3]!.label).toBe('Финансы');
});

// «Гости и бронирования» (поручение владельца 09.10.2026): вместо вкладок «Брони» и «Гости» одна вкладка меню,
// классический список броней открывается кнопкой на экране и подсвечивает ту же вкладку
it('guests and bookings are one menu tab: the reservations list has no tab of its own', () => {
  const hrefs = menuSections.flatMap((s) => s.items.map((i) => i.href));
  expect(hrefs).toContain('/guests');
  expect(hrefs).not.toContain('/reservations');
  expect(activeMenuRoute('/guests')).toBe('/guests');
  expect(activeMenuRoute('/guests/birthdays')).toBe('/guests');
  expect(activeMenuRoute('/guests/42')).toBe('/guests');
  expect(activeMenuRoute('/reservations')).toBe('/guests');
  expect(activeMenuRoute('/reservations/20260927-ABC123')).toBe('/guests');
});
