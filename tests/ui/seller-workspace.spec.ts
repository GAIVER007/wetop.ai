import { expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

test('живое превью имени и приветствия, сохранение шага и восстановление', async ({ page }) => {
  await page.goto('/ai-seller?step=1');
  const preview = page.getByRole('complementary', { name: 'Превью агента' });
  await expect(preview).toBeVisible();
  await page.getByLabel('Имя бота').fill('Тестовый помощник');
  await page.getByLabel('Приветствие').fill('Здравствуйте! Помогу выбрать номер.');
  await expect(preview).toContainText('Тестовый помощник');
  await expect(preview).toContainText('Здравствуйте! Помогу выбрать номер.');
  await page.getByTestId('seller-step-next').click();
  await expect(page).toHaveURL(/step=2/);
  await page.goto('/ai-seller?step=1');
  await expect(page.getByLabel('Имя бота')).toHaveValue('Тестовый помощник');
  await expect(preview).toContainText('Тестовый помощник');
});

test('компактный статус и мастер помещаются на мобильном экране', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ai-seller?step=1');
  await expect(page.getByTestId('seller-connection-details')).not.toHaveAttribute('open', '');
  await page.getByText('Подробности подключения', { exact: true }).click();
  await expect(page.getByTestId('seller-connection-details')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('превью: светлая и тёмная темы, мобильная ширина, без горизонтального скролла', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/ai-seller?step=1');
      await expect(page.getByRole('complementary', { name: 'Превью агента' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({
        path: `reports/seller-workspace-2026-09-26/${colorScheme}-${width}.png`,
        fullPage: true,
      });
    }
  }
});
