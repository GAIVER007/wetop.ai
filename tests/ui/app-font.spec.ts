import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * Шрифт стойки Inter (Q-DES-3, решение владельца 13.10.2026): проверяется не объявление `font-family`,
 * а то, что файл скачан, применён к таблице, плитке, кнопке, окну и телефону, рисует четыре веса
 * разными начертаниями и держит цифры одной ширины.
 */

/** имя гарнитуры, под которым next/font зарегистрировал файл (первое в `--font-inter`) */
async function interFamily(page: Page): Promise<string> {
  const value = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--font-inter'),
  );
  const first =
    value
      .split(',')[0]
      ?.trim()
      .replace(/^['"]|['"]$/g, '') ?? '';
  expect(first, 'переменная --font-inter задана на <html>').toMatch(/inter/i);
  return first;
}

async function usesInter(page: Page, selector: string, family: string) {
  const font = await page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(
    font.startsWith(`${family}`) ||
      font.startsWith(`"${family}"`) ||
      font.startsWith(`'${family}'`),
    `${selector}: ${font}`,
  ).toBe(true);
}

test('Inter скачан и применён: веса, цифры, таблица, плитка, кнопка, окно, телефон', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/chessboard');
  await expect(page.locator('main h1')).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  const family = await interFamily(page);

  // файл действительно загружен браузером, а не только объявлен
  const loaded = await page.evaluate(
    (f) =>
      [...document.fonts].filter(
        (x) => x.family.replace(/['"]/g, '') === f && x.status === 'loaded',
      ).length,
    family,
  );
  expect(loaded, 'FontFace Inter в состоянии loaded').toBeGreaterThan(0);

  // четыре веса дают четыре разных начертания (вариативная ось, а не синтетический жирный)
  const widths = await page.evaluate((f) => {
    const c = document.createElement('canvas').getContext('2d')!;
    return [400, 500, 600, 700].map((w) => {
      c.font = `${w} 15px "${f}"`;
      return c.measureText('Шахматка Әғқ 12 500 ₸').width;
    });
  }, family);
  for (let i = 1; i < widths.length; i++) expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);

  // казахские буквы и ₸ рисует сам Inter: с несуществующей гарнитурой ширина другая
  const ownGlyphs = await page.evaluate((f) => {
    const c = document.createElement('canvas').getContext('2d')!;
    const probe = 'ӘәҒғҚқҢңӨөҰұҮүҺһІі₸№';
    c.font = `15px "${f}", monospace`;
    const a = c.measureText(probe).width;
    c.font = '15px WetopNoSuchFont, monospace';
    return a !== c.measureText(probe).width;
  }, family);
  expect(ownGlyphs).toBe(true);

  // табличные цифры: «1111» и «0000» одной ширины при tabular-nums
  const tnum = await page.evaluate((f) => {
    const s = document.createElement('span');
    s.style.cssText = `font: 15px "${f}"; font-variant-numeric: tabular-nums; position: absolute; visibility: hidden`;
    document.body.append(s);
    s.textContent = '1111';
    const one = s.getBoundingClientRect().width;
    s.textContent = '0000';
    const zero = s.getBoundingClientRect().width;
    s.remove();
    return Math.abs(one - zero);
  }, family);
  expect(tnum).toBeLessThan(0.5);

  for (const selector of [
    'body',
    'main h1',
    '.btn',
    '[aria-label="Сегодня на объекте"]',
    '[aria-label="Календарь по дням"]',
  ])
    await usesInter(page, selector, family);

  // окно: фильтры календаря открываются поверх страницы
  await page
    .getByRole('button', { name: /Фильтры/ })
    .first()
    .click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
  await usesInter(page, '[role="dialog"]', family);
  await page.keyboard.press('Escape');

  // таблица: справочник броней
  await page.goto('/reservations');
  await expect(page.locator('table').first()).toBeVisible();
  await usesInter(page, 'table td', family);

  // телефон
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  await page.evaluate(() => document.fonts.ready);
  await usesInter(page, 'body', family);
});
