import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Простой экран сайта (SITE-1, решение владельца 15.10.2026): сайт это зеркало данных WETOP, клиент делает пять вещей
 * на одном экране: шаблон, фото, тексты («Предложить текст»), блоки, публикация. Слева шаги, справа живой сайт.
 * Сохраняется само. Стенд отвечает правилами API, данные вымышленные (ADR-010)
 */
const SHOTS = 'reports/site-1';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const frame = (page: Page) => page.frameLocator('[data-testid="ed-frame"]');
const axe = (page: Page) =>
  new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('[data-testid="ed-frame"]').exclude('[data-testid="site-design-frame"]').analyze();
// 1×1 PNG: фото для загрузки
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.beforeAll(() => mkdirSync(SHOTS, { recursive: true }));
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('пять шагов слева, сайт справа; данные из WETOP подписаны; без вкладок и кнопки «Сохранить»', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await expect(m.getByTestId('site-setup')).toBeVisible();
  for (const id of ['setup-template', 'setup-photos', 'setup-texts', 'setup-blocks', 'setup-publish']) await expect(m.getByTestId(id)).toBeVisible();
  await expect(m.getByTestId('setup-mirror')).toContainText('из WETOP сам');
  await expect(m.getByRole('tablist')).toHaveCount(0);
  await expect(m.getByRole('button', { name: 'Сохранить' })).toHaveCount(0);
  const steps = await m.getByTestId('setup-template').boundingBox();
  const site = await m.getByTestId('ed-frame').boundingBox();
  expect(steps!.x + steps!.width).toBeLessThanOrEqual(site!.x);
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено');
});

test('«Предложить текст» ставит сильный заголовок и «О нас»; правка поля уходит в сайт и сохраняется сама', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await m.getByTestId('setup-suggest').click();
  await expect(m.getByTestId('setup-heading')).not.toHaveValue('');
  const heading = await m.getByTestId('setup-heading').inputValue();
  await expect(frame(page).locator('#sec-hero')).toContainText(heading);
  await expect(m.getByTestId('setup-about')).not.toHaveValue('');
  await expect(frame(page).locator('#sec-about')).toBeVisible();
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено', { timeout: 10_000 });

  await m.getByTestId('setup-heading').fill('Тихие номера в центре Алматы');
  await m.getByTestId('setup-heading').press('Enter');
  await expect(frame(page).locator('#sec-hero')).toContainText('Тихие номера в центре Алматы');
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено', { timeout: 10_000 });
  await page.reload();
  await expect(main(page).getByTestId('setup-heading')).toHaveValue('Тихие номера в центре Алматы');
});

test('блоки: включить блок из шаблона и выключить; без данных в WETOP блок не включается; шаблон одним касанием', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  // у гостиницы стенда нет мастеров и часов: переключатели недоступны и подписаны
  await expect(m.getByTestId('setup-block-staff')).toBeDisabled();
  const cta = m.getByTestId('setup-block-cta');
  await expect(cta).not.toBeChecked();
  await cta.check();
  await expect(frame(page).locator('section[id^="sec-cta"]')).toHaveCount(1);
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено', { timeout: 10_000 });
  await cta.uncheck();
  await expect(frame(page).locator('section[id^="sec-cta"]')).toHaveCount(0);
  const cards = m.getByTestId('setup-template').getByTestId('site-design-card');
  await expect(cards).toHaveCount(3);
  await expect(m.getByTestId('setup-template').getByTestId('site-design-frame')).toHaveCount(3);
  await cards.nth(1).getByTestId('site-design-choose').click();
  await expect(cards.nth(1).getByRole('radio')).toHaveAttribute('aria-checked', 'true');
  // «Посмотреть» открывает сайт по шаблону целиком
  await cards.nth(2).getByTestId('site-design-view').click();
  await expect(page.getByTestId('tpl-viewer-frame')).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено', { timeout: 10_000 });
});

test('фото: обложка загружается с экрана и встаёт на первый экран сайта', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  await m.getByTestId('setup-cover-file').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG });
  await expect(m.getByRole('button', { name: 'Убрать обложку' })).toBeVisible({ timeout: 15_000 });
  await expect(frame(page).locator('#sec-hero img')).toHaveCount(1);
  await expect(m.getByTestId('setup-status')).toContainText('Сохранено', { timeout: 10_000 });
});

test('публикация одной кнопкой: после неё кнопка «Опубликовано»', async ({ page }) => {
  await page.goto('/marketing/site/editor');
  const m = main(page);
  const btn = m.getByTestId('setup-publish-btn');
  await btn.click();
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(btn).toHaveText('Опубликовано', { timeout: 15_000 });
});

for (const theme of ['light', 'dark'] as const)
  test(`простой экран: снимки и доступность, ${theme}, 1440 и 390`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/editor');
      await expect(main(page).getByTestId('site-setup')).toBeVisible();
      await expect(frame(page).locator('#sec-hero')).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1 && !el.closest('.ed-preview__stage')).length,
      );
      expect(wide).toBe(0);
      if (width === 390) {
        const small = await main(page)
          .locator('.setup .btn, .setup__tpl, .setup__toggle, .setup__thumb')
          .evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
        expect(small).toEqual([]);
      }
      await expect.poll(async () => (await axe(page)).violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/setup-${theme}-${width}.png`, fullPage: width === 390 });
    }
  });
