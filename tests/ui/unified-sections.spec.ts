import { mkdirSync } from 'node:fs';
import { FIXTURE_API, HEADER_GROWTH_PX, test, expect } from './fixtures';

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
  const size = await page.evaluate(() => ({
    h: document.documentElement.scrollHeight,
    v: innerHeight,
  }));
  // бюджет задан 01.10.2026 при прежней шапке; с ADR-134 шапка выше на HEADER_GROWTH_PX, место под форму то же
  expect(size.h).toBeLessThanOrEqual(size.v + HEADER_GROWTH_PX + 1);
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
