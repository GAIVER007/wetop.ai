import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { FIXTURE_API } from './fixtures';
import { formatMoney } from '../../apps/web/src/lib/money';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function appliedPeriod(page: Page, request: APIRequestContext, to: string) {
  await expect(page).toHaveURL((url) => url.searchParams.get('to') === to);
  const main = page.getByRole('main');
  // итоги кассы одной строкой (аудит 22.10.2026 P1-3b: без блока «Финансовый обзор»), метка cash-summary прежняя
  const summary = main.getByTestId('cash-summary');
  await expect(summary).toHaveCount(1);
  await expect(summary).toBeVisible();
  await expect(main.getByTestId('period-form').getByLabel('Период: с', { exact: true })).toHaveValue('2026-09-30');
  await expect(main.getByTestId('period-form').getByLabel('Период: по', { exact: true })).toHaveValue(to);
  const response = await request.get(`${FIXTURE_API}/finance/operations?from=2026-09-30&to=${to}`, {
    headers: { 'x-wetop-test-client': '1' },
  });
  expect(response.ok()).toBe(true);
  const operations = (await response.json()) as {
    currency: string;
    paidMinor: string;
    incomeMinor: string;
  };
  await expect(summary.getByTestId('cash-period-income')).toHaveText(
    formatMoney(
      (BigInt(operations.paidMinor) + BigInt(operations.incomeMinor)).toString(),
      operations.currency,
    ),
  );
}

test('A28 cash: hydration preserves a native date edited before client scripts load', async ({
  page,
  request,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/_next/static/**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/finance?from=2026-09-30&to=2026-09-01', { waitUntil: 'commit' });
    const to = page.getByRole('main').getByTestId('period-form').getByLabel('Период: по', { exact: true });
    await to.fill('2026-09-30');
    await expect(to).toHaveValue('2026-09-30');
    release();
    await page.waitForLoadState('load');
    // Opening the actual client calendar proves its event handlers are ready.
    const calendarButton = to
      .locator('..')
      .getByRole('button', { name: 'Открыть календарь (Период: по)', exact: true });
    await calendarButton.click();
    await expect(page.getByRole('dialog', { name: 'Календарь', exact: true })).toBeVisible();
    await expect(to).toHaveValue('2026-09-30');
    await page.keyboard.press('Escape');
    await page.getByRole('main').getByTestId('period-form').getByRole('button', { name: 'Показать', exact: true }).click();
    await appliedPeriod(page, request, '2026-09-30');
  } finally {
    release();
    await page.unroute('**/_next/static/**/*.js');
  }
});

test('A28 cash: valid invalid valid periods and history preserve applied values', async ({
  page,
  request,
}) => {
  await page.goto('/finance?from=2026-09-30&to=2026-09-30');
  await appliedPeriod(page, request, '2026-09-30');
  const main = page.getByRole('main');
  await main.getByTestId('period-form').getByLabel('Период: по', { exact: true }).fill('2026-09-01');
  await main.getByTestId('period-form').getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get('to') === '2026-09-01');
  await expect(main.getByRole('alert')).toContainText('Проверьте даты');
  await expect(
    main
      .getByTestId('cash-summary')
      .getByTestId('cash-period-income'),
  ).toHaveText('Нет данных');
  await main.getByTestId('period-form').getByLabel('Период: по', { exact: true }).fill('2026-10-01');
  await main.getByTestId('period-form').getByRole('button', { name: 'Показать', exact: true }).click();
  await appliedPeriod(page, request, '2026-10-01');
  await main.getByTestId('period-form').getByLabel('Период: по', { exact: true }).fill('2026-10-02');
  await page.goto('/channels');
  await page.goBack();
  await appliedPeriod(page, request, '2026-10-01');
  await page.goBack();
  await expect(page).toHaveURL((url) => url.searchParams.get('to') === '2026-09-01');
  await expect(main.getByRole('alert')).toContainText('Проверьте даты');
  await page.goForward();
  await appliedPeriod(page, request, '2026-10-01');
});

test('A28 channels: delayed synthetic API keeps the current page heading through refresh', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { delayPath: '/channels/channex/connection', delayMs: 1500 },
  });
  await page.goto('/inventory');
  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name: 'Номерной фонд', exact: true }),
  ).toBeVisible();
  await page.goto('/channels', { waitUntil: 'commit' });
  const heading = page
    .getByRole('main')
    .getByRole('heading', { level: 1, name: 'Каналы продаж', exact: true });
  await expect(heading).toBeVisible();
  await expect(page.getByTestId('channels-loading')).toHaveCount(0);
  await expect(heading).toBeVisible();
  await page.reload();
  await expect(heading).toBeVisible();
  await expect(page.getByTestId('channels-loading')).toHaveCount(0);
});
