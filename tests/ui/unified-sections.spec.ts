import { mkdirSync } from 'node:fs';
import { FIXTURE_API, test, expect } from './fixtures';

const API = FIXTURE_API;
test.beforeEach(async ({ page, request }) => {
  await request.post(`${API}/__test/reset`);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('настройки: основные поля и сохранение помещаются на ноутбуке', async ({ page }) => {
  await page.goto('/hotel-settings');
  await expect(page.getByLabel('Название объекта')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeVisible();
  // До 09.10.2026 здесь мерилась высота всей формы (бюджет 01.10 плюс HEADER_GROWTH_PX). Вёрстка владельца (PR #340,
  // ADR-158) раскладывает настройки карточками в три колонки, и целиком форма в 1366×768 не помещается по замыслу.
  // Проверяется то, ради чего бюджет вводился: название объекта и кнопка сохранения видны без прокрутки.
  const inFirstScreen = async (box: { y: number; height: number } | null) =>
    box !== null && box.y >= 0 && box.y + box.height <= (await page.evaluate(() => innerHeight));
  expect(await inFirstScreen(await page.getByLabel('Название объекта').boundingBox())).toBe(true);
  expect(await inFirstScreen(await page.getByRole('button', { name: 'Сохранить изменения' }).boundingBox())).toBe(true);
});

test('интеграции: незавершённая настройка не называется подключением', async ({ page }) => {
  await page.goto('/connections');
  await expect(page.getByRole('navigation', { name: 'Интеграции' })).toContainText('Подключения');
  await expect(page.getByTestId('integration-environment')).toBeVisible();
});

test('адаптивный обзор разделов', async ({ page }) => {
  mkdirSync('reports/unified-sections-2026-10-01', { recursive: true });
  for (const route of [
    '/ai-agents',
    '/management/analytics',
    '/hotel-settings',
    '/hotel-settings/stay',
    '/hotel-settings/services',
    '/connections',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({
      path: `reports/unified-sections-2026-10-01/${route.replaceAll('/', '-')}.png`,
      fullPage: true,
      caret: 'initial',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const size = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      v: innerWidth,
    }));
    expect(size.w).toBeLessThanOrEqual(size.v + 1);
    await page.setViewportSize({ width: 1366, height: 768 });
  }
});
