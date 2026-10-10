import { expect, it } from 'vitest';
import { CLOSED_ACCESS, activeItem, menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
it('organizes the menu by tasks: desk screens first, groups only for multi-screen areas', () => {
  expect(menuSections.map((s) => s.id)).toEqual([
    // «Финансы» первой вкладкой: единый раздел вместо Главной (plans/finance-home-merge-2026-10-09.md)
    'finance',
    'chessboard',
    'guests',
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
    '/finance',
    '/chessboard',
    '/guests',
    '/market',
  ]);
  // Группы на панели зовутся именем группы, не первым пунктом (ADR-157): «Финансы» и «Продажи»
  expect(phoneNavigation[0]!.label).toBe('Финансы');
  expect(phoneNavigation[3]!.label).toBe('Продажи');
});

// «Гости и бронирования» (поручение владельца 09.10.2026): вместо вкладок «Брони» и «Гости» одна вкладка меню,
// классический список броней открывается кнопкой на экране и подсвечивает ту же вкладку
it('guests and bookings are one menu tab: the reservations list has no tab of its own', () => {
  const hrefs = menuSections.flatMap((s) => s.items.map((i) => i.href));
  expect(hrefs).toContain('/guests');
  expect(hrefs).not.toContain('/reservations');
  for (const path of ['/guests', '/guests/birthdays', '/guests/42', '/reservations', '/reservations/20260927-ABC123'])
    expect(activeItem(path, 'HOSPITALITY', CLOSED_ACCESS), path).toMatchObject({ sectionId: 'guests', href: '/guests' });
});
