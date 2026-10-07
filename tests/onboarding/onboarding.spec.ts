import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:55804';
test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});
for (const vertical of ['BEAUTY', 'FOOD_SERVICE']) {
  test(`${vertical}: trusted adapter, persistence, back/next, completion, keyboard and axe`, async ({
    page,
    request,
  }) => {
    await request.post(`${api}/__test/reset`, { data: { vertical } });
    await page.goto('/register/setup?vertical=HOSPITALITY');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(
      vertical === 'BEAUTY' ? 'Настройте Beauty' : 'Настройте Food Service',
    );
    await main.getByLabel('Название бизнеса').fill('Новый тестовый бизнес');
    await main.getByRole('button', { name: 'Продолжить', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(main.getByLabel('Название филиала')).toBeVisible();
    await page.reload();
    await expect(main.getByLabel('Название филиала')).toBeVisible();
    await main.getByRole('button', { name: 'Назад', exact: true }).click();
    await expect(main.getByLabel('Название бизнеса')).toHaveValue('Новый тестовый бизнес');
    await main.getByRole('button', { name: 'Продолжить', exact: true }).click();
    for (const width of [1440, 390])
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await page.emulateMedia({ colorScheme: theme });
        await page.waitForTimeout(250);
        expect(
          (await new AxeBuilder({ page }).include('#main-content').analyze()).violations,
        ).toEqual([]);
        expect(
          await page.evaluate('document.documentElement.scrollWidth - innerWidth'),
        ).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: `reports/mv3-onboarding-2026-10-04/screenshots/${vertical}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    await main.getByLabel('Название филиала').fill('Сохранённый филиал');
    await main.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await expect(main.getByText('Сохранённый филиал', { exact: true })).toBeVisible();
    await main.getByRole('button', { name: 'Завершить настройку' }).click();
    // MV8: рабочий экран дня один на все направления
    const landing = /\/today$/;
    await expect(page).toHaveURL(landing);
    await page.reload();
    await expect(page).toHaveURL(landing);
    expect(await (await request.get(`${api}/onboarding`)).json()).toMatchObject({
      vertical,
      currentStep: 'review',
      draft: { businessName: 'Новый тестовый бизнес', locationName: 'Сохранённый филиал' },
      completedAt: expect.any(String),
    });
    const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
    expect(calls.some((p) => p.startsWith('/hotel'))).toBe(false);
  });
}
test('READ_ONLY displays data without mutation controls', async ({ page, request }) => {
  await request.post(`${api}/__test/reset`, { data: { vertical: 'BEAUTY', readOnly: true } });
  await page.goto('/register/setup');
  await expect(page.getByRole('main').getByLabel('Название бизнеса')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Продолжить', exact: true })).toHaveCount(0);
});
test('Hospitality existing categories persist on reload and provision real inventory', async ({
  page,
  request,
}) => {
  await request.post(`${api}/__test/reset`, { data: { vertical: 'HOSPITALITY' } });
  await page.goto('/register/setup');
  const main = page.getByRole('main');
  await main.getByLabel('Название категории').fill('Тестовый номер');
  await main.getByLabel(/Цена за ночь/).fill('21000');
  await main.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(main.getByRole('status')).toHaveText('Сохранено');
  await page.reload();
  await expect(main.getByLabel('Название категории')).toHaveValue('Тестовый номер');
  await main.getByRole('button', { name: 'Запустить отель' }).click();
  await page.waitForURL('**/today');
  expect(await (await request.get(`${api}/hotel/onboarding`)).json()).toMatchObject({
    needed: false,
  });
});
