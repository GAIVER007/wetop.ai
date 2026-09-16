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

/** Скрытый потоковый сегмент со страницей ещё в DOM? Ждём его ухода; если стойка его не убирает — не падаем здесь */
export async function settleStreaming(page: Page): Promise<void> {
  // Выражение строкой: в корневом tsconfig нет библиотеки DOM, `document` тут не типизирован
  await page
    .waitForFunction('!document.querySelector(\'body > div[hidden][id^="S:"] main\')', null, { timeout: 10_000 })
    .catch(() => undefined);
}

export const test = base.extend({
  page: async ({ page }, use) => {
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
