import { expect, test, type Page } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки текущих экранов для дизайн-системы (plans/design-system-2026-09-14.md, шаг 1; ADR-048).
 * Синтетический API + `POST /__test/design-seed`: на снимках только псевдонимы. Результат —
 * design/reference/current/<экран>-<тема>.png, 1440×1000. Это не эталон Playwright: эталоны
 * страницы компонентов живут в design/reference/kit (шаг 4).
 */
const fixture = 'http://127.0.0.1:4311';
const dir = 'design/reference/current';
const booking = '20260913-TESTAA';

async function shot(page: Page, name: string, theme: string, fullPage = false) {
  await page.screenshot({ caret: 'initial', path: `${dir}/${name}-${theme}.png`, fullPage });
}

for (const theme of ['light', 'dark'] as const) {
  test(`экраны для дизайн-системы: ${theme}`, async ({ page, request }) => {
    test.setTimeout(240_000);
    mkdirSync(dir, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    const seeded = await request.post(`${fixture}/__test/design-seed`);
    expect(seeded.ok()).toBe(true);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 1000 });

    // шахматка: неделя с крайними случаями — статусы, каналы, блокировки, «Без ячейки»
    await page.goto('/chessboard');
    const main = page.getByRole('main');
    await expect(main.getByTestId('date-col')).toHaveCount(7);
    await expect(main.getByTestId('unassigned-stays')).toHaveAttribute('data-count', '1');
    await shot(page, 'chessboard-week', theme);

    // шахматка: следующий месяц, заняты все 88 из 88
    const next = new Date(Date.now() + 5 * 3600_000);
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const from = next.toISOString().slice(0, 10);
    next.setUTCMonth(next.getUTCMonth() + 1);
    next.setUTCDate(0);
    const to = next.toISOString().slice(0, 10);
    await page.goto(`/chessboard?from=${from}&to=${to}`);
    await expect(main.getByTestId('date-col').first()).toBeVisible();
    await shot(page, 'chessboard-month-full', theme);

    // главная (в документе ментора — «служба приёма»)
    await page.goto('/today');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Главная');
    await shot(page, 'today', theme);
    await shot(page, 'today-full', theme, true);

    // карточка брони панелью поверх шахматки, четыре вкладки
    await page.goto('/chessboard');
    await main.getByTestId('stay-cell').first().click();
    const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
    await expect(drawer).toBeVisible();
    await shot(page, 'reservation-drawer-overview', theme);
    for (const [tab, name] of [
      ['Счета', 'folio'],
      ['Действия', 'actions'],
      ['История', 'history'],
    ] as const) {
      await drawer.getByRole('tab', { name: tab, exact: true }).click();
      await shot(page, `reservation-drawer-${name}`, theme);
    }
    await page.keyboard.press('Escape');

    // карточка брони отдельной страницей — целиком
    await page.goto(`/reservations/${booking}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Бронь');
    await shot(page, 'reservation-page-full', theme, true);

    // карточка гостя
    await page.goto('/guests/ui-guest');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Гость');
    await shot(page, 'guest', theme);

    // форма брони: одно размещение и группа
    await page.goto('/reservations/new?unit=M03');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Новая бронь');
    await shot(page, 'reservation-form-single', theme, true);
    await page.getByRole('main').getByLabel('Количество мест', { exact: true }).fill('3');
    await expect(page.getByRole('main').getByTestId('group-hint')).toBeVisible();
    await shot(page, 'reservation-form-group', theme, true);

    // цены и ограничения вместе с массовым изменением
    await page.goto('/rates');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Цены');
    await expect(main.getByTestId('bulk-editor')).toBeVisible();
    await shot(page, 'rates', theme);
    await shot(page, 'rates-full', theme, true);
    // Телефон: длинное название категории («Одноместная комната с окном и балконом») растягивало
    // выпадающий список фильтра, и экран уезжал вбок на 94 px — найдено обходом стойки 17.09.2026
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/rates');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Цены');
    const ratesLayout = await page.evaluate(() => {
      const w = globalThis as unknown as {
        innerWidth: number;
        document: { documentElement: { scrollWidth: number } };
      };
      return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
    });
    expect(ratesLayout.content, 'цены шире экрана телефона').toBeLessThanOrEqual(
      ratesLayout.viewport + 1,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });

    // журнал интеграции: очередь, события, ревизия с ошибкой
    await page.goto('/channels');
    await expect(main.getByTestId('event-row')).toHaveCount(3);
    await shot(page, 'channels', theme);
    await shot(page, 'channels-full', theme, true);

    // список броней и гости — одной строкой (правки 15.09)
    await page.goto('/reservations');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shot(page, 'reservations', theme);
    await page.goto('/guests');
    await shot(page, 'guests', theme);

    // неисправности и номера — блоки состояния
    await page.goto('/incidents');
    await shot(page, 'incidents', theme);
    await page.goto('/rooms');
    await expect(page).toHaveURL(/\/inventory$/); // с PR #66 /rooms — переход в /inventory
    await shot(page, 'rooms', theme);
  });
}
