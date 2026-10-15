/**
 * `test` для сквозных спеков стойки: тот же Playwright, но `page.goto` дожидается конца потоковой отрисовки.
 *
 * Стойка (Next 16, `app/loading.tsx`) отдаёт страницу потоком: содержимое приходит в скрытом сегменте
 * `<div hidden id="S:0">`, а клиент тем временем уже отрисовал её сам. На быстром сервере обе копии живут в DOM
 * ~300 мс после `load` (замер 15.09.2026: 35…330 мс, `reports/tests-without-live-db-2026-09-15.md`). Человек
 * скрытую копию не видит, а Playwright в строгом режиме находит каждый элемент дважды и падает сразу, не дожидаясь
 * (strict mode violation). На Mac владельца с API за 2 с окно уже, и то же самое всплывало «плавающими» падениями
 * (журнал 14.09: «hidden streaming copy»). Ждём, пока скрытый сегмент со страницей исчезнет, и только потом отдаём
 * страницу спеку. Мягкие переходы (router.push, выезжающая карточка) идут без потока и сюда не попадают.
 */
import { test as base, expect, type Page } from '@playwright/test';

/**
 * Скрытый потоковый сегмент ещё в DOM? Ждём его ухода; если стойка его не убирает — не падаем здесь.
 * Любой сегмент, а не только со всей страницей: с 16.09.2026 «Главная» отдаёт показатели и полосу стойки
 * своими кусками (`Suspense`), и их сегменты `main` не содержат — а копия `c-arrivals` в них та же.
 */
export async function settleStreaming(page: Page): Promise<void> {
  // Выражение строкой: в корневом tsconfig нет библиотеки DOM, `document` тут не типизирован
  await page
    .waitForFunction('!document.querySelector(\'body > div[hidden][id^="S:"]\')', null, { timeout: 10_000 })
    .catch(() => undefined);
}

/**
 * Обучение в стойке (ADR-100) само открывается на «Сегодня» у вошедшей гостиницы, пока в браузере нет отметки
 * «пройдено». С 07.10.2026 сквозные идут вошедшим пользователем, и окно обучения перекрывало экран для спеков,
 * которые работают на Главной (`desk-day`); какой спек открывал «Сегодня» первым, тот и упирался в окно. Отметка
 * ставится до загрузки страницы тем же приёмом, что в `tests/ui/fixtures.ts`; спека самого обучения среди
 * сквозных нет.
 */
const TOUR_DONE_SCRIPT = `(() => {
  try {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const value = get.call(this, key);
      return value === null && typeof key === 'string' && key.startsWith('wetop.tour.v1:') ? 'done' : value;
    };
  } catch (e) {}
})();`;

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(TOUR_DONE_SCRIPT);
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await settleStreaming(page);
      return response;
    };
    await use(page);
  },
});

export { expect };
