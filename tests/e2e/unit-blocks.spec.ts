import { expect, test } from '@playwright/test';

/** Срез 5, B2: блокировка ячейки видна в шахматке и уменьшает доступность; снятие возвращает; статус уборки меняется. */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const FROM = plus(40);
const TO = plus(42);

test('заблокировать свободную койку на 2 ночи → шахматка красит, свободных −1 → снять → как было; уборка', async ({
  page,
}) => {
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  await page
    .getByTestId('new-reservation-form')
    .locator('select[name="accommodationTypeCode"]')
    .selectOption('exely-5074688');
  const unitCode = (await page
    .getByTestId('new-reservation-form')
    .locator('select[name="unitCode"] option')
    .nth(1)
    .getAttribute('value'))!;
  const freeBefore = Number(
    /свободно (\d+)/.exec((await page.getByTestId('availability').textContent()) ?? '')?.[1],
  );

  await page.goto(`/units/${unitCode}`);
  await expect(page.getByRole('heading', { name: new RegExp(`Ячейка ${unitCode}`) })).toBeVisible();
  const form = page.getByTestId('block-form');
  await form.locator('input[name="dateFrom"]').fill(FROM);
  await form.locator('input[name="dateTo"]').fill(TO);
  await form.locator('select[name="type"]').selectOption('MAINTENANCE');
  await form.locator('input[name="reason"]').fill('тест: замена матраса');
  await form.getByRole('button', { name: 'Заблокировать' }).click();
  // на койке могут лежать чужие блоки (другие тесты, стойка) — считаем только свой, по причине
  const ownBlock = page.getByTestId('block-row').filter({ hasText: 'тест: замена матраса' });
  await expect(ownBlock).toHaveCount(1);
  await page.screenshot({ path: 'reports/screenshots/unit-block-card.png', fullPage: true });

  await page.goto(`/chessboard?from=${FROM}&to=${TO}`);
  const row = page
    .getByTestId('unit-row')
    .filter({ has: page.getByTestId('unit-link').filter({ hasText: unitCode }) });
  await expect(row.locator('td[data-state="BLOCKED"]')).toHaveCount(2);
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  expect(
    Number(
      /свободно (\d+)/.exec((await page.getByTestId('availability').textContent()) ?? '')?.[1],
    ),
  ).toBe(freeBefore - 1);

  await page.goto(`/units/${unitCode}`);
  await page.getByRole('button', { name: 'снять' }).click();
  await expect(ownBlock).toHaveCount(0);
  await page.goto(`/reservations/new?arrival=${FROM}&departure=${TO}`);
  expect(
    Number(
      /свободно (\d+)/.exec((await page.getByTestId('availability').textContent()) ?? '')?.[1],
    ),
  ).toBe(freeBefore);

  await page.goto(`/units/${unitCode}`);
  await page.getByTestId('hk-CLEAN').click();
  await expect(page.getByText('Статус уборки: убрано')).toBeVisible();
  await page.getByTestId('hk-DIRTY').click();
  await expect(page.getByText('Статус уборки: грязно')).toBeVisible();
});
