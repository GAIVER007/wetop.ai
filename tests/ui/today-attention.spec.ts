import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Очередь «Требуют внимания» (PR A3, ТЗ `plans/tz-today-2026-09-27.md` §5, §12.1; план `plans/today-a3-2026-09-28.md`),
 * с 09.10.2026 живёт на едином экране «Финансы» (plans/finance-home-merge-2026-10-09.md):
 * одна очередь Critical → Warning → Info, у каждой строки одно действие. Числа берутся из того же подставного API, что
 * рисует экран: тест сверяет очередь с данными, а не с заученными числами.
 */
const fixture = FIXTURE_API;
const asClient = { headers: { 'x-wetop-test-client': '1' } };

type Row = {
  confirmationNumber: string;
  unitCode: string | null;
  status: string;
  balanceMinor: string;
  adults: number;
  guestsRecorded: number;
  blockedReason: string | null;
};
type Day = { date: string; arrivals: Row[]; departures: Row[]; overdueArrivals: Row[] };
type Board = {
  rows: Array<{ unit: { code: string; housekeepingStatus: string } }>;
  unassigned: Array<{ confirmationNumber: string }>;
};
type Guard = { open: { total: number; critical: number } };

const RANK = { critical: 0, warning: 1, info: 2 } as const;
const waiting = (r: Row) => r.status === 'CONFIRMED' || r.status === 'TENTATIVE';

/** Ожидаемая очередь по данным подставного API: событие → важность и число */
async function expected(request: import('@playwright/test').APIRequestContext) {
  const day: Day = await (await request.get(`${fixture}/desk/today`, asClient)).json();
  const board: Board = await (
    await request.get(`${fixture}/chessboard?from=${day.date}&to=${day.date}`, asClient)
  ).json();
  const guard: Guard = await (await request.get(`${fixture}/guard/status`, asClient)).json();
  const hk = new Map(board.rows.map((r) => [r.unit.code, r.unit.housekeepingStatus]));
  const arrivals = day.arrivals.filter(waiting);
  const events: Record<string, { severity: keyof typeof RANK; count: number }> = {
    'incidents-critical': { severity: 'critical', count: guard.open.critical },
    unassigned: {
      severity: 'critical',
      count: new Set(board.unassigned.map((u) => u.confirmationNumber)).size,
    },
    'not-ready': {
      severity: 'critical',
      count: arrivals.filter((r) => r.unitCode && hk.get(r.unitCode) !== 'INSPECTED').length,
    },
    'no-show': { severity: 'warning', count: day.overdueArrivals.length },
    'departure-debt': {
      severity: 'warning',
      count: day.departures.filter((r) => BigInt(r.balanceMinor) > 0n).length,
    },
    'arrival-debt': {
      severity: 'warning',
      count: arrivals.filter((r) => BigInt(r.balanceMinor) > 0n).length,
    },
    dirty: {
      severity: 'warning',
      count: board.rows.filter((r) => r.unit.housekeepingStatus === 'DIRTY').length,
    },
    incidents: { severity: 'warning', count: guard.open.total - guard.open.critical },
    cards: {
      severity: 'info',
      count: arrivals.filter((r) => r.unitCode && (r.blockedReason || r.guestsRecorded < r.adults))
        .length,
    },
  };
  return events;
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('очередь: каждое событие дня с числом, важностью и одним действием; порядок Critical → Warning → Info', async ({
  page,
  request,
}) => {
  const events = await expected(request);
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const block = page.getByRole('region', { name: 'Требуют внимания' });
  for (const [key, e] of Object.entries(events)) {
    const item = block.locator(`[data-testid="attention-event"][data-event="${key}"]`);
    if (e.count === 0) {
      await expect(item, key).toHaveCount(0);
      continue;
    }
    await expect(item, key).toHaveAttribute('data-severity', e.severity);
    await expect(item, key).toHaveAttribute('data-count', String(e.count));
    const action = item.getByTestId('attention-action');
    await expect(action, key).toHaveCount(1);
    expect(await action.getAttribute('href'), key).toMatch(/^\//);
  }
  const order = await block
    .locator('[data-testid="attention-event"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-severity')));
  const ranks = order.map((s) => RANK[s as keyof typeof RANK]);
  expect(ranks, 'сначала критичное').toEqual([...ranks].sort((a, b) => a - b));

  // разбивка сверху — по важности, числа — суммы строк; счётчик в шапке — сумма всех
  const sum = (severity: keyof typeof RANK) =>
    Object.values(events)
      .filter((e) => e.severity === severity)
      .reduce((n, e) => n + e.count, 0);
  const tally = block.getByTestId('attention-tally');
  for (const severity of ['critical', 'warning', 'info'] as const)
    await expect(tally.locator(`[data-severity="${severity}"] strong`)).toHaveText(
      String(sum(severity)),
    );
  await expect(block.locator('.attention-count')).toHaveText(
    String(sum('critical') + sum('warning') + sum('info')),
  );
});

test('незаезд ведёт в бронь, долг — в счёт; брони строками с именем и номером', async ({
  page,
  request,
}) => {
  const day: Day = await (await request.get(`${fixture}/desk/today`, asClient)).json();
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const block = page.getByRole('region', { name: 'Требуют внимания' });
  const noShow = block.locator('[data-event="no-show"]');
  const first = day.overdueArrivals[0]!;
  const row = noShow.getByTestId('overdue-arrival').filter({ hasText: first.confirmationNumber });
  await expect(row).toHaveAttribute(
    'href',
    `/reservations/${first.confirmationNumber}#booking-actions`,
  );
  const debt = block.locator('[data-event="departure-debt"] .attention-item').first();
  await expect(debt).toHaveAttribute('href', /#booking-finance$/);
});

test('сторож не ответил — строк инцидентов нет, остальная очередь на месте', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/finance');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const block = page.getByRole('region', { name: 'Требуют внимания' });
  await expect(
    block.locator('[data-event="incidents"], [data-event="incidents-critical"]'),
  ).toHaveCount(0);
  await expect(block.locator('[data-event="no-show"]')).toHaveCount(1);
});

test('финансовый период в будущем не скрывает текущие задачи гостиницы', async ({ page }) => {
  await page.goto('/finance?from=2027-06-01&to=2027-06-30');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const block = page.getByRole('region', { name: 'Требуют внимания' });
  await expect(block).not.toContainText('Всё в порядке');
  await expect(block.getByTestId('attention-event').first()).toBeVisible();
});

/**
 * Снимки для визуального STOP после A3 (план §6): светлая и тёмная 1440, телефон 390, светлый и тёмный, и блок очереди
 * отдельно в натуральную величину. Высокое окно вместо склейки: закреплённые меню и шапка на склейке «плывут».
 * Данные — подставного API; на реальных данных Luxx снимает владелец на своём стенде (ADR-018).
 */
test('снимки панелей единых «Финансов»', async ({ page }) => {
  const dir = 'reports/finance-home-merge-2026-10-09';
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/finance');
      await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
      const block = page.getByRole('region', { name: 'Требуют внимания' });
      await expect(block.getByTestId('attention-event').first()).toBeVisible();
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `${dir}/today-${width}-${theme}.png` });
      await block.screenshot({ path: `${dir}/attention-${width}-${theme}.png` });
    }
  }
});
