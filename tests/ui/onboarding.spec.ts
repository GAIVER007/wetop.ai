import { expect, test } from './fixtures';

/**
 * Онбординг нового отеля (plans/onboarding-2026-09-21.md): пока у объекта нет номеров, рабочие
 * экраны уводят на /onboarding; после «Запустить отель» — на рабочее место, и гейт больше не мешает.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { onboardingNeeded: true } });
});

test('пустой отель: рабочий экран уводит на онбординг, форма запускает отель', async ({ page }) => {
  // гейт: с рабочего экрана — на онбординг
  await page.goto('/today');
  await expect(page).toHaveURL(/\/onboarding/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Настройте отель', level: 1 })).toBeVisible();

  // название отеля показано и только для чтения
  await expect(main.getByLabel('Название', { exact: true })).toHaveValue('Luxx Aparts');

  // одна категория с ценой
  await main.getByLabel('Название категории').fill('Двухместный номер');
  await main.getByLabel('Гостей на место').fill('2');
  await main.getByLabel('Сколько мест').fill('3');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByRole('button', { name: 'Запустить отель' }).click();

  // отель настроен → на рабочее место, гейт больше не уводит
  await page.waitForURL('**/today');
  await expect(page).toHaveURL(/\/today/);
});

test('пустая категория без цены — форма просит добавить, отель не создаётся', async ({ page }) => {
  await page.goto('/onboarding');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Запустить отель' }).click();
  await expect(main.getByRole('alert')).toContainText(/хотя бы одну категорию/i);
  await expect(page).toHaveURL(/\/onboarding/);
});
