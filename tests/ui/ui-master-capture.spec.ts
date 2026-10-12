import { appendFileSync, mkdirSync } from 'node:fs';
import { FIXTURE_API, test } from './fixtures';

/**
 * Мастер-проход UI 11.10.2026: снимки «до» и «после» каждого маршрута гостиничного стенда и замеры
 * (переполнение по ширине, число H1, ошибки консоли). Только с `UI_MASTER_CAPTURE=before|after`,
 * в обычном прогоне набора пропускается. Отчёт: reports/ui-master-final-2026-10-11/.
 */
const phase = process.env['UI_MASTER_CAPTURE'];
const out = `reports/ui-master-final-2026-10-11/${phase}`;
test.skip(!phase, 'только для мастер-прохода: UI_MASTER_CAPTURE=before|after');

const ROUTES = [
  '/finance', '/today', '/calendar', '/chessboard', '/guests', '/guests/ui-guest', '/guests/birthdays',
  '/reservations', '/reservations/new', '/reservations/20260913-TESTAA',
  '/reservations/20260913-TESTAA/print', '/reservations/20260913-TESTAA/print/contract',
  '/reservations/20260913-TESTAA/print/invoice', '/inventory', '/units/R01', '/rooms', '/rooms/categories',
  '/rates', '/channels', '/channels/events/ui-rev-new-2', '/channel-manager', '/connections',
  '/connections/channex', '/tasks', '/hotel-settings', '/hotel-settings/stay', '/hotel-settings/services',
  '/hotel-settings/sales', '/hotel-settings/documents', '/services', '/bar', '/bar/products', '/bar/suppliers',
  '/bar/receipts', '/bar/receipts/new', '/bar/operations', '/sales', '/ai-seller', '/ai-seller/agents',
  '/ai-seller/agents/new', '/ai-agents', '/ai-agents/new', '/management', '/management/analytics',
  '/management/analytics/occupancy', '/management/analytics/units', '/management/analytics/channels',
  '/reports', '/reports/overview', '/reports/finance', '/reports/occupancy', '/reports/units',
  '/reports/form-910', '/reports/print?form=day', '/market', '/marketing', '/marketing/site',
  '/marketing/site/editor', '/marketing/site/assets', '/marketing/ads', '/marketing/content', '/website',
  '/website/settings', '/website/booking', '/website/analytics', '/platform', '/platform/support',
  '/branches', '/team', '/team/roles', '/staff', '/profile', '/profile/access', '/help', '/incidents',
  '/journal', '/status', '/onboarding', '/create', '/design-system', '/login', '/login/check-email',
  '/login/reset', '/login/set-password', '/login/verify', '/register', '/register/setup',
  '/register/complete', '/invite/fixture-invite-token', '/appointments', '/customers', '/employees',
  '/payroll', '/cashbox', '/floor-plan', '/dining-areas', '/table-reservations', '/menu', '/kitchen',
  '/orders', '/beauty', '/beauty/schedule', '/beauty/masters', '/beauty/services',
];

const VIEWS = (process.env['UI_MASTER_VIEWS'] ?? '1440:light,1440:dark,390:light')
  .split(',')
  .map((v) => {
    const [w, theme] = v.split(':');
    return { w: Number(w), h: Number(w) <= 390 ? 844 : Number(w) <= 1024 ? 768 : 900, theme: theme as 'light' | 'dark' };
  });

const slug = (r: string) => r.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'root';
const only = process.env['UI_MASTER_ROUTES']?.split(',');

test.beforeAll(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
});

for (const view of VIEWS) {
  for (const route of ROUTES.filter((r) => !only || only.includes(r))) {
    test(`${view.w} ${view.theme} ${route}`, async ({ page }) => {
      test.setTimeout(180_000);
      mkdirSync(out, { recursive: true });
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 200));
      });
      await page.emulateMedia({ colorScheme: view.theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: view.w, height: view.h });
      const res = await page.goto(route, { timeout: 150_000 });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${out}/${slug(route)}-${view.w}-${view.theme}.png`, fullPage: true });
      const m = await page.evaluate(`(() => ({
        url: location.pathname + location.search,
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        height: document.documentElement.scrollHeight,
        h1: [...document.querySelectorAll('h1')].filter(e => e.offsetParent !== null).map(e => e.textContent.trim().slice(0, 60)),
        nav: document.querySelector('.sidenav__current')?.textContent?.trim() ?? null,
      }))()`);
      appendFileSync(
        `${out}/metrics.jsonl`,
        JSON.stringify({ route, view: `${view.w}-${view.theme}`, status: res?.status(), errors, ...(m as object) }) + '\n',
      );
    });
  }
}
