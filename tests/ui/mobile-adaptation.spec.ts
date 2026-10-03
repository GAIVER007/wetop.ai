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
// Порт стенда можно задать (`UI_FIXTURE_API`): дерево делят несколько сессий, 4311 бывает занят
const fixture = process.env['UI_FIXTURE_API'] ?? 'http://127.0.0.1:4311';
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
    '/rates',
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

test('телефон: управление календаря не отнимает у сетки пол-экрана', async ({ page }) => {
  // Замер 03.10 на 390 px: заголовок с кнопкой, период, сегмент, «Даты», «Помощь» и строка поиска
  // уводили сетку на 434 px из 844 — до первой строки номеров уходила половина экрана.
  await page.goto('/chessboard');
  const board = await page.locator('.board-wrap').boundingBox();
  expect(board!.y, `сетка начинается на ${Math.round(board!.y)} px`).toBeLessThan(380);
  // и всё управление осталось с целями 44 px (цели ниже ловит отдельный тест ниже)
  await expect(page.getByRole('group', { name: 'Вид календаря' })).toBeVisible();
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
    '/rates',
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
    '/rates',
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
