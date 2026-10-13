import type { Page } from '@playwright/test';

/**
 * Потоковый редирект Next. Корневой `app/loading.tsx` начинает отдачу раньше, чем страница зовёт `redirect()`, и тогда
 * Next кладёт в документ `<meta id="__next-page-redirect" http-equiv="refresh">`: браузер уходит на цель уже ПОСЛЕ
 * `load`. Пока этот переход висит, следующий `goto` им обрывается (`net::ERR_ABORTED`; гостиничное `/today` → `/finance`,
 * профиль, роли, техподдержка, 12.10.2026). Обёртка ждёт его до своего перехода (до фиксации) и после (как просил
 * сам `goto`): страница отдаётся конечной.
 */
const REDIRECT_GRACE_MS = 20_000;

export async function settleNextRedirect(
  page: Page,
  waitUntil: 'load' | 'domcontentloaded' | 'commit',
): Promise<void> {
  for (let hop = 0; hop < 3; hop++) {
    const from = page.url();
    // контекст разрушен посреди проверки: переход уже идёт, его и ждём
    const pending = await page
      .evaluate("document.getElementById('__next-page-redirect') !== null")
      .catch(() => true);
    if (!pending) return;
    await page
      .waitForURL((url) => url.href !== from, { waitUntil, timeout: REDIRECT_GRACE_MS })
      .catch(() => undefined);
  }
}

/**
 * Обернуть `goto` и `reload` страницы: до перехода отложенный редирект фиксируется, после него ждём, как просил
 * сам переход. Для наборов со своим `@playwright/test` (`food-ui`); у `tests/ui` та же обёртка в `fixtures.ts`.
 */
export function guardNextRedirects(page: Page): void {
  const until = (w?: string) => (w === 'commit' || w === 'domcontentloaded' ? w : 'load');
  const goto = page.goto.bind(page);
  page.goto = async (url, options) => {
    await settleNextRedirect(page, 'commit');
    const response = await goto(url, options);
    await settleNextRedirect(page, until(options?.waitUntil));
    return response;
  };
  const reload = page.reload.bind(page);
  page.reload = async (options) => {
    await settleNextRedirect(page, 'commit');
    const response = await reload(options);
    await settleNextRedirect(page, until(options?.waitUntil));
    return response;
  };
}
