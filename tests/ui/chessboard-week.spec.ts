import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

for (const [from, to, direction, expectedFrom, expectedTo] of [
  ['2026-09-28', '2026-10-04', 'Следующая неделя', '2026-10-05', '2026-10-11'],
  ['2026-12-28', '2027-01-03', 'Следующая неделя', '2027-01-04', '2027-01-10'],
  ['2028-03-06', '2028-03-12', 'Предыдущая неделя', '2028-02-28', '2028-03-05'],
] as const) {
  test(`переход календарной недели: ${from} → ${expectedFrom}`, async ({ page }) => {
    await page.goto(`/chessboard?from=${from}&to=${to}`);
    await page.getByLabel('Шахматка: с', { exact: true }).fill('2020-01-01');
    await page.getByRole('link', { name: direction, exact: true }).click();
    await expect(page.getByLabel('Шахматка: с', { exact: true })).toHaveValue(expectedFrom);
    await expect(page.getByLabel('Шахматка: по', { exact: true })).toHaveValue(expectedTo);
    await expect(page.getByTestId('date-col')).toHaveCount(7);
    await expect(page).toHaveURL(`/chessboard?from=${expectedFrom}&to=${expectedTo}`);
    await page.reload();
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', expectedFrom);
    // SSR dates arrive before hydration. Exercise a client filter before testing popstate.
    await page.getByRole('button', { name: 'Номера', exact: true }).click();
    await expect(page.getByTestId('unit-row')).toHaveCount(16);
    await page.goBack();
    await expect(page).toHaveURL(`/chessboard?from=${from}&to=${to}`);
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', from);
  });
}

test('в неделе работают бронь, категории и создание на воскресенье', async ({ page }) => {
  await page.goto('/chessboard');
  const stay = page.getByTestId('stay-cell').first();
  const number = await stay.getAttribute('data-number');
  await stay.click();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText(number!);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.getByLabel('Категория на шахматке').selectOption('ROOM');
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  const group = page.getByTestId('category-row').first().getByRole('button');
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  const sunday = await page.getByTestId('date-col').last().getAttribute('data-date');
  // Стенд живёт вокруг «сегодня»: чья койка свободна в воскресенье, зависит от дня недели прогона —
  // берём первый номер, у которого последняя (воскресная) клетка свободна, как сделала бы смена
  const sundayFree = page
    .getByTestId('unit-row')
    .filter({ has: page.locator('td:last-child [data-testid="free-cell"]') })
    .first();
  const unitCode = await sundayFree.getAttribute('data-unit-code');
  await sundayFree.locator('[data-testid="free-cell"]').last().click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue(sunday!);
  const monday = new Date(`${sunday}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + 1);
  await expect(form.locator('[name="departureDate"]')).toHaveValue(
    monday.toISOString().slice(0, 10),
  );
  await expect(form.locator('[name="unitCode"]')).toHaveValue(unitCode!);
});

for (const theme of ['light', 'dark'] as const) {
  test(`неделя помещается на экране: ${theme}, обе панели и телефон`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/chessboard-week', { recursive: true });
    await page.emulateMedia({ colorScheme: theme });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/chessboard');
    const report = [];
    for (const width of [1440, 1024, 812, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page
        .locator('.board-wrap')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('date-col').first()).toBeInViewport({ ratio: 1 });
      await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      report.push({ width, overflow, violations: result.violations });
      await page.screenshot({ path: `reports/chessboard-week/${theme}-${width}.png` });
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
    // At mobile/tablet widths navigation is a drawer, so resize to desktop to collapse it.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click();
    await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
    expect(errors).toEqual([]);
    writeFileSync(`reports/chessboard-week/${theme}.json`, JSON.stringify(report, null, 2));
  });
}

test('по умолчанию видна текущая неделя с понедельника по воскресенье', async ({ page }) => {
  const monday = new Date(Date.now() + 5 * 3600_000);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  await page.goto('/chessboard');
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  await expect(page.getByLabel('Шахматка: с', { exact: true })).toHaveValue(
    monday.toISOString().slice(0, 10),
  );
  await expect(page.getByLabel('Шахматка: по', { exact: true })).toHaveValue(
    sunday.toISOString().slice(0, 10),
  );
  await expect(page.getByTestId('date-col').first().locator('.board__wd')).toHaveText('пн');
  await expect(page.getByTestId('date-col').last().locator('.board__wd')).toHaveText('вс');
  await expect(page.getByRole('link', { name: 'Неделя', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
});
