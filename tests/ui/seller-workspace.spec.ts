import { expect, test, FIXTURE_API } from './fixtures';
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});
test('five steps, back navigation preserves instruction, desktop and mobile do not overflow', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/ai-seller');
      const steps = page.getByRole('navigation', { name: 'Шаги настройки продавца' });
      await expect(steps.getByRole('button')).toHaveCount(5);
      await expect(page.getByTestId('seller-setup')).toBeHidden();
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await page
        .getByTestId('seller-prompt-text')
        .fill('Тестовая инструкция для вымышленного объекта');
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await expect(page.getByTestId('seller-llm-key')).toBeVisible();
      await page.getByRole('button', { name: 'Назад', exact: true }).click();
      await expect(page.getByTestId('seller-prompt-text')).toHaveValue(
        'Тестовая инструкция для вымышленного объекта',
      );
      await steps.getByRole('button', { name: '4 Проверка' }).click();
      await expect(page.getByTestId('seller-check')).toBeVisible();
      await page.getByRole('button', { name: 'Далее', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Перед первым разговором с гостем' }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
test('model key persists after reload and empty save cannot erase it', async ({ page }) => {
  await page.goto('/ai-seller/connections');
  await page.getByTestId('seller-llm-key-input').fill('sk-valid-key-7890');
  await page.getByTestId('seller-llm-key-save').click();
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('····7890');
  await page.reload();
  await expect(page.getByTestId('seller-llm-key-input')).toHaveValue('');
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('····7890');
  await page.getByTestId('seller-llm-key-save').click();
  await expect(page.getByTestId('seller-llm-key-error')).toContainText(
    'Сохранённый ключ не изменён',
  );
  await page.reload();
  await expect(page.getByTestId('seller-llm-key-state')).toContainText('····7890');
});
