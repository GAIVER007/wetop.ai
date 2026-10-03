import { expect, test } from '@playwright/test';

/**
 * Мобильная версия стойки (02.10.2026, поручение владельца «особое внимание телефону»).
 *
 * Четыре дефекта, найденные живым проходом на 390 px:
 * 1) `.workspace .page` на телефоне оставлял снизу 40 px — последние ~30 px контента прятались под
 *    нижней навигацией (70 px): компенсацию имели только экраны со своими `:has()`-правилами.
 * 2) Шапка «Календаря» ставила `flex-wrap: nowrap`, и заголовок зажимался в колонку по буквам,
 *    пока три кнопки действий занимали ширину.
 * 3) Чипы отборов «Броней» и «Финансов» — 30 px (`--control-h-sm`): меньше цели 44 px
 *    (DESIGN.md: «на телефоне кнопки/поля/навигация — цели ≥44 px»).
 * 4) Правило «плитки финансов в одну колонку» (≤520 px) стояло в файле раньше правила «две колонки»
 *    (≤800 px) и при равной специфичности никогда не применялось.
 */
const fixture = 'http://127.0.0.1:4311';
const PHONE = { width: 390, height: 844 };

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await page.setViewportSize(PHONE);
});

test('телефон: низ страницы не прячется под нижней навигацией', async ({ page }) => {
  // Экраны без собственных `:has()`-компенсаций — они и страдали; у /channels своё правило 16px
  for (const route of ['/guests', '/finance', '/rates', '/inventory', '/channels']) {
    await page.goto(route);
    const nav = page.locator('.bottom-navigation');
    await expect(nav).toBeVisible();
    const navHeight = (await nav.boundingBox())?.height ?? 0;
    // На части экранов (вкладки тарифов) несколько .page — мерим видимую
    const padBottom = await page
      .locator('.page:visible')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(padBottom, `${route}: padding-bottom ${padBottom} < панель ${navHeight}`).toBeGreaterThanOrEqual(navHeight);
    // и страница не едет вбок
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${route}: горизонтальная прокрутка`).toBeLessThanOrEqual(1);
  }
});

test('телефон: заголовок календаря читается строкой, а не колонкой по буквам', async ({ page }) => {
  await page.goto('/chessboard');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toBeVisible();
  const box = await title.boundingBox();
  // зажатый заголовок переносился на три строки (высота ~80 px); одна строка 22 px — до 40 px
  expect(box!.height).toBeLessThan(40);
});

test('телефон: чипы отборов — цели нажатия не ниже 44 px', async ({ page }) => {
  await page.goto('/reservations');
  const view = page.getByRole('navigation', { name: 'Быстрые виды' }).getByRole('link').first();
  await expect(view).toBeVisible();
  expect((await view.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.goto('/finance');
  const chip = page
    .getByRole('navigation', { name: 'Готовые периоды' })
    .getByRole('link')
    .first();
  await expect(chip).toBeVisible();
  expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('телефон: сетка календаря выше сводки «На стойке»', async ({ page }) => {
  // На 812 px высоты сводка (≈465 px) выталкивала сетку за первый экран: сначала работа, потом сводка
  await page.goto('/chessboard');
  const board = await page.locator('.board-wrap').boundingBox();
  const strip = await page.locator('.desk-strip').boundingBox();
  expect(board!.y).toBeLessThan(strip!.y);
});

test('узкий телефон: плитки финансов встают в одну колонку', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  const columns = await page
    .locator('.finance-kpis')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
});

test('телефон: месяц цен не растягивается на четыре экрана', async ({ page }) => {
  // День стоял тремя блоками по 44 px (дата, цена на полную вместимость, цена на меньшую) —
  // месяц прокручивался примерно на 4 300 px. Одна строка на день держит высоту дня в пределах 80 px.
  await page.goto('/rates');
  const cal = page.getByTestId('rates-calendar');
  await expect(cal).toBeVisible();
  const days = cal.locator('.rate-cal__day');
  const count = await days.count();
  expect(count).toBeGreaterThan(27);
  const height = (await cal.boundingBox())!.height;
  expect(height / count, `высота дня ${Math.round(height / count)} px`).toBeLessThan(80);
});
