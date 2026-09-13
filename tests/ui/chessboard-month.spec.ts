import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('месяц по умолчанию: с первого по последнее число, включая прошлые дни', async ({ page }) => {
  const today = new Date(Date.now() + 5 * 3600_000);
  const first = `${today.toISOString().slice(0, 7)}-01`;
  today.setUTCMonth(today.getUTCMonth() + 1, 0);
  const last = today.toISOString().slice(0, 10);
  await page.goto('/chessboard');
  await expect(page.getByLabel('Шахматка: с', { exact: true })).toHaveValue(first);
  await expect(page.getByLabel('Шахматка: по', { exact: true })).toHaveValue(last);
  await expect(page.getByTestId('date-col')).toHaveCount(Number(last.slice(8)));
  await expect(page.getByTestId('date-col').first().locator('.board__d')).toHaveText('01');
  await expect(page.getByTestId('date-col').last().locator('.board__d')).toHaveText(last.slice(8));
});

test('все 31 день помещаются по ширине окна', async ({ page }) => {
  await page.goto('/chessboard?from=2026-10-01&to=2026-10-31');
  await expect(page.getByTestId('date-col')).toHaveCount(31);
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.locator('.board-wrap').evaluate((el) => {
      const box = el as unknown as { scrollWidth: number; clientWidth: number };
      return box.scrollWidth - box.clientWidth;
    });
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('date-col').first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
  }
  await page.getByRole('button', { name: 'Свернуть панель', exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 1000 });
  await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
});

for (const [from, to, direction, expectedFrom, expectedTo] of [
  ['2026-10-01', '2026-10-31', 'Предыдущий месяц', '2026-09-01', '2026-09-30'],
  ['2026-12-01', '2026-12-31', 'Следующий месяц', '2027-01-01', '2027-01-31'],
  ['2027-03-01', '2027-03-31', 'Предыдущий месяц', '2027-02-01', '2027-02-28'],
  ['2028-01-01', '2028-01-31', 'Следующий месяц', '2028-02-01', '2028-02-29'],
] as const) {
  test(`переключение целого месяца: ${from} → ${expectedFrom}`, async ({ page }) => {
    await page.goto(`/chessboard?from=${from}&to=${to}`);
    // A previously edited date must not survive navigation into a different month.
    await page.getByLabel('Шахматка: с', { exact: true }).fill('2026-01-15');
    await page.getByRole('link', { name: direction, exact: true }).click();
    await expect(page.getByLabel('Шахматка: с', { exact: true })).toHaveValue(expectedFrom);
    await expect(page.getByLabel('Шахматка: по', { exact: true })).toHaveValue(expectedTo);
    await expect(page.getByTestId('date-col')).toHaveCount(Number(expectedTo.slice(8)));
    await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.reload();
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', expectedFrom);
  });
}

test('режимы 7/14 дней, произвольный период и возврат к месяцу', async ({ page }) => {
  await page.goto('/chessboard');
  for (const days of [7, 14]) {
    await page.getByRole('link', { name: `${days} дней`, exact: true }).click();
    await expect(page.getByTestId('date-col')).toHaveCount(days);
    await expect(page.getByRole('link', { name: 'Следующий период', exact: true })).toBeVisible();
  }
  await page.getByLabel('Шахматка: с', { exact: true }).fill('2028-02-10');
  await page.getByLabel('Шахматка: по', { exact: true }).fill('2028-02-20');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(11);
  await page.getByRole('link', { name: 'Месяц', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(29);
  await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', '2028-02-01');
  await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect(
    page
      .getByTestId('date-col')
      .filter({ has: page.locator('.board__d') })
      .first(),
  ).toHaveAttribute('data-date', /-01$/);
  await expect(page.locator('th.is-today')).toHaveCount(1);
});

test('в месяце открываются брони, свободные даты и группы номеров', async ({ page }) => {
  await page.goto('/chessboard');
  const stay = page.getByTestId('stay-cell').first();
  const number = await stay.getAttribute('data-number');
  await stay.click();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText(number!);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  const group = page.getByTestId('category-row').first().getByRole('button');
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const lastFree = page.locator('[data-unit-code="R03"] [data-testid="free-cell"]').last();
  const href = await lastFree.getAttribute('href');
  const expected = new URL(href!, 'http://127.0.0.1:3100');
  await lastFree.click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue(
    expected.searchParams.get('arrival')!,
  );
  await expect(form.locator('[name="departureDate"]')).toHaveValue(
    expected.searchParams.get('departure')!,
  );
  await expect(form.locator('[name="unitCode"]')).toHaveValue('R03');
});

for (const theme of ['light', 'dark'] as const) {
  test(`месячная сетка: ${theme}, читаемость и адаптивность`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/chessboard-month', { recursive: true });
    await page.emulateMedia({ colorScheme: theme });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/chessboard');
    const report = [];
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => {
        const browser = globalThis as unknown as {
          innerWidth: number;
          document: { documentElement: { scrollWidth: number } };
        };
        return {
          viewport: browser.innerWidth,
          content: browser.document.documentElement.scrollWidth,
        };
      });
      expect(layout.content).toBeLessThanOrEqual(width + 1);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      report.push({ width, layout, violations: result.violations });
      await page.screenshot({ path: `reports/chessboard-month/${theme}-${width}.png` });
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
    writeFileSync(`reports/chessboard-month/${theme}.json`, JSON.stringify(report, null, 2));
  });
}
