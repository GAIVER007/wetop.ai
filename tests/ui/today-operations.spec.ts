import { expect, test, type Page } from './fixtures';

/**
 * Главная, PR A2 (ТЗ `plans/tz-today-2026-09-27.md` §4, §12.1; план `plans/today-a2-2026-09-28.md`):
 * операционные блоки только на существующих данных. Ожидания берутся из того же подставного API,
 * что рисует экран, — тест сверяет экран с данными, а не с заученными числами.
 */
const fixture = 'http://127.0.0.1:4311';

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

test('заезды и выезды дня: строка на проживание, действие ведёт в существующий поток', async ({
  page,
}) => {
  const d = await day(page);
  await page.goto('/today');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  const arrivals = page.getByRole('region', { name: 'Заезды' });
  const departures = page.getByRole('region', { name: 'Выезды' });
  // время — объекта, не брони: у брони его нет (пробел плана §3.1)
  await expect(arrivals).toContainText('с 14:00');
  await expect(departures).toContainText('до 12:00');

  const pending = d.arrivals.filter((r) => r.status !== 'CHECKED_IN');
  expect(pending.length).toBeGreaterThan(0);
  for (const r of pending.slice(0, 6)) {
    const row = arrivals.getByTestId('event-row').filter({ hasText: r.confirmationNumber });
    await expect(row).toHaveCount(1);
    if (!r.unitCode) {
      await expect(row).toContainText('без ячейки');
      await expect(row.getByRole('link', { name: 'Назначить' })).toHaveAttribute(
        'href',
        `/chessboard?from=${d.date}&to=${d.date}#unassigned-stays`,
      );
    } else {
      await expect(row.getByRole('link', { name: 'Заселить' })).toHaveAttribute(
        'href',
        `/reservations/${r.confirmationNumber}#booking-actions`,
      );
    }
    if (BigInt(r.balanceMinor) > 0n) {
      await expect(row).toContainText('к оплате');
      expect(digits((await row.textContent()) ?? '')).toContain(tenge(r.balanceMinor));
    }
  }

  const staying = d.departures.filter((r) => r.status === 'CHECKED_IN');
  for (const r of staying.slice(0, 6)) {
    const row = departures.getByTestId('event-row').filter({ hasText: r.confirmationNumber });
    await expect(row.getByRole('link', { name: 'Выселить' })).toHaveAttribute(
      'href',
      `/reservations/${r.confirmationNumber}#booking-actions`,
    );
  }
  const gone = d.departures.filter((r) => r.status === 'CHECKED_OUT').length;
  if (gone) await expect(departures).toContainText(`уже выехали: ${gone}`);
  await expect(arrivals.getByRole('link', { name: /Все заезды дня/ })).toHaveAttribute(
    'href',
    `/reservations?arrival=${d.date}`,
  );
});

test('номерной фонд и уборка: числа шахматки дня, неисправности — блокировки ремонта', async ({
  page,
}) => {
  const d = await day(page);
  const board: Board = await (
    await page.request.get(`${fixture}/chessboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  const s = board.summary[d.date]!;
  await page.goto('/today');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  const fund = page.getByRole('region', { name: 'Номерной фонд' });
  await expect(fund.getByTestId('fund-occupied')).toHaveText(String(s.occupied));
  await expect(fund.getByTestId('fund-free')).toHaveText(String(s.free));
  await expect(fund.getByTestId('fund-blocked')).toHaveText(String(s.blocked));
  // занятость по категориям одной строкой: «Имя занято/всего»
  const first = board.rows[0]!.unit;
  const cat = board.byCategory[d.date]![first.accommodationTypeCode]!;
  await expect(fund.getByTestId('fund-categories')).toContainText(
    `${first.accommodationTypeName} ${cat.occupied}/${cat.units}`,
  );

  const count = (status: string) =>
    board.rows.filter((r) => r.unit.housekeepingStatus === status).length;
  const care = page.getByRole('region', { name: 'Уборка и неисправности' });
  await expect(care.getByTestId('housekeeping-dirty')).toHaveText(String(count('DIRTY')));
  await expect(care.getByTestId('housekeeping-clean')).toHaveText(String(count('CLEAN')));
  await expect(care.getByTestId('housekeeping-inspected')).toHaveText(String(count('INSPECTED')));
  const broken = board.rows.filter((r) =>
    ['MAINTENANCE', 'OUT_OF_ORDER'].includes(r.cells[0]?.blockType ?? ''),
  ).length;
  await expect(care.getByTestId('repair-count')).toHaveText(String(broken));
});

test('финансовые показатели совпадают с dashboard API и не подменяют расходы нулём', async ({
  page,
}) => {
  const d = await day(page);
  const { current: c } = await (
    await page.request.get(`${fixture}/desk/dashboard?from=${d.date}&to=${d.date}`, asClient)
  ).json();
  await signIn(page);
  await page.goto('/today');
  for (const [id, amount] of [
    ['owner-charged', c.revenue.totalMinor],
    ['owner-paid', c.payments.totalMinor],
    ['owner-refunds', c.refundsMinor],
  ]) {
    expect(digits(await page.getByTestId(id).locator('strong').innerText())).toBe(tenge(amount));
  }
  await expect(page.getByTestId('owner-expenses')).toContainText('Не подключён');
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
});
test('финансы будущего периода не меняют текущую уборку', async ({ page }) => {
  await page.goto('/today?date=2027-06-01');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Уборка и неисправности' }).getByTestId('housekeeping-dirty'),
  ).toBeVisible();
});
test('сбой сторожа не скрывает показатели и действия', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/today');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await expect(page.getByTestId('owner-guests')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Контроль системы' })).toHaveAttribute(
    'href',
    '/incidents',
  );
});
