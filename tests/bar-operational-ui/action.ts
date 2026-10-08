import { expect, type Locator, type Page } from '@playwright/test';

/** Assert UI state only after the submitted server action has delivered its complete response. */
export async function submitServerAction(page: Page, button: Locator): Promise<void> {
  const response = page.waitForResponse(value => value.request().method() === 'POST' && !!value.request().headers()['next-action']);
  await button.click();
  const completed = await response;
  expect(completed.status()).toBe(200);
  expect(await completed.finished()).toBeNull();
}
