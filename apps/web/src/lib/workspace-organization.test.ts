import { expect, it } from 'vitest';
import { menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
it('organizes the menu by tasks: desk screens first, groups only for multi-screen areas', () => {
  expect(menuSections.map((s) => s.id)).toEqual([
    'home',
    'chessboard',
    'reservations',
    'guests',
    'finance',
    'sales',
    'marketing',
    'reports',
    'inventory',
    'settings',
    'platform',
  ]);
  // «Отчёты»: группа, хаб REP1 и «Аналитика» вместе (поручение владельца 03.10);
  // «Финансы»: группа с 09.10 (ADR-152), «Оплаты и касса» и «Бар» вместе
  expect(menuSections.filter((s) => !s.direct).map((s) => s.id)).toEqual([
    'finance',
    'sales',
    'marketing',
    'reports',
    'settings',
    'platform',
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
});
it('phone bottom bar: the four desk screens, every one a direct tab', () => {
  expect(phoneNavigation.map((i) => i.href)).toEqual([
    '/today',
    '/chessboard',
    '/reservations',
    '/guests',
  ]);
});
