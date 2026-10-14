import { mkdirSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, devNoise, expect, test } from './fixtures';

/**
 * UI5 (plans/ui5-fullpass-2026-10-14.md): инструментальный аудит маршрутов, а не тест.
 * Включается только `UI5_AUDIT=1` и в гейте не бежит. Ничего не чинит и почти ничего не
 * утверждает: собирает по маршруту факты (перелив, мелкий текст, цели касания, h1,
 * ошибки консоли, axe в двух темах) в `reports/ui5-audit-2026-10-14/registry.json|md`.
 */
const OUT = 'reports/ui5-audit-2026-10-14';
const ROUTES: string[] = [
  '/today', '/chessboard', '/tasks',
  '/guests', '/guests?q=Тест', '/guests/ui-guest', '/guests/birthdays',
  '/reservations', '/reservations/new?unit=M03', '/reservations/20260913-TESTAA',
  '/inventory', '/units/R01', '/rooms/categories', '/rooms/availability',
  '/finance', '/finance?tab=cash', '/bar', '/bar/products', '/bar/receipts', '/bar/receipts/new',
  '/bar/suppliers', '/bar/operations',
  '/sales', '/market', '/channels', '/channels/events', '/channel-manager',
  '/ai-agents', '/ai-seller',
  '/marketing', '/marketing/ads', '/marketing/content', '/marketing/budget',
  '/marketing/budget/expenses', '/marketing/budget/analytics', '/marketing/analytics',
  '/website', '/website/booking', '/website/analytics', '/website/settings',
  '/reports', '/reports/overview', '/reports/finance', '/reports/occupancy', '/reports/units',
  '/reports/form-910',
  '/management/analytics', '/management/analytics/occupancy', '/management/analytics/channels',
  '/management/analytics/units',
  '/team', '/team/roles', '/profile', '/profile/access',
  '/branches', '/hotel-settings', '/hotel-settings/stay', '/hotel-settings/services',
  '/connections', '/connections/channex', '/journal', '/incidents',
  '/help', '/status', '/design-system',
  // семейство O: вход и регистрация (страницы без сессии)
  '/login', '/login/reset', '/register', '/create',
];
const VIEWS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
] as const;

type RouteReport = Record<string, unknown>;

test.describe(() => {
  test.skip(!process.env['UI5_AUDIT'], 'аудит включается только UI5_AUDIT=1');
  const registry: Record<string, RouteReport> = {};

  for (const route of ROUTES) {
    test(`аудит ${route}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      await request.post(`${FIXTURE_API}/__test/reset`);
      const consoleErrors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !devNoise.test(m.text())) consoleErrors.push(m.text().slice(0, 200));
      });
      const r: RouteReport = {};
      await page.goto(route);
      await expect(page.getByRole('main')).toBeVisible();
      for (const v of VIEWS) {
        await page.setViewportSize({ width: v.width, height: v.height });
        const facts = await page.evaluate((isPhone) => {
          const main = document.querySelector('main');
          const below: string[] = [];
          let minFont = 99;
          const seen = new Set<string>();
          for (const el of Array.from(document.querySelectorAll('main *'))) {
            const cs = getComputedStyle(el);
            if (el.textContent?.trim() && cs.display !== 'none' && cs.visibility !== 'hidden') {
              const fs = parseFloat(cs.fontSize);
              if (
                fs &&
                fs < minFont &&
                el.children.length === 0 &&
                (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })
              )
                minFont = fs;
            }
            if (
              isPhone &&
              (el.matches('button, a[href], input, select, [role="tab"]') as boolean) &&
              (el as HTMLElement).checkVisibility?.({ checkOpacity: true, checkVisibilityCSS: true })
            ) {
              const b = el.getBoundingClientRect();
              if (b.width > 0 && b.height > 0 && (b.height < 43.5 || b.width < 24)) {
                const key = `${el.tagName}:${(el.textContent || (el as HTMLElement).ariaLabel || '').trim().slice(0, 30)}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  below.push(`${key} ${Math.round(b.width)}x${Math.round(b.height)}`);
                }
              }
            }
          }
          return {
            overflowX: document.documentElement.scrollWidth - window.innerWidth,
            minFont: minFont === 99 ? null : minFont,
            h1: document.querySelector('main h1')?.textContent?.trim() ?? null,
            mainEmpty: !main || main.innerText.trim().length < 3,
            smallTargets: below.slice(0, 12),
          };
        }, v.name === '390');
        r[v.name] = facts;
      }
      // axe на 1440 в двух темах
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page
          .waitForFunction((t) => document.documentElement.dataset['theme'] === t, theme, { timeout: 5_000 })
          .catch(() => {});
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        r[`axe-${theme}`] = audit.violations.map((x) => `${x.id}×${x.nodes.length}`);
      }
      r['console'] = [...new Set(consoleErrors)].slice(0, 6);
      registry[route] = r;
      // свой файл на маршрут: перезапуск воркера после падения не стирает собранное
      mkdirSync(`${OUT}/routes`, { recursive: true });
      writeFileSync(`${OUT}/routes/${route.replace(/\W+/g, '-')}.json`, `${JSON.stringify({ [route]: r }, null, 1)}\n`);
    });
  }

  test.afterAll(() => {
    if (!Object.keys(registry).length) return;
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/registry.json`, `${JSON.stringify(registry, null, 1)}\n`);
    const lines = ['| Маршрут | h1 | перелив 1440/768/390 | мин. шрифт | целей <44 на 390 | axe light/dark | консоль |', '|---|---|---|---|---|---|---|'];
    for (const [route, r] of Object.entries(registry)) {
      const g = (w: string) => r[w] as Record<string, unknown> | undefined;
      const ov = ['1440', '768', '390'].map((w) => String((g(w)?.['overflowX'] as number) > 1 ? g(w)?.['overflowX'] : 0)).join('/');
      const fonts = ['1440', '390'].map((w) => g(w)?.['minFont']).join('→');
      lines.push(
        `| ${route} | ${g('1440')?.['h1'] ?? '—'} | ${ov} | ${fonts} | ${(g('390')?.['smallTargets'] as string[])?.length ?? 0} | ${(r['axe-light'] as string[]).length}/${(r['axe-dark'] as string[]).length} | ${(r['console'] as string[]).length} |`,
      );
    }
    writeFileSync(`${OUT}/registry.md`, `${lines.join('\n')}\n`);
  });
});
