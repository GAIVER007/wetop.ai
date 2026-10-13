import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

const evidence = '.design-only/evidence/calendar-visual';
for (const theme of ['light', 'dark'] as const) {
  test(`calendar feedback: ${theme}, month and booking preview`, async ({ page, request }) => {
    await request.post(`${FIXTURE_API}/__test/design-seed`);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/chessboard?from=2026-10-01&to=2026-10-31');
    await expect(page.getByTestId('board-period-button')).toContainText('октябрь 2026');
    await page.getByRole('link', { name: 'Следующий месяц', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-11-01&to=2026-11-30/);
    await page.getByRole('link', { name: 'Предыдущий месяц', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-10-01&to=2026-10-31/);
    await page.setViewportSize({ width: 1333, height: 973 });
    mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/${theme}-calendar.jpg` });
    await page.getByTestId('stay-cell').first().click();
    await expect(page.getByTestId('stay-preview')).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('[data-testid="stay-preview"]').analyze()).violations,
    ).toEqual([]);
    await page.getByTestId('stay-preview').screenshot({ path: `${evidence}/${theme}-preview.jpg` });
    await page.getByRole('button', { name: 'Закрыть предпросмотр', exact: true }).click();
    await expect(page.getByTestId('stay-preview')).toHaveCount(0);
  });
}

test('new booking cancel returns to the selected month and mobile actions fit', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard?from=2026-10-01&to=2026-10-31');
  await page.getByRole('link', { name: 'Новая бронь', exact: true }).click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form).toBeVisible();
  const cancel = form.getByRole('button', { name: 'Отмена', exact: true });
  await expect(cancel).toBeEnabled();
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/mobile-new-booking.jpg` });
  await cancel.click();
  await expect(page).toHaveURL(/chessboard\?from=2026-10-01&to=2026-10-31/);
  await expect(form).toHaveCount(0);
});

test('calendar has one search and keeps local filtering', async ({ page }) => {
  await page.goto('/chessboard?from=2026-10-01&to=2026-10-31');
  await expect(
    page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Вид', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Сегодня', exact: true })).toBeHidden();
  const search = page.getByLabel('Поиск в календаре');
  await expect(search).toBeVisible();
  await search.fill('R01');
  await expect(page.getByTestId('unit-row')).toHaveCount(1);
  await search.fill('');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.goto('/branches');
  await expect(
    page.getByRole('button', { name: 'Найти гостя или бронь', exact: true }),
  ).toBeVisible();
});
