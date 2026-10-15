import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * MKT8 (plans/mkt8-site-assets-2026-10-07.md §13): библиотека изображений сайта филиала. Карточки с подписанным
 * адресом, загрузка (SVG отклоняется, больше 10 МиБ не уходит), подпись ALT, удаление с честным текстом про
 * опубликованные версии, импорт фото менеджера каналов по выбору, выключенное хранилище. Редактора нет (MKT9).
 * Картинки вымышленные (ADR-010).
 */
const fixture = FIXTURE_API;
const SHOTS = 'reports/mkt8-site-assets-2026-10-07';
const main = (page: Page) => page.getByRole('main').filter({ visible: true });
const control = (request: { post: (url: string, o: { data: unknown }) => Promise<unknown> }, data: Record<string, unknown>) =>
  request.post(`${fixture}/__test/site-assets`, { data });
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('библиотека: карточки с картинкой, назначением, размером и источником; ключей хранилища на странице нет', async ({ page }) => {
  await page.goto('/marketing/site/assets');
  const m = main(page);
  await expect(m.getByRole('heading', { level: 1 })).toHaveText('Изображения сайта');
  const cards = m.getByTestId('site-asset');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText('Фото');
  await expect(cards.first()).toContainText('1600×1067');
  await expect(cards.first()).toContainText('Загружено');
  await expect(cards.nth(1)).toContainText('Из менеджера каналов');
  await expect(cards.nth(2)).toContainText('Логотип');
  await expect(cards.first().getByRole('img')).toHaveAttribute('alt', 'Фасад гостиницы вечером');
  await expect(cards.nth(2).getByRole('img')).toHaveAttribute('alt', 'Изображение без подписи');
  const html = await m.innerHTML();
  expect(html).not.toMatch(/site-assets\/|storageRef|X-Amz/);
});

test('загрузка: новый файл в библиотеке; SVG отклоняется словами; больше 10 МиБ не уходит на сервер', async ({ page }) => {
  await page.goto('/marketing/site/assets');
  const m = main(page);
  await m.getByLabel('Файл').setInputFiles({ name: 'facade.png', mimeType: 'image/png', buffer: PNG });
  await m.getByTestId('site-assets-submit').click();
  await expect(m.getByTestId('site-assets-message')).toHaveText('Изображение загружено');
  await expect(m.getByTestId('site-asset')).toHaveCount(4);
  // тот же файл ещё раз: тот же ассет
  await m.getByLabel('Файл').setInputFiles({ name: 'facade-copy.png', mimeType: 'image/png', buffer: PNG });
  await m.getByTestId('site-assets-submit').click();
  await expect(m.getByTestId('site-assets-message')).toHaveText('Такое изображение уже есть в библиотеке');
  await expect(m.getByTestId('site-asset')).toHaveCount(4);
  // SVG под видом PNG: отказ по содержимому
  await m.getByLabel('Файл').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>') });
  await m.getByTestId('site-assets-submit').click();
  await expect(m.getByTestId('site-assets-error')).toHaveText('Подходят только JPEG, PNG и WebP без анимации');
  // слишком большой файл: подсказка сразу, поле очищено, запрос не уходит
  let posted = 0;
  page.on('request', (r) => {
    if (r.method() === 'POST') posted += 1;
  });
  await m.getByLabel('Файл').setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(m.getByTestId('site-assets-error')).toHaveText('Файл больше 10 МиБ');
  await expect(m.getByLabel('Файл')).toHaveValue('');
  expect(posted).toBe(0);
});

test('подпись ALT сохраняется; удаление с вопросом: опубликованная картинка удерживается, черновая удаляется', async ({ page }) => {
  await page.goto('/marketing/site/assets');
  const m = main(page);
  const second = m.getByTestId('site-asset').nth(1);
  await second.getByLabel('Подпись для незрячих (ALT)').fill('Номер с видом на горы');
  await second.getByRole('button', { name: 'Сохранить' }).click();
  await expect(m.getByTestId('site-assets-message')).toHaveText('Подпись сохранена');
  await expect(m.getByTestId('site-asset').nth(1).getByRole('img')).toHaveAttribute('alt', 'Номер с видом на горы');

  await m.getByTestId('site-asset').first().getByTestId('site-asset-delete').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(m.getByTestId('site-assets-message')).toHaveText(
    'Изображение скрыто из библиотеки, но сохранено для опубликованных версий и отката',
  );
  await expect(m.getByTestId('site-asset')).toHaveCount(2);
  await m.getByTestId('site-asset').first().getByTestId('site-asset-delete').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
  await expect(m.getByTestId('site-assets-message')).toHaveText('Изображение удалено');
  await expect(m.getByTestId('site-asset')).toHaveCount(1);
});

test('импорт из менеджера каналов: фото по выбору, итог словами; без подключения состояние словами', async ({ page, request }) => {
  await page.goto('/marketing/site/assets');
  const m = main(page);
  await m.getByTestId('site-assets-channex-load').click();
  const list = m.getByRole('list', { name: 'Фото гостиницы в менеджере каналов' });
  await expect(list.getByRole('checkbox')).toHaveCount(4);
  await expect(m.getByTestId('site-assets-channex-import')).toBeDisabled();
  await list.getByLabel('Фасад гостиницы').check();
  await list.getByLabel('Ресепшн').check();
  await m.getByTestId('site-assets-channex-import').click();
  await expect(m.getByTestId('site-assets-message')).toHaveText('Импортировано: 1, не удалось: 1 (адрес фото недоступен)');
  await expect(m.getByTestId('site-asset')).toHaveCount(4);
  expect(await m.innerHTML()).not.toContain('img.channex.io');

  await control(request, { channexState: 'NO_MAPPING' });
  await page.reload();
  await main(page).getByTestId('site-assets-channex-load').click();
  await expect(main(page).getByTestId('site-assets-channex-state')).toHaveText('Гостиница не сопоставлена с менеджером каналов');
});

test('хранилище выключено: библиотека читается, загрузка и импорт недоступны', async ({ page, request }) => {
  await control(request, { storageOff: true });
  await page.goto('/marketing/site/assets');
  const m = main(page);
  await expect(m.getByTestId('site-assets-off')).toBeVisible();
  await expect(m.getByTestId('site-assets-submit')).toBeDisabled();
  await expect(m.getByTestId('site-assets-channex-load')).toBeDisabled();
  await expect(m.getByTestId('site-asset')).toHaveCount(3);
});

test('пустая библиотека и переход со страницы публикации', async ({ page, request }) => {
  await control(request, { empty: true });
  await page.goto('/marketing/site');
  await main(page).getByTestId('publication-assets-link').click();
  await expect(page).toHaveURL(/\/marketing\/site\/assets$/);
  await expect(main(page).getByTestId('site-assets-empty')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`страница на компьютере и телефоне, доступность: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing/site/assets');
      await main(page).getByTestId('site-assets-channex-load').click();
      await expect(main(page).getByRole('list', { name: 'Фото гостиницы в менеджере каналов' })).toBeVisible();
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll('main *')]
          .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 5)
          .map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().right)}`),
      );
      expect(wide).toEqual([]);
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/assets-${theme}-${width}.png`, fullPage: true });
    }
    // удалённое состояние: текст про удержание ради опубликованных версий
    await page.setViewportSize({ width: 1440, height: 900 });
    await main(page).getByTestId('site-asset').first().getByTestId('site-asset-delete').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click();
    await expect(main(page).getByTestId('site-assets-message')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/assets-deleted-${theme}-1440.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
