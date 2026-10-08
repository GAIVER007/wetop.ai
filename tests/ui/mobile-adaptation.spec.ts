import { expect, test } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

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
const fixture = FIXTURE_API;
const PHONE = { width: 390, height: 844 };

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await page.setViewportSize(PHONE);
});

test('телефон: низ страницы не прячется под нижней навигацией', async ({ page }) => {
  test.slow(); // обход 13 разделов: на холодном `next dev` первая сборка каждого занимает секунды
  // Экраны без собственных `:has()`-компенсаций — они и страдали; у /channels своё правило 16px
  for (const route of [
    '/guests',
    '/finance',
    '/inventory',
    '/channels',
    '/today',
    '/reservations',
    '/management/analytics',
    '/reports',
    '/rooms/categories',
    '/hotel-settings',
    '/ai-agents',
    '/team',
  ]) {
    await page.goto(route);
    const nav = page.locator('.bottom-navigation');
    await expect(nav).toBeVisible();
    const navHeight = (await nav.boundingBox())?.height ?? 0;
    // На части экранов (вкладки тарифов) несколько .page — мерим видимую. Замер повторяется: у раздела
    // со своим `loading.tsx` первым приходит `.page` экрана ожидания, потоковая отрисовка снимает его
    // посреди замера, и у отцепленного узла `getComputedStyle` пуст (NaN, release-checks 37795974518)
    await expect
      .poll(
        () =>
          page
            .locator('.page:visible')
            .first()
            .evaluate((el) => (el.isConnected ? parseFloat(getComputedStyle(el).paddingBottom) : Number.NaN))
            .catch(() => Number.NaN),
        { message: `${route}: padding-bottom меньше панели ${navHeight}` },
      )
      .toBeGreaterThanOrEqual(navHeight);
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

test('телефон: сводка и управление оставляют сетку на первом экране', async ({ page }) => {
  // Согласованная сводка занимает до 280 px, сетка начинается не ниже 700 px.
  await page.goto('/chessboard');
  const grid = page.locator('.board-wrap');
  const summary = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(grid).toBeVisible();
  await expect(summary).toBeVisible();
  expect((await summary.boundingBox())!.height).toBeLessThanOrEqual(280);
  const board = await grid.boundingBox();
  expect(board!.y, `сетка начинается на ${Math.round(board!.y)} px`).toBeLessThanOrEqual(700);
  const navigation = await page.locator('.bottom-navigation').boundingBox();
  expect(navigation!.y - board!.y, 'первый экран показывает минимум 80 px сетки').toBeGreaterThanOrEqual(80);
  await expect(page.getByRole('group', { name: 'Вид календаря' })).toBeVisible();
});

test('узкий телефон: плитки финансов встают в одну колонку', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/finance');
  await page.getByText('Отчёты и управление', { exact: true }).click();
  await page.getByRole('tab', { name: 'Обзор', exact: true }).click();
  const columns = await page
    .locator('.finance-kpis')
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
});

test('телефон: кнопки, поля и вкладки разделов — цели не ниже 44 px', async ({ page }) => {
  test.slow(); // обход 14 разделов
  // ADR-134 свёл телефонный блок workspace.css в @media (max-width: 360px), и на 361–600 px правило
  // «.btn, .inp, .icon-button — 44 px» перестало действовать: кнопки падали до 36 px. Свои компактные
  // размеры «Каналов» (36 px) и вкладки «Финансов» (37 px) перебивали общее правило и на 375 px.
  for (const route of [
    '/channels',
    '/finance',
    '/finance?tab=cash',
    '/guests',
    '/today',
    '/reservations',
    '/management/analytics',
    '/reports',
    '/inventory',
    '/rooms/categories',
    '/hotel-settings',
    '/ai-agents',
    '/team',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('button, select, input, a.btn')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.width > 0 && r.height < 44;
        })
        .map((el) => (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24)),
    );
    expect(small, `${route}: цели ниже 44 px — ${small.join(', ')}`).toEqual([]);
  }
});

test('телефон: поля не мельче 16 px — иначе iOS зумит страницу при фокусе', async ({ page }) => {
  test.slow(); // обход 17 разделов
  // Safari на iPhone увеличивает страницу, когда поле мельче 16 px, и обратно сам не возвращает:
  // человек правит период или ищет бронь на зумленном экране. Замер 03.10: 13 px у полей периода
  // Главной, 14 px у «Броней», «Финансов», «Кассы» и «Отчётов» — плотные полосы разделов
  // перебивали общее правило (`.finance-toolbar .field--inline .inp` специфичнее `.workspace .inp`).
  for (const route of [
    '/today',
    '/chessboard',
    '/reservations',
    '/reservations/new',
    '/guests',
    '/finance',
    '/finance?tab=cash',
    '/management/analytics',
    '/reports',
    '/inventory',
    '/rooms/categories',
    '/rooms/availability',
    '/channels',
    '/hotel-settings',
    '/ai-agents',
    '/team',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('input, select, textarea')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const type = (el as HTMLInputElement).type;
          if (['checkbox', 'radio', 'hidden'].includes(type)) return false;
          return r.height > 0 && r.width > 0 && parseFloat(getComputedStyle(el).fontSize) < 16;
        })
        .map(
          (el) =>
            `${el.getAttribute('aria-label') || (el as HTMLInputElement).name || el.tagName}=${Math.round(
              parseFloat(getComputedStyle(el).fontSize),
            )}px`,
        ),
    );
    expect([...new Set(small)], `${route}: поля мельче 16 px — ${small.join(', ')}`).toEqual([]);
  }
});
