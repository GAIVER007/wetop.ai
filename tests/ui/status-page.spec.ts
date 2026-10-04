import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

/**
 * Страница статуса сервиса (H14, ADR-144): открывается без входа, говорит словами, работает ли WETOP,
 * по четырём частям. Смотрят её, когда войти не выходит, поэтому ни входа, ни меню рабочего места на ней нет.
 */
const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('без входа: всё работает, четыре части словами', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/status');
  await expect(page.getByRole('heading', { level: 1, name: 'Состояние WETOP' })).toBeVisible();
  await expect(page.getByTestId('status-overall')).toHaveAttribute('data-state', 'ok');
  await expect(page.getByTestId('status-overall')).toContainText('Все части WETOP работают.');
  for (const key of ['app', 'database', 'channels', 'booking'])
    await expect(page.getByTestId(`status-${key}`)).toContainText('Работает');
  await expect(page.locator('.topmenu')).toHaveCount(0);
  await context.close();
});

test('каналы с перебоями: общая плашка и строка каналов', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { channex: 'attention' } });
  await page.goto('/status');
  await expect(page.getByTestId('status-overall')).toHaveAttribute('data-state', 'degraded');
  await expect(page.getByTestId('status-channels')).toContainText('С перебоями');
  await expect(page.getByTestId('status-app')).toContainText('Работает');
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность: ${scheme}, ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/status');
      await expect(page.getByTestId('status-overall')).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations).toEqual([]);
    });
