export type WebVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
/**
 * Стартовый экран направления: салон и ресторан видят «Сегодня» (MV8), гостиница свою «Главную» на том же
 * `/today` (с 13.10.2026 снова отдельно от «Финансов», решение владельца поверх ADR-152).
 */
const LANDING: Record<WebVertical, string> = {
  HOSPITALITY: '/today',
  BEAUTY: '/today',
  FOOD_SERVICE: '/today',
};
export function landingForVertical(vertical: WebVertical): string {
  return LANDING[vertical];
}
/**
 * Рабочее поле направления: гостиница шахматка, салон журнал, ресторан брони столов.
 * Владелец 27.10.2026: «всегда при открытии сайта, программы, приложения открывалась шахматка, журнал, календарь.
 * У владельца главная».
 */
const WORKSPACE: Record<WebVertical, string> = {
  HOSPITALITY: '/chessboard',
  BEAUTY: '/calendar',
  FOOD_SERVICE: '/table-reservations',
};
/** Стартовый экран при открытии: владелец на Главной, «Личный кабинет» в «Моей работе», остальные в рабочем поле */
export function startScreen(
  vertical: WebVertical,
  role: 'OWNER' | 'MANAGER' | 'STAFF' | 'EMPLOYEE' | null,
): string {
  if (role === 'EMPLOYEE') return '/my-work';
  if (role === 'MANAGER' || role === 'STAFF') return WORKSPACE[vertical];
  return landingForVertical(vertical);
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
    // `/bar` общий для всех направлений (ADR-178): бар филиала, страница сама зовёт requireVertical
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
    '/waiter',
    '/menu',
    '/stock',
    // `/payroll` общий для ресторана и салона (зарплата §19.2): страница сама зовёт requireVertical
    // `/cashbox` общий для ресторана и салона (касса филиала §48): страница сама зовёт requireVertical
    '/drinks',
    '/restaurant-finance',
    '/restaurant-settings',
  ],
};
export function routeVertical(path: string): WebVertical | null {
  for (const vertical of Object.keys(routes) as WebVertical[]) {
    if (routes[vertical].some((root) => path === root || path.startsWith(`${root}/`)))
      return vertical;
  }
  return null;
}
