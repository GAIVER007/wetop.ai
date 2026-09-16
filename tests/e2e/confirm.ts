import { expect, type Page } from '@playwright/test';

/**
 * Окно подтверждения стойки (`ConfirmDialog`, DESIGN.md §8) вместо `window.confirm`: с 16.09.2026 (срез 7.3)
 * отмена, незаезд и выселение с долгом спрашивают через него, показывая сумму до подтверждения.
 * Тест нажимает кнопку, названную действием, как это делает администратор.
 */
export async function confirmDialog(page: Page, button: string, expectText?: string | RegExp) {
  // именно окно подтверждения: выезжающая карточка брони на шахматке — тоже role=dialog
  const dialog = page.locator('dialog[data-testid="confirm-dialog"][open]');
  await expect(dialog).toBeVisible();
  if (expectText) await expect(dialog).toContainText(expectText);
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(page.locator('dialog[data-testid="confirm-dialog"][open]')).toHaveCount(0);
}
