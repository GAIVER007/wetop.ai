import { expect, test } from '@playwright/test';

/**
 * «Сверка с каналом» на обзоре каналов (X3, ADR-144): ежедневная сверка остатков PMS с тем, что видит канал, видна
 * владельцу. Свежая сверка — «расхождений нет»; канал видит больше мест — расхождение красным с числом ночей.
 */
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('свежая сверка без расхождений', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { channex: 'ok' } });
  await page.goto('/channels');
  const main = page.getByRole('main');
  await expect(main.getByTestId('channels-reconcile')).toHaveText('расхождений нет');
  await expect(main.getByTestId('channels-reconcile')).toHaveAttribute('data-tone', 'ok');
  await expect(main.getByTestId('channels-reconcile-sub')).toHaveAttribute('title', /проверено/);
});

test('канал видит больше мест: расхождение с числом ночей и что делает сторож', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { channex: 'attention' } });
  await page.goto('/channels');
  const main = page.getByRole('main');
  await expect(main.getByTestId('channels-reconcile')).toHaveText('расхождение: 2 ночи');
  await expect(main.getByTestId('channels-reconcile')).toHaveAttribute('data-tone', 'danger');
  await expect(main.getByTestId('channels-state')).toHaveText('требует внимания');
  await expect(main.getByTestId('overbooking-alarm')).toContainText('полную выгрузку');
});
