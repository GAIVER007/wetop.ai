import { test as base } from '@playwright/test';
import { guardNextRedirects } from '../tools/next-redirect';

/** Тот же Playwright, но `goto`/`reload` ждут потоковый редирект Next (TESTING.md §4, 12.10.2026) */
export const test = base.extend({
  page: async ({ page }, use) => {
    guardNextRedirects(page);
    await use(page);
  },
});
export { expect } from '@playwright/test';
export type { Page, APIRequestContext, Locator } from '@playwright/test';
