import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

const SHOTS = 'reports/staff-forms-compact-2026-10-25';
async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Тестовый салон');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Тестовый салон', exact: true }).click();
  await page.waitForURL('**/today');
}

for (const width of [1440, 390]) {
  test(`compact staff forms: phone, email, access and layout at ${width}px`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(SHOTS, { recursive: true });
    await openSalon(page, request);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/employees');
    await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Новый специалист' });
    await expect(dialog.getByText(/^Бизнес:/)).toHaveCount(0);
    await expect(dialog.getByText(/^Филиал:/)).toHaveCount(0);
    await expect(dialog.getByRole('radio', { name: 'Специалист', exact: true })).toBeChecked();
    await expect(dialog.getByLabel('Имя', { exact: true })).toHaveAttribute('required', '');
    await expect(dialog.getByLabel('Фамилия', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Контакты', { exact: true })).toBeVisible();
    await dialog.getByLabel('Код страны').selectOption('+971');
    await dialog.getByLabel(/^Телефон/).fill('501234567');
    await expect(dialog.locator('input[name="phone"]')).toHaveValue('+971501234567');
    await dialog.getByLabel('Код страны').selectOption('+7');
    await dialog.getByLabel(/^Телефон/).fill('87010000000');
    await expect(dialog.locator('input[name="phone"]')).toHaveValue('+77010000000');
    await dialog.getByLabel(/^Телефон/).fill('');
    await expect(dialog.locator('input[name="phone"]')).toHaveValue('');
    await dialog.getByRole('combobox', { name: 'Уровень доступа' }).selectOption('PORTAL');
    await expect(dialog.getByLabel('Почта для входа')).toHaveAttribute('required', '');
    await expect(dialog.locator('details')).toHaveCount(0);
    expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('heading', { level: 2 }).click();
    await page.screenshot({ path: `${SHOTS}/specialist-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    // A dirty create dialog may ask before discarding the local draft.
    const discard = page.getByRole('button', { name: 'Не сохранять', exact: true });
    if (await discard.isVisible()) await discard.click();
    await page.goto('/team');
    await page.getByRole('button', { name: 'Пригласить сотрудника', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Пригласить сотрудника' });
    await expect(dialog.getByLabel('Почта для входа')).toHaveAttribute('required', '');
    await expect(dialog.getByRole('combobox', { name: 'Уровень доступа' })).toHaveValue('STAFF');
    await expect(dialog.getByLabel('Код страны')).toHaveValue('+7');
    expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const all = await dialog.getByLabel('Все филиалы', { exact: true }).boundingBox();
    const selected = await dialog.getByLabel('Выбрать филиалы', { exact: true }).boundingBox();
    expect(Math.abs(all!.y - selected!.y)).toBeLessThan(2);
    await dialog.getByRole('heading', { level: 2 }).click();
    await page.screenshot({ path: `${SHOTS}/invite-${width}.png`, fullPage: true });
  });
}

test('mobile create can stay and then discard a dirty draft', async ({ page, request }) => {
  await page.setViewportSize({ width: 600, height: 844 });
  await openSalon(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Новый специалист', exact: true });
  await panel.getByLabel('Имя', { exact: true }).fill('Тестовый черновик');
  const confirm = page.getByRole('dialog', { name: 'Несохранённые изменения', exact: true });
  await panel.getByRole('button', { name: 'Отмена', exact: true }).click();
  await confirm.getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(panel.getByLabel('Имя', { exact: true })).toHaveValue('Тестовый черновик');
  await panel.getByRole('button', { name: 'Отмена', exact: true }).click();
  await confirm.getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await expect(panel).toHaveCount(0);
});
