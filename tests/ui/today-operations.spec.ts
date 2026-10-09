import { FIXTURE_API, expect, test, type Page } from './fixtures';

/** События дня на едином экране «Финансы»: заезды, выезды, долг дня и риски (бывшая Главная). */
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
  counts: { toCheckIn: number; toCheckOut: number };
};
const asClient = { headers: { 'x-wetop-test-client': '1' } };
const tenge = (minor: string) => String(BigInt(minor) / 100n);

async function day(page: Page): Promise<Day> {
  return (await page.request.get(`${fixture}/desk/today`, asClient)).json();
}

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('операционные карточки убраны, а риски дня остались', async ({ page }) => {
  const d = await day(page);
  await page.goto('/finance');
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(page.getByRole('article', { name })).toHaveCount(0);
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
});

test('события дня совпадают с /desk/today и не зависят от периода кассы', async ({ page }) => {
  const d = await day(page);
  await page.goto('/finance?from=2027-06-01&to=2027-06-30');
  const today = page.getByRole('region', { name: 'Сегодня', exact: true });
  await expect(today.getByRole('link', { name: /Заезды/ })).toContainText(
    String(d.counts.toCheckIn),
  );
  await expect(today.getByRole('link', { name: /Выезды/ })).toContainText(
    String(d.counts.toCheckOut),
  );
  await expect(page.getByTestId('c-debt')).toContainText(tenge(d.debtMinor));
  // блок «Деньги» с заглушками «Нет данных» не переехал: деньги считает касса
  for (const id of ['owner-paid', 'owner-refunds', 'owner-net-cash', 'owner-charged'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('owner-risks')).toBeVisible();
});

test('сбой сторожа не скрывает показатели и действия', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/finance');
  await expect(page.getByTestId('cash-period-income')).toBeVisible();
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
});
