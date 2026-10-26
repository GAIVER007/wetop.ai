import { test, expect } from '../ui/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { seed, date } from './tz11-helpers';

test('catalog customers mobile contact cards retain secondary existing metrics', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await f.book('10:00', 0, 0, 'Тест Александра-Вероника Длинное синтетическое имя клиента');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/customers');
  const table = page.locator('.beauty-customers-table');
  await expect(table.locator('thead')).not.toBeVisible();
  await expect(table.locator('[data-label="Последний визит"]')).toBeVisible();
  await expect(table.locator('[data-label="Средний чек"]')).toBeVisible();
  // единственная ссылка строки ведёт в карточку клиента (её проверяет customer-detail.spec)
  await expect(table.getByRole('link')).toHaveCount(1);
  await expect(table.getByRole('link')).toHaveAttribute('href', /^\/customers\/[0-9a-f-]+$/);
});

test('catalog services branch price duration precede secondary full catalog data', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await f.call(
    `/beauty/services/${f.services[0]!.id}/location`,
    { enabled: true, priceOverrideMinor: '1500000', durationOverrideMinutes: 75 },
    'put',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/services');
  const search = page.getByRole('searchbox', { name: 'Поиск услуг', exact: true });
  await expect(search).toBeVisible();
  expect((await search.boundingBox())!.width).toBeGreaterThanOrEqual(260);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const item = page
    .locator('[data-service-list="price"] .beauty-service-item')
    .filter({ hasText: 'Тест стрижка' })
    .first();
  // цена и длительность филиала в строке прайс-листа (вариант B, 25.10.2026)
  await expect(item).toContainText('75 мин');
  await expect(item).toContainText('15 000 ₸');
  await expect(item).not.toContainText('Нет завершённых визитов');
  await expect(item).not.toContainText('0%');
});

for (const width of [390, 768, 1440])
  for (const theme of ['light', 'dark'] as const)
    test(`catalog accessible reflow ${width} ${theme}`, async ({ page, request }) => {
      const f = await seed(page, request);
      await f.book('10:00');
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const route of ['customers', 'services']) {
        await page.goto(`/${route}?date=${date}`);
        if (route === 'customers') await expect(page.getByRole('table')).toBeVisible();
        else await expect(page.locator('[data-service-list="price"]')).toBeVisible();
        const axe = await new AxeBuilder({ page })
          .include('main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(axe.violations).toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBeTruthy();
      }
    });
