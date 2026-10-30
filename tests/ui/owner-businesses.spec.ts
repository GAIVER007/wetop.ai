import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * «Все бизнесы» владельца, вариант C (владелец 30.10.2026: «3»): итог месяца по валютам (QAR и USD не складываются),
 * строка на каждый филиал и WETOP, «Перейти», полгода выручки, дела сегодня; на 1280 без прокрутки вбок.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signIn(page: Page, request: APIRequestContext, platformAdmin: boolean) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL(/\/(today|platform\/cabinet)$/);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin } });
}

test.describe.configure({ timeout: 120_000 });

test('все бизнесы: итог по валютам, строки WETOP и двух филиалов Luxx, переход', async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, request, true);
  // вход из меню: «Настройки» → «Все бизнесы»
  await page.goto('/today');
  // холодная сборка /today на стенде бывает дольше обычного ожидания
  const settings = page.getByRole('navigation', { name: 'Главное меню' }).getByRole('button', { name: 'Настройки' });
  await expect(settings).toBeVisible({ timeout: 60_000 });
  await settings.click();
  await page.getByRole('link', { name: 'Все бизнесы' }).first().click();
  await page.waitForURL('**/owner');
  const view = page.getByTestId('owner-businesses');
  await expect(view).toBeVisible();
  await expect(page.getByTestId('owner-total-QAR')).toContainText('Все бизнесы, QAR');
  await expect(page.getByTestId('owner-total-USD')).toContainText('Прибыль');
  const rows = page.getByTestId('owner-row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('WETOP');
  await expect(rows.nth(1)).toContainText('Luxx Aparts 1');
  await expect(rows.nth(2)).toContainText('Luxx Aparts 2');
  await expect(rows.nth(1)).toContainText('дел: 2');
  await expect(rows.nth(0).getByRole('link', { name: 'Кабинет WETOP' })).toHaveAttribute('href', '/platform/cabinet');
  // филиал другой организации: форма смены организации с подсказкой филиала
  const other = rows.nth(2).locator('form[action="/auth/organization"]');
  await expect(other.locator('input[name="organizationId"]')).toHaveValue('ui-org-2');
  await expect(other.locator('input[name="locationId"]')).toHaveValue('44444444-4444-4444-8444-444444444444');
  await expect(page.getByTestId('owner-chart-QAR')).toBeVisible();
  await expect(page.getByTestId('owner-todo')).toContainText('Luxx Aparts 1');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(wide).toBeLessThanOrEqual(0);
  if (process.env.CABINET_SHOTS) await page.screenshot({ path: `${process.env.CABINET_SHOTS}/owner-1280.png`, fullPage: true });
  // месяц назад
  await page.getByRole('link', { name: /Предыдущий месяц/ }).click();
  await page.waitForURL(/\/owner\?month=/);
  await expect(rows).toHaveCount(3);
});
