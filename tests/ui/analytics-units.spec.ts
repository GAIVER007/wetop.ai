import { FIXTURE_API, expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Аналитика → По номерам» (REP3, план `plans/reports-hub-2026-10-02.md` §3): занятость каждого места —
 * те же клетки шахматки, что у «Загрузки», до единицы. Третья вкладка модуля: период и тип фонда общие,
 * сравнения с прошлым отрезком нет, денег в таблице нет (Q-251). Числа страницы сверяются с ответом
 * самого API фикстуры — итог обязан сходиться со строками.
 */
// адрес подставного API настраиваем: прогон на своих портах не ждёт общий стенд 4311 (приём support-queue)
const fixture = FIXTURE_API;
const report = 'reports/analytics-units-2026-10-02';
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
const monthFrom = `${today.slice(0, 8)}01`;
const monthTo = (() => {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
})();
const int = (text: string) => Number(text.replace(/\D/g, ''));

interface UnitRow {
  code: string;
  categoryCode: string;
  occupiedNights: number;
  blockedNights: number;
  arrivals: number;
}
interface UnitStatsJson {
  rows: UnitRow[];
  totals: { units: number; occupiedNights: number; blockedNights: number; arrivals: number };
  unassignedStays: number;
}

async function apiUnits(
  request: import('@playwright/test').APIRequestContext,
  fund = '',
): Promise<UnitStatsJson> {
  const res = await request.get(
    `${fixture}/desk/dashboard/units?from=${monthFrom}&to=${monthTo}${fund && `&fund=${fund}`}`,
    // подставной API пускает только тест-раннер (TESTING.md §4)
    { headers: { 'x-wetop-test-client': '1' } },
  );
  expect(res.ok()).toBe(true);
  return (await res.json()) as UnitStatsJson;
}

test.beforeEach(async ({ page }) => {
  await page.request.post(`${fixture}/__test/reset`);
});

test('вкладка по умолчанию за месяц: строки до единицы, итог равен сумме строк и ответу API', async ({
  page,
  request,
}) => {
  const api = await apiUnits(request);
  const main = page.getByRole('main');
  await page.goto('/management/analytics/units');
  await expect(
    main.getByTestId('pa-tabs').getByRole('link', { name: 'По номерам' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(main.getByRole('link', { name: 'Этот месяц' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(main.getByTestId('pa-units-meta')).toContainText('Занятость с');
  // сравнения с прошлым отрезком у вкладки нет — и переключателя нет
  await expect(main.getByTestId('pa-compare-toggle')).toHaveCount(0);

  const rows = main.getByTestId('pa-units-row');
  await expect(rows).toHaveCount(api.rows.length);
  await expect(main.getByTestId('pa-units-group')).toHaveCount(
    new Set(api.rows.map((r) => r.categoryCode)).size,
  );
  // итог — те же числа, что отдал API, и равен сумме строк по построению
  const total = main.getByTestId('pa-units-total');
  await expect(total).toContainText('Итого');
  expect(int((await total.locator('td').nth(0).innerText()).replace(/занято/, ''))).toBe(
    api.totals.occupiedNights,
  );
  expect(api.totals.occupiedNights).toBe(api.rows.reduce((s, r) => s + r.occupiedNights, 0));
  expect(api.totals.arrivals).toBe(api.rows.reduce((s, r) => s + r.arrivals, 0));
  // код места — ссылка в его карточку
  const first = api.rows[0]!;
  await expect(rows.first().getByRole('link', { name: first.code })).toHaveAttribute(
    'href',
    `/units/${encodeURIComponent(first.code)}`,
  );
  // брони без назначенного места не теряются молча
  if (api.unassignedStays > 0)
    await expect(main.getByTestId('pa-units-unassigned')).toContainText('без назначенного места');
  else await expect(main.getByTestId('pa-units-unassigned')).toHaveCount(0);
});

test('тип фонда режет строки; период из адреса работает, как у соседних вкладок', async ({
  page,
  request,
}) => {
  const all = await apiUnits(request);
  const rooms = await apiUnits(request, 'rooms');
  expect(rooms.rows.length).toBeLessThan(all.rows.length);
  const main = page.getByRole('main');
  await page.goto('/management/analytics/units?fund=rooms');
  await expect(main.getByTestId('pa-units-row')).toHaveCount(rooms.rows.length);
  await expect(main.getByTestId('pa-fund').getByRole('link', { name: 'Номера' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // один день — та же вкладка со стрелками дня
  await page.goto(`/management/analytics/units?date=${today}`);
  await expect(main.getByRole('link', { name: 'Сегодня' })).toHaveAttribute('aria-current', 'page');
  await expect(main.getByTestId('pa-day-next')).toBeVisible();
  await expect(main.getByTestId('pa-units-meta')).toContainText('Занятость на');
});

test('отказ API — словами на своём экране, не падение страницы', async ({ page }) => {
  await page.goto('/management/analytics/units?fund=apartments');
  // неизвестный тип фонда страница не передаёт в API — берётся весь фонд (как у «Загрузки»)
  await expect(page.getByTestId('pa-units-table')).toBeVisible();
  const down = await page.request.post(`${fixture}/__test/control`, {
    data: { failPath: '/desk/dashboard/units' },
  });
  expect(down.ok()).toBe(true);
  await page.goto('/management/analytics/units');
  await expect(page.getByTestId('pa-units-error')).toBeVisible();
});

test('телефон: таблица без горизонтальной прокрутки страницы', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/management/analytics/units');
  await expect(page.getByTestId('pa-units-table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и снимки, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/management/analytics/units');
    await expect(page.getByTestId('pa-units-total')).toBeVisible();
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations.map((v) => v.id)).toEqual([]);
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    await page.screenshot({
      path: `${report}/${theme}-1440.png`,
      caret: 'initial',
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${report}/${theme}-390.png`, caret: 'initial', fullPage: true });
  });
}
