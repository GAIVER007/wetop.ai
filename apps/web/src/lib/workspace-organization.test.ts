import { expect, it } from 'vitest';
import { activeMenuRoute, menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
it('organizes the menu by tasks: desk screens first, groups only for multi-screen areas', () => {
  expect(menuSections.map((s) => s.id)).toEqual([
    'home',
    'chessboard',
    'reservations',
    'finance',
    'bar',
    'sales',
    'marketing',
    'reports',
    'inventory',
    'settings',
  ]);
  // «Отчёты» — группа: хаб REP1 и «Аналитика» вместе (поручение владельца 03.10)
  expect(menuSections.filter((s) => !s.direct).map((s) => s.id)).toEqual([
    'sales',
    'marketing',
    'reports',
    'settings',
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
  // «Организации» главного администратора лежат в «Настройках» последним пунктом (ADR-153)
  expect(menuSections.find((s) => s.id === 'settings')?.items.at(-1)?.href).toBe('/platform');
});
it('phone bottom bar: the four leading tabs, every one a direct tab', () => {
  expect(phoneNavigation.map((i) => i.href)).toEqual([
    '/today',
    '/chessboard',
    '/reservations',
    '/finance',
  ]);
});

// «Гости» переехали внутрь «Броней» (поручение владельца 09.10.2026): своей вкладки в меню нет,
// раздел открывается вкладкой на страницах /reservations и /guests, подсветка меню остаётся на «Бронях»
it('guests live inside the reservations section: no own menu tab, menu highlight stays on it', () => {
  expect(menuSections.flatMap((s) => s.items.map((i) => i.href))).not.toContain('/guests');
  expect(activeMenuRoute('/guests')).toBe('/reservations');
  expect(activeMenuRoute('/guests/birthdays')).toBe('/reservations');
  expect(activeMenuRoute('/guests/42')).toBe('/reservations');
  expect(activeMenuRoute('/reservations')).toBe('/reservations');
});
