import { expect, it } from 'vitest';
import { menuSections, phoneNavigation } from './navigation';
// Строка вкладок (ADR-134): работа смены одним щелчком, группы только там, где экранов несколько
it('organizes the menu by tasks: desk screens first, groups only for multi-screen areas', () => {
  expect(menuSections.map((s) => s.id)).toEqual([
    'home',
    'chessboard',
    'reservations',
    'guests',
    'inventory',
    'sales',
    'finance',
    'analytics',
    'settings',
    'platform',
  ]);
  expect(menuSections.filter((s) => !s.direct).map((s) => s.id)).toEqual([
    'sales',
    'settings',
    'platform',
  ]);
  expect(menuSections.find((s) => s.id === 'sales')?.items.map((i) => i.href)).toEqual([
    '/rates',
    '/channels',
    '/ai-agents',
    '/website',
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
