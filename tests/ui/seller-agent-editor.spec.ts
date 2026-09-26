import { test, expect } from './fixtures';

test('агент из списка: редактирование, сохранение и повторное открытие', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.goto('/ai-seller/agents');
  await page.getByRole('link', { name: 'Тестовый агент', exact: true }).click();
  await page.getByLabel('Имя ассистента').fill('Обновлённый агент');
  await page.getByLabel('Основная цель').fill('Подобрать размещение');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toContainText('Настройки сохранены');
  await page.reload();
  await expect(page.getByLabel('Имя ассистента')).toHaveValue('Обновлённый агент');
  await expect(page.getByLabel('Основная цель')).toHaveValue('Подобрать размещение');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'reports/agent-handoff-2026-09-26/editor-390.png',
    fullPage: true,
  });
});

test('выключенный каталог объясняет состояние и не предлагает неработающее создание', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await request.post('http://127.0.0.1:4311/__test/agents-off');
  await page.goto('/ai-seller/agents');
  await expect(
    page.getByRole('heading', { name: 'Создание агентов пока недоступно' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Создать агента', exact: true })).toHaveCount(0);
  await expect(page.locator('main').last()).not.toContainText('HTTP 503');
  await expect(page.getByRole('link', { name: 'Настроить продавца гостиницы' })).toBeVisible();
});
