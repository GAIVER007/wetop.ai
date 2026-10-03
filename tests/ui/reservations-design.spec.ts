import { expect, test, devNoise, FIXTURE_API } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const report = 'reports/reservations-compact-2026-09-30';
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('выбранный статус броней доступен с клавиатуры и объявлен текущим', async ({ page }) => {
  await page.goto('/reservations');
  await expect(page.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(9);
  if (process.env.RESERVATIONS_DESIGN_BASELINE === '1') {
    mkdirSync(report, { recursive: true });
    await page.screenshot({ path: `${report}/before-1440.png`, caret: 'initial' });
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.screenshot({ path: `${report}/before-390.png`, caret: 'initial' });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const statuses = page.getByLabel('Статус брони');
  await expect(statuses).toHaveValue('ALL');
  await expect(statuses.locator('option[value="ALL"]')).toContainText('9');
  await statuses.selectOption('CONFIRMED');
  await page.getByRole('button', { name: 'Показать', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/status=CONFIRMED/);
  await expect(statuses).toHaveValue('CONFIRMED');
  await expect(page.getByTestId('directory-meta')).toContainText('Подтверждены');
});

test('мобильный статус и поиск сохраняются в URL, карточка открывается из списка', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/reservations');
  await page.getByLabel('Статус брони', { exact: true }).selectOption('CONFIRMED');
  await page.getByLabel('Поиск броней').fill('Тестовый');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/status=CONFIRMED/);
  await expect(page.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(1);
  await page.reload();
  // после перезагрузки уходящая страница на миг остаётся в скрытом узле стрима — ищем в видимом main
  const filters = page.getByRole('main');
  await expect(filters.getByLabel('Статус брони', { exact: true })).toHaveValue('CONFIRMED');
  await expect(filters.getByLabel('Поиск броней')).toHaveValue('Тестовый');
  await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Бронирование', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('reservations-table')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`Брони: ${theme}, читаемый список на пяти ширинах`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!devNoise.test(e.message)) errors.push(e.message);
    });
    page.on('console', (e) => {
      if (e.type() === 'error') errors.push(e.text());
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/reservations');
    // Переход в карточку подтверждает готовность клиента перед снимками.
    await page.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Бронирование', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('heading', { name: 'Брони', level: 1 }).click();
    await page.mouse.move(0, 0);
    mkdirSync(report, { recursive: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const table = page.getByTestId('reservations-table');
      await expect(table.locator('tbody tr')).toHaveCount(9);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      expect(
        await table.locator('..').evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      if (width <= 390) {
        expect((await table.locator('tbody tr').first().boundingBox())!.y).toBeLessThanOrEqual(450);
        const dates = page.getByRole('button', { name: 'Даты', exact: true });
        for (const control of [
          page.getByLabel('Статус брони', { exact: true }),
          dates,
          page.getByRole('button', { name: 'Показать', exact: true }),
        ]) {
          expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        // ручной период — за кнопкой «Даты» (ADR-106): в раскрытом виде цели тоже не меньше 44 px
        await dates.click();
        expect((await page.getByLabel('Период: с').boundingBox())!.height).toBeGreaterThanOrEqual(
          44,
        );
        await dates.click();
      }
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await page.screenshot({ path: `${report}/${theme}-${width}.png`, caret: 'initial' });
    }
    expect(errors).toEqual([]);
  });
}
