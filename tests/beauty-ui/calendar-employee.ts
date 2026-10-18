import type { Page } from '@playwright/test';
export async function chooseCalendarEmployee(page: Page, name: string) {
  await page.locator('.employee-filter summary').click();
  await page.locator('.employee-filter-list').getByRole('button', { name, exact: true }).click();
}
