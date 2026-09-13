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
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
