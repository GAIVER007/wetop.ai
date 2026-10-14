import { FIXTURE_API, expect, test, type Page } from './fixtures';

/** ADR-180: operations stay on Home; Finance keeps monetary indicators and period controls. */
const fixture = FIXTURE_API;

type Row = {
  confirmationNumber: string;
  unitCode: string | null;
  status: string;
  balanceMinor: string;
};
type Day = {
  date: string;
  arrivals: Row[];
  departures: Row[];
  debtMinor: string;
  counts: { arrivals: number; departures: number; toCheckIn: number; toCheckOut: number };
};
const asClient = { headers: { 'x-wetop-test-client': '1' } };
const tenge = (minor: string) => String(BigInt(minor) / 100n);

async function day(page: Page): Promise<Day> {
  return (await page.request.get(`${fixture}/desk/today`, asClient)).json();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('Главная показывает загрузку и события; Финансы остаются денежным экраном', async ({
  page,
}) => {
  const d = await day(page);
  await page.goto('/finance');
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(page.getByRole('article', { name })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
  await page.goto('/today');
  await expect(page.getByTestId('c-occupancy')).toBeVisible();
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
  await expect(page.getByRole('button', { name: 'Все задачи', exact: true })).toBeVisible();
});

test('события дня совпадают с /desk/today и не зависят от периода кассы', async ({ page }) => {
  const d = await day(page);
  await page.goto('/today?from=2027-06-01&to=2027-06-30');
  const today = page.getByRole('region', { name: 'Сегодня', exact: true });
  await expect(today.getByRole('link', { name: /^Заезды/ })).toContainText(
    String(d.counts.arrivals),
  );
  await expect(today.getByRole('link', { name: /^Выезды/ })).toContainText(
    String(d.counts.departures),
  );
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
  // блок «Деньги» с заглушками «Нет данных» не переехал: деньги считает касса
  for (const id of ['owner-paid', 'owner-refunds', 'owner-net-cash', 'owner-charged'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('owner-risks')).toBeVisible();
});

test('сбой сторожа не скрывает показатели и действия', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/today');
  await expect(page.getByTestId('c-occupancy')).toBeVisible();
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Все задачи', exact: true })).toBeVisible();
});
