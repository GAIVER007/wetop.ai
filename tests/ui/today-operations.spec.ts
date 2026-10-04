import { FIXTURE_API, expect, test, type Page } from './fixtures';

/** Главная руководителя: деньги и компактная полоса рисков на сегодня. */
const fixture = FIXTURE_API;

type Row = {
  confirmationNumber: string;
  unitCode: string | null;
  status: string;
  balanceMinor: string;
};
type Day = { date: string; arrivals: Row[]; departures: Row[]; debtMinor: string };
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

test('операционные карточки убраны, а риски дня остались', async ({ page }) => {
  const d = await day(page);
  await page.goto('/today');
  for (const name of ['Загрузка на сегодня', 'Гости сегодня', 'Состояние номеров'])
    await expect(page.getByRole('article', { name })).toHaveCount(0);
  await expect(page.getByTestId('owner-risks')).toContainText(tenge(d.debtMinor));
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
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
test('финансы будущего периода не скрывают текущие риски', async ({ page }) => {
  await page.goto('/today?date=2027-06-01');
  await expect(page.getByTestId('owner-risks')).toBeVisible();
});
test('сбой сторожа не скрывает показатели и действия', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/today');
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Требуют внимания', exact: true })).toBeVisible();
});
