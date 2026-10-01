import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('product tour changes real content and supports keyboard', async ({ page }) => {
  await page.goto('/');
  const tabs = page.getByRole('tablist', { name: 'Возможности WETOP' });
  await tabs.getByRole('tab', { name: 'ИИ-продавцы' }).click();
  await expect(page.getByRole('tabpanel', { name: 'ИИ-продавцы' })).toContainText(
    'Знания вашего бизнеса',
  );
  await tabs.getByRole('tab', { name: 'ИИ-продавцы' }).press('Home');
  await expect(tabs.getByRole('tab', { name: 'Брони и гости' })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Брони и гости' })).toBeVisible();
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await expect(page.locator('#workflow')).toContainText('Оплата связана с проживанием');
});

test('FAQ and explicit theme choice work', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByText('Можно продавать номера и отдельные койки?', { exact: true }).click();
  await expect(page.locator('#faq details[open]')).toContainText('отдельная единица');
});

for (const width of [390, 768, 1440]) {
  test(`complete landing fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('#workflow')).toBeVisible();
    await expect(page.locator('#faq')).toBeVisible();
    expect(
      await page.evaluate('document.documentElement.scrollWidth - innerWidth'),
    ).toBeLessThanOrEqual(1);
    await expect(page.locator('#features')).toContainText('Пример интерфейса');
  });
}

test('every product panel remains accessible in dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/');
  for (const name of [
    'Брони и гости',
    'Номерной фонд',
    'Каналы и тарифы',
    'Финансы',
    'ИИ-продавцы',
  ]) {
    await page.getByRole('tab', { name, exact: true }).click();
    const result = await new AxeBuilder({ page })
      .include('#features')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      result.violations.map((v) => v.id),
      name,
    ).toEqual([]);
  }
});

test('homepage explains the full product and keeps WETOP positioning', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toContainText('Центр управления');
  await expect(page.locator('.hero__brand')).toHaveText('WETOP.AI');
  await expect(page.locator('.hero')).not.toContainText('В одном ритме');
  for (const id of ['about', 'control', 'product-details', 'toolkit', 'ai-sellers']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.locator('#product-details h3')).toHaveCount(8);
  await expect(page.locator('#ai-sellers')).toContainText('Проверьте ответы');
});
