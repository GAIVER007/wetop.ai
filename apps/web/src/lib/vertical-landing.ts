export type WebVertical = 'HOSPITALITY' | 'BEAUTY' | 'FOOD_SERVICE';
export function landingForVertical(vertical: WebVertical): string {
  void vertical;
  return '/today';
}
const routes: Record<WebVertical, string[]> = {
  HOSPITALITY: [
    '/today',
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
  if (path === '/today') return null;
  for (const vertical of Object.keys(routes) as WebVertical[]) {
    if (routes[vertical].some((root) => path === root || path.startsWith(`${root}/`)))
      return vertical;
  }
  return null;
}
