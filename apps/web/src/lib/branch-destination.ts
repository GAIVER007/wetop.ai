/** Only collection routes survive a branch switch. Object IDs and query filters belong to the old branch. */
const pages = new Set([
  '/today',
  '/chessboard',
  '/reservations',
  '/guests',
  '/inventory',
  '/rooms',
  '/rooms/categories',
  '/rooms/availability',
  '/finance',
  '/management/analytics',
  '/management/analytics/occupancy',
  '/management/analytics/units',
  '/management/analytics/channels',
  '/channels',
  '/channels/connections',
  '/channels/mapping',
  '/channels/sync',
  '/channels/events',
  '/hotel-settings',
  '/hotel-settings/stay',
  '/hotel-settings/services',
  '/hotel-settings/directories',
  '/team',
  '/connections',
  '/incidents',
  '/journal',
  '/ai-agents',
  '/ai-seller',
  '/website',
  // SITE-1: выбор филиала на экране «Сайт и SEO» переключает стойку тем же действием и остаётся на экране
  '/marketing/site/editor',
  '/branches',
  '/platform',
]);
/** Экраны, общие для всех направлений: смена филиала любого направления на них остаётся на месте */
export const SHARED_BRANCH_DESTINATIONS: ReadonlySet<string> = new Set([
  '/management/analytics',
  '/marketing/site/editor',
]);
export function branchDestination(value: string): string {
  const path = value.split(/[?#]/, 1)[0] ?? '';
  if (pages.has(path)) return path;
  for (const root of ['/reservations', '/guests', '/ai-agents', '/ai-seller', '/website']) {
    if (path.startsWith(`${root}/`)) return root;
  }
  return path.startsWith('/units/') ? '/inventory' : '/today';
}
