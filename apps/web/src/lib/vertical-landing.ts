export type WebVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
/** Рабочий экран дня один на все направления (MV8): гостиница видит «Главную», салон и ресторан «Сегодня» */
const LANDING: Record<WebVertical, string> = {
  HOSPITALITY: '/today',
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
  ],
  BEAUTY: ['/calendar', '/appointments', '/employees', '/services', '/beauty'],
  FOOD_SERVICE: ['/floor-plan', '/table-reservations', '/dining-areas'],
};
export function routeVertical(path: string): WebVertical | null {
  for (const vertical of Object.keys(routes) as WebVertical[]) {
    if (routes[vertical].some((root) => path === root || path.startsWith(`${root}/`)))
      return vertical;
  }
  return null;
}
