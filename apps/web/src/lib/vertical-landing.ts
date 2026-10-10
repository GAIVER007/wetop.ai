export type WebVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
/**
 * Стартовый экран направления: салон и ресторан видят «Сегодня» (MV8); гостиница с 09.10.2026 живёт
 * одним разделом «Финансы» (plans/finance-home-merge-2026-10-09.md), `/today` ведёт туда редиректом.
 */
const LANDING: Record<WebVertical, string> = {
  HOSPITALITY: '/finance',
  BEAUTY: '/today',
  FOOD_SERVICE: '/today',
};
export function landingForVertical(vertical: WebVertical): string {
  return LANDING[vertical];
}
const routes: Record<WebVertical, string[]> = {
  // `/today` общий для всех направлений (MV8) и ни одному не принадлежит
  HOSPITALITY: [
    '/chessboard',
    '/reservations',
    '/guests',
    '/inventory',
    '/rooms',
    '/rates',
    '/channels',
    '/bar',
    '/hotel-settings',
    '/finance',
    '/management/analytics/occupancy',
    '/management/analytics/units',
    '/management/analytics/channels',
  ],
  // `/employees` и `/customers` общие для салона и ресторана: принадлежности нет, страница сама зовёт requireVertical
  BEAUTY: ['/calendar', '/appointments', '/services', '/beauty'],
  FOOD_SERVICE: [
    '/floor-plan',
    '/table-reservations',
    '/dining-areas',
    '/orders',
    '/kitchen',
    '/menu',
    '/payroll',
  ],
};
export function routeVertical(path: string): WebVertical | null {
  for (const vertical of Object.keys(routes) as WebVertical[]) {
    if (routes[vertical].some((root) => path === root || path.startsWith(`${root}/`)))
      return vertical;
  }
  return null;
}
