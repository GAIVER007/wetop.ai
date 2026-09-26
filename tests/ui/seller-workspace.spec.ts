import { expect, test } from './fixtures';

/** «Настройка» раздела «ИИ-продавец» на любой ширине и в обеих темах (макет владельца 26.09.2026, ADR-097) */
test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

const noPageScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('окно инструкции и проверка: светлая и тёмная темы, 1440–320, без горизонтального скролла', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of [1440, 768, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/ai-seller');
      await expect(page.getByTestId('seller-setup')).toBeVisible();
      await expect(page.getByTestId('seller-check')).toBeVisible();
      expect(await noPageScroll(page), `${colorScheme} ${width}`).toBe(true);
    }
  }
});

test('широкий экран — проверка рядом с окном, телефон — под ним; подписи вкладок не сжаты', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/ai-seller');
  const setup = page.getByTestId('seller-setup');
  const check = page.getByTestId('seller-check');
  let [editor, side] = [await setup.boundingBox(), await check.boundingBox()];
  expect(side!.x).toBeGreaterThanOrEqual(editor!.x + editor!.width);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ai-seller');
  [editor, side] = [await setup.boundingBox(), await check.boundingBox()];
  expect(side!.y).toBeGreaterThanOrEqual(editor!.y + editor!.height);
  expect(await noPageScroll(page)).toBe(true);
  // полоса вкладок прокручивается сама, а не сжимает подписи (26.09.2026 на телефоне сжимались до 58 px)
  const clipped = await page
    .locator('.seller-tabs > a')
    .evaluateAll((tabs) => tabs.filter((t) => t.scrollWidth > t.clientWidth + 1).map((t) => t.textContent));
  expect(clipped).toEqual([]);
});
