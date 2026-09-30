import { expect, type Page } from '@playwright/test';

export type CardTab = 'Обзор' | 'Счета' | 'Действия' | 'История';

/**
 * Карточка брони WETOP разложена по вкладкам (PR #2, ADR-035): счёт и действия скрыты, пока вкладка не открыта.
 * Тест переключает вкладку так же, как администратор; уже открытую не трогает. После `page.goto` открыт «Обзор»,
 * после действия на странице (server action) остаётся та вкладка, где его выполнили.
 */
export async function cardTab(page: Page, name: CardTab) {
  const tab = page
    .getByRole('tablist', { name: 'Разделы карточки брони' })
    .getByRole('tab', { name, exact: true });
  // Щелчок, попавший на обновление карточки после действия, теряется: карточка возвращает вкладку, где действие
  // выполнили. 28.09.2026 так `full-day` 30 с ждал «Обзор» после выезда — поэтому щёлкаем, пока вкладка не откроется.
  await expect(async () => {
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}
