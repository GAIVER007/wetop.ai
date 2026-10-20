/** Pure, Edge-compatible diagnostic projections: never serialize request or error objects. */
export const SETTINGS_DIAGNOSTIC_HEADER = 'x-wetop-settings-diag';
export function diagnosticsEnabled(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV === 'production') return false;
  return env.CI === 'true' && env.APP_UI_TEST === '1' &&
    env.WETOP_DIAG_HOTEL_SETTINGS === '1';
}
export function diagnosticId(raw: string | null | undefined): string {
  return raw && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw) ? raw : 'unbound';
}
export function settingsRequest(path: string, method = 'GET'): boolean {
  return path === '/hotel/settings' && method === 'GET';
}
export function routeClass(path: string): 'today' | 'chessboard' | 'static' | 'other' {
  const pathname = path.split('?')[0] ?? '';
  if (pathname === '/today') return 'today';
  if (pathname === '/chessboard') return 'chessboard';
  if (pathname.startsWith('/_next/static/') || pathname.startsWith('/_next/image') ||
      ['/favicon.ico', '/icon.svg'].includes(pathname)) return 'static';
  return 'other';
}
const SOURCES = ['lib/api.ts', 'lib/hotel-api.ts', 'lib/workspace-context.ts',
  'app/layout.tsx', 'app/onboarding-gate.tsx', 'app/today/page.tsx',
  'app/today/hospitality-today.tsx'];
export function callerFrames(stack: string | undefined): string[] {
  // Return constants only, not arbitrary function names, paths, line text or error messages.
  return SOURCES.filter(source => stack?.split('\n').slice(1).some(line =>
    line.includes(`/apps/web/src/${source}:`) || line.includes(`/src/${source}:`)));
}
export function incomingEvent(id: string, path: string, rsc: boolean, prefetch: boolean, ms = Date.now()) {
  return { event: 'settings-diag-incoming', id: diagnosticId(id), utc: new Date(ms).toISOString(),
    ms, route: routeClass(path), rsc, prefetch };
}
export function transportEvent(id: string, phase: 'start' | 'end' | 'throw', callers: string[], status?: number, ms = Date.now()) {
  return { event: 'settings-diag-transport', id: diagnosticId(id), utc: new Date(ms).toISOString(),
    ms, phase, callers: callers.filter(source => SOURCES.includes(source)),
    ...(phase === 'end' && Number.isInteger(status) && status! >= 100 && status! <= 599 ? { status } : {}) };
}
