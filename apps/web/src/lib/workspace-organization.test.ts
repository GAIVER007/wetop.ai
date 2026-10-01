import { expect, it } from 'vitest';
import { sidebarSections } from './navigation';
it('organizes workspace by tasks without duplicate home or control group', () => {
  expect(sidebarSections.map((s) => s.id)).toEqual([
    'home',
    'guests',
    'inventory',
    'sales',
    'finance',
    'analytics',
    'settings',
    'platform',
  ]);
  expect(sidebarSections.find((s) => s.id === 'guests')?.items.map((i) => i.href)).toEqual([
    '/chessboard',
    '/reservations',
    '/guests',
  ]);
  expect(
    sidebarSections.find((s) => s.id === 'settings')?.items.some((i) => i.href === '/journal'),
  ).toBe(true);
});
