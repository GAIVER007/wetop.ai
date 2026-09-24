import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('category creation, rename, room creation and reload', async ({ page }) => {
  await page.goto('/rooms/categories');
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await page.getByLabel('Название категории').fill('Тестовая новая категория');
  await expect(page.getByLabel('Тариф для категории')).toBeEnabled();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  const category = page.locator('.fund-category').filter({ hasText: 'Тестовая новая категория' });
  await expect(category).toBeVisible();
  await category.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Название категории').fill('Тестовая категория изменена');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const updated = page.locator('.fund-category').filter({ hasText: 'Тестовая категория изменена' });
  await updated.getByRole('button', { name: '+ Номер / койки', exact: true }).click();
  await page.getByLabel('Корпус', { exact: true }).fill('Тестовый корпус');
  await page.getByLabel('Этаж', { exact: true }).fill('1');
  await page.getByLabel('Обозначение комнаты', { exact: true }).fill('TEST-201');
  await page.getByLabel('Обозначение номера в шахматке').fill('TEST-201');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await updated.getByText(/Показать состав/).click();
  await expect(updated.getByRole('link', { name: 'Номер TEST-201', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Номерной фонд', exact: true })
    .getByRole('link', { name: 'Номера и койки' })
    .click();
  await expect(
    page.getByRole('link', { name: 'Открыть номер TEST-201', exact: true }),
  ).toBeVisible();
});
test('availability preserves exact unit and dates; responsive category design', async ({
  page,
}) => {
  await page.goto('/rooms/availability?arrival=2026-09-24&departure=2026-09-27');
  await expect(page.getByRole('heading', { name: 'Свободно на весь срок' })).toBeVisible();
  await page.locator('.fund-availability summary').first().click();
  const link = page.locator('.fund-book-unit').first();
  await expect(link).toHaveAttribute('href', /arrival=2026-09-24&departure=2026-09-27&unit=/);
  await link.click();
  await expect(
    page.getByRole('heading', { name: 'Новая бронь', exact: true, level: 1 }),
  ).toBeVisible();
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/rooms/categories');
    await expect(
      page.getByRole('heading', { name: 'Категории номеров', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.screenshot({ path: 'reports/fund-workspace-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'reports/fund-workspace-categories.png', fullPage: true });
  await page.goto('/rooms/availability?arrival=2026-09-24&departure=2026-09-27');
  await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('ROOM');
  await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('');
  await page.screenshot({ path: 'reports/fund-workspace-availability.png', fullPage: true });
});

test('dark categories and availability; invalid dates and empty onboarding', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.addInitScript(() => localStorage.setItem('wetop.theme', 'dark'));
  for (const path of ['/rooms/categories', '/rooms/availability']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('navigation', { name: 'Номерной фонд', exact: true }).waitFor();
    if (path.endsWith('categories'))
      await page.getByRole('textbox', { name: 'Поиск категории' }).fill('');
    else await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `reports/fund-workspace-${path.endsWith('categories') ? 'categories' : 'availability'}-dark.png`,
      fullPage: true,
    });
  }
  await page.goto('/rooms/availability?arrival=2026-09-27&departure=2026-09-24');
  await expect(page.getByText(/Выезд должен быть позже заезда/)).toBeVisible();
  await request.post('http://127.0.0.1:4311/__test/control', { data: { empty: true } });
  await page.goto('/rooms/categories');
  await expect(page.getByRole('heading', { name: 'Начните с категории размещения' })).toBeVisible();
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Создать категорию' })).toBeVisible();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await request.post('http://127.0.0.1:4311/__test/reset');
});
