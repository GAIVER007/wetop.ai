import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Уборка на шахматке (21.09.2026, поручение владельца по снимку: «стрёмно написано „грязно“»).
 *
 * Было: у каждой грязной ячейки в колонке мест стояла жёлтая плашка со словом «грязно» — на 88 строках
 * это столбик одинаковых слов, и сделать с ним ничего нельзя: статус уборки ставился только в карточке
 * ячейки, на два перехода дальше. Стало: значок щётки с доступным именем (цвет плюс глиф, DESIGN.md §9)
 * и меню прямо в строке — «Убрано» и «Проверено», теми же командами, что в карточке.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('шахматка: уборка — значок со смыслом вместо слова в каждой строке, статус ставится в строке', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/chessboard');
  const dirty = main.getByTestId('unit-housekeeping');
  await expect(dirty).toHaveCount(2);
  // слова «грязно» в столбике мест больше нет — смысл несут значок и доступное имя
  await expect(main.locator('.board__unit').filter({ hasText: 'грязно' })).toHaveCount(0);
  const first = dirty.first();
  await expect(first).toHaveAttribute('data-status', 'DIRTY');
  await expect(first.getByRole('button')).toHaveAccessibleName(/убрать|грязн/i);

  // значок помещается в строку 38 px и остаётся целью не меньше 24 px (DESIGN.md §1 п. 3)
  const box = await first.getByRole('button').boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);
  expect(box!.height).toBeLessThanOrEqual(38);

  // меню в строке: «Убрано» и «Проверено» — те же команды, что в карточке ячейки
  await first.getByRole('button').click();
  const menu = page.getByRole('menu', { name: /уборк/i });
  await expect(menu.getByRole('menuitem', { name: 'Убрано' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Проверено' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /карточк/i })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Убрано' }).click();

  // итог назван словом, и строка перестала быть грязной
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /убрана/i })
      .first(),
  ).toBeVisible();
  await expect(main.getByTestId('unit-housekeeping')).toHaveCount(1);
});

test('шахматка: «Уборка» в фильтрах считает грязные места', async ({ page }) => {
  const main = page.getByRole('main');
  await page.goto('/chessboard');
  const chip = main.getByRole('button', { name: /^Уборка 2$/ });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(main.getByTestId('unit-row')).toHaveCount(2);
  await expect(main.getByTestId('unit-housekeeping')).toHaveCount(2);
});

test('карточка ячейки: текущий статус уборки словом, кнопки названы результатом', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/units/R01');
  const panel = main.getByTestId('housekeeping-panel');
  await expect(panel).toContainText('Сейчас грязно');
  await expect(panel.getByTestId('hk-CLEAN')).toHaveText('Убрано');
  await expect(panel.getByTestId('hk-INSPECTED')).toHaveText('Проверено');
  await expect(panel.getByTestId('hk-DIRTY')).toHaveCount(0);
  await panel.getByTestId('hk-CLEAN').click();
  await expect(panel).toContainText('Сейчас убрано');
  await expect(panel.getByTestId('hk-DIRTY')).toHaveText('Грязно');

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});
