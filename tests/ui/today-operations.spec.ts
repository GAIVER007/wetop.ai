import { expect, test, type Page } from './fixtures';

/**
 * Главная, PR A2 (ТЗ `plans/tz-today-2026-09-27.md` §4, §12.1; план `plans/today-a2-2026-09-28.md`):
 * операционные блоки только на существующих данных. Ожидания берутся из того же подставного API,
 * что рисует экран, — тест сверяет экран с данными, а не с заученными числами.
 */
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';

type Row = {
  confirmationNumber: string;
  unitCode: string | null;
  status: string;
  balanceMinor: string;
};
type Day = { date: string; arrivals: Row[]; departures: Row[]; debtMinor: string };
type Board = {
  summary: Record<string, { occupied: number; blocked: number; free: number }>;
  byCategory: Record<string, Record<string, { units: number; occupied: number }>>;
  rows: Array<{
    unit: {
      code: string;
      accommodationTypeCode: string;
      accommodationTypeName: string;
      housekeepingStatus: string;
    };
    cells: Array<{ state: string; blockType?: string | null }>;
  }>;
};

const asClient = { headers: { 'x-wetop-test-client': '1' } };
const digits = (text: string) => text.replace(/\D/g, '');
const tenge = (minor: string) => String(BigInt(minor) / 100n);

/** Сотрудником стенд делает только вошедшего: `/auth/me` без входа — роли нет */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

async function day(page: Page): Promise<Day> {
  return (await page.request.get(`${fixture}/desk/today`, asClient)).json();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('виджеты дня: загрузка, гости и состояние номеров — числа шахматки и стойки дня', async ({
  page,
}) => {
  const d = await day(page);
  const board: Board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date]!;
  await page.goto('/today');
  const load = page.getByRole('article', { name: 'Загрузка на сегодня' });
  await expect(load.getByTestId('tw-occupied')).toHaveText(String(s.occupied));
  await expect(load.getByTestId('c-free')).toHaveText(String(s.free));
  await expect(load.getByTestId('tw-total')).toHaveText(String(s.occupied + s.free + s.blocked));
  await expect(load.getByTestId('c-occupancy')).toContainText(
    `${Math.round((s.occupied * 100) / (s.occupied + s.free + s.blocked))} %`,
  );

  const count = (status: string) =>
    board.rows.filter((r) => r.unit.housekeepingStatus === status).length;
  const rooms = page.getByRole('article', { name: 'Состояние номеров' });
  await expect(rooms.getByTestId('tw-dirty')).toHaveText(String(count('DIRTY')));
  await expect(rooms.getByTestId('tw-clean')).toHaveText(String(count('CLEAN')));
  await expect(rooms.getByTestId('tw-inspected')).toHaveText(String(count('INSPECTED')));
  const broken = board.rows.filter((r) =>
    ['MAINTENANCE', 'OUT_OF_ORDER'].includes(r.cells[0]?.blockType ?? ''),
  ).length;
  await expect(rooms.getByTestId('tw-repair')).toHaveText(String(broken));
});

test('финансовые показатели совпадают с dashboard API и не подменяют расходы нулём', async ({
  page,
}) => {
  const d = await day(page);
  const { current: c } = await (
    await page.request.get(`${fixture}/desk/dashboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  await signIn(page);
  await page.goto('/today?period=today');
  for (const [id, amount] of [
    ['owner-charged', c.revenue.totalMinor],
    ['owner-paid', c.payments.totalMinor],
  ]) {
    expect(digits(await page.getByTestId(id).locator('strong').innerText())).toBe(tenge(amount));
  }
  expect(digits(await page.getByTestId('owner-refunds').innerText())).toBe(tenge(c.refundsMinor));
  // учёта расходов в модели нет — плитки с прочерком тоже нет (решение владельца 03.10)
  await expect(page.getByTestId('owner-expenses')).toHaveCount(0);
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
});
test('финансы будущего периода не меняют текущую уборку', async ({ page }) => {
  await page.goto('/today?date=2027-06-01');
  await expect(
    page.getByRole('article', { name: 'Состояние номеров' }).getByTestId('tw-dirty'),
  ).toBeVisible();
});
test('сбой сторожа не скрывает показатели и действия', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/today');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await expect(page.getByTestId('owner-guests')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
});
