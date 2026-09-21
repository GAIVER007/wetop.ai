/**
 * `test` для набора UI: тот же Playwright, но переход и перезагрузка дают потоковой отрисовке
 * короткую фору. Разбор тот же, что и в `tests/e2e/fixtures.ts` (журнал 15.09.2026): стойка отдаёт
 * страницу потоком, и первые сотни миллисекунд после `load` в DOM живут две копии — скрытый
 * сегмент `<div hidden id="S:0">` и клиентская отрисовка. Человек скрытую не видит, а Playwright
 * в строгом режиме находит каждый элемент дважды и падает сразу, не дожидаясь.
 *
 * До 21.09.2026 набор UI брал `test` прямо из `@playwright/test` и ловил это по одному локатору за
 * прогон (журнал 20.09 и 21.09). Ожидание здесь снимает весь класс разом, `page.reload()` тоже —
 * на нём падала `reservations-design`.
 *
 * Фора именно короткая, и это не мелочь. Замер 15.09 дал окно 35…330 мс, поэтому 700 мс его
 * покрывают. Ждать дольше нельзя: в наборе есть спеки, которые нарочно задерживают ответы API на
 * 2…6 с и проверяют, что видно, ПОКА страница грузится (`loading-performance`, `real-data`,
 * `reservations-states`, «загрузка словом» в `system-screens` и `channex-screens`). Длинное
 * ожидание здесь отдавало бы им уже загруженную страницу и проверяло пустоту вместо скелетона.
 */
import { test as base, expect, type Page } from '@playwright/test';

const STREAM_GRACE_MS = 700;

/** Скрытый потоковый сегмент ещё в DOM? Даём ему уйти; не ушёл за форой — отдаём страницу как есть */
async function settleStreaming(page: Page): Promise<void> {
  // Выражение строкой: в корневом tsconfig нет библиотеки DOM, `document` тут не типизирован
  await page
    .waitForFunction('!document.querySelector(\'body > div[hidden][id^="S:"]\')', null, {
      timeout: STREAM_GRACE_MS,
    })
    .catch(() => undefined);
}

export * from '@playwright/test';

/**
 * Шум `next dev`, а не ошибка стойки: React ведёт собственную дорожку замеров, и на странице,
 * пришедшей через redirect(), подаёт начало серверного рендера раньше timeOrigin вкладки —
 * браузер отвечает отказом `measure`. Приходит и как console.error, и как необработанное
 * исключение страницы; в сборке этой дорожки нет (разбор 21.09.2026).
 */
export const devNoise = /Failed to execute 'measure' on 'Performance'/;

export const test = base.extend({
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await settleStreaming(page);
      return response;
    };
    const reload = page.reload.bind(page);
    page.reload = async (options) => {
      const response = await reload(options);
      await settleStreaming(page);
      return response;
    };
    await use(page);
  },
});

export { expect };
