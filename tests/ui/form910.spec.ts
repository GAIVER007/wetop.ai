import AxeBuilder from '@axe-core/playwright';
import { expect, test, FIXTURE_API } from './fixtures';

/**
 * «Доход для формы 910» (K7, ADR-144): шесть месяцев полугодия, поступило минус возвращено, итог за полугодие и
 * разбивка по способам. Вход — карточка на хабе «Отчёты».
 */
const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('хаб ведёт на полугодие; шесть месяцев и итог', async ({ page }) => {
  await page.goto('/reports');
  await page.getByTestId('report-form910').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Доход для формы 910' })).toBeVisible();
  await page.goto('/reports/form-910?year=2026&half=2');
  await expect(page.getByTestId('form910-month')).toHaveCount(6);
  await expect(page.getByTestId('form910-month').first()).toContainText('Июль');
  await expect(page.getByTestId('form910-total')).toHaveText('48 000 ₸');
  await expect(page.getByTestId('form910-methods')).toContainText('Наличные');
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность: ${scheme}, ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/reports/form-910?year=2026&half=1');
      await expect(page.getByTestId('form910-total')).toBeVisible();
      const axe = await new AxeBuilder({ page })
        .include('main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(0);
    });
