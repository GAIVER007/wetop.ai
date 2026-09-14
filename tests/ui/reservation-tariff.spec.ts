import { expect, test } from '@playwright/test';

/**
 * Тариф при изменении брони (plans/wetop-domain-2026-09-14.md, Б1 и Б8).
 * Б1: форма смены дат отправляла первый тариф списка — бронь молча переходила на него и теряла штраф за отмену.
 * Б8: «+1 ночь» у проживания без тарифа (перенесено из Exely) всегда получала отказ API и не давала выбрать тариф.
 */
const fixture = 'http://127.0.0.1:4311';
const number = '20260913-TESTAA';
type Command = { method: string; path: string; body: Record<string, unknown> };
const lastCommand = async (
  request: import('@playwright/test').APIRequestContext,
  path: string,
): Promise<Command | undefined> =>
  ((await (await request.get(`${fixture}/__test/commands`)).json()) as Command[])
    .filter((c) => c.path === path)
    .at(-1);

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('смена дат по умолчанию сохраняет текущий тариф брони', async ({ page, request }) => {
  await page.goto(`/reservations/${number}`);
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  const tariff = page.getByLabel('Тариф для пересчёта');
  await expect(tariff.locator('option:checked')).toContainText('оставить текущий');
  const departure = page
    .locator('form')
    .filter({ has: tariff })
    .locator('input[name="departureDate"]');
  const value = await departure.inputValue();
  const next = new Date(`${value}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  await departure.fill(next.toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Пересчитать и сохранить' }).click();
  await expect
    .poll(() => lastCommand(request, `/reservations/${number}/dates`))
    .toMatchObject({ method: 'PATCH' });
  const sent = await lastCommand(request, `/reservations/${number}/dates`);
  expect(sent!.body.ratePlanCode).toBeUndefined();
});

test('у брони без тарифа смена дат и «+1 ночь» просят выбрать тариф', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { withoutRatePlan: true } });
  await page.goto(`/reservations/${number}`);
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await expect(page.getByLabel('Тариф для пересчёта').locator('option:checked')).toContainText(
    'выберите тариф',
  );
  const extendTariff = page.getByLabel('Тариф для продления');
  await extendTariff.selectOption('BASE');
  await page.getByTestId('extend-ui-item').click();
  await expect
    .poll(() => lastCommand(request, `/reservations/${number}/items/ui-item/extend`))
    .toMatchObject({ method: 'POST', body: { nights: 1, ratePlanCode: 'BASE' } });
});

test('справочник тарифов не загрузился — карточка брони остаётся с предупреждением, а не экран ошибки', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/rate-plans' } });
  await page.goto(`/reservations/${number}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(`Бронь ${number}`);
  await page.getByRole('tab', { name: 'Действия', exact: true }).click();
  await expect(
    page.getByText('Справочник тарифов не загрузился').filter({ visible: true }),
  ).toBeVisible();
});
