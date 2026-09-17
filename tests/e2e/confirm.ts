import { expect, type Page } from '@playwright/test';

/**
 * Окно подтверждения стойки вместо системного `window.confirm` (DESIGN.md §8, §15; срез 7.3).
 *
 * Прежде тесты ловили окно браузера через `page.once('dialog', …)` — его надо было подписать ДО клика.
 * Теперь вопрос задаёт сама страница, поэтому порядок обычный: нажали действие, прочитали вопрос,
 * нажали кнопку в окне. Кнопка названа действием («Отменить бронь»), отказ — «Оставить как есть».
 */
/**
 * Открытое окно — только одно, но `<dialog>` на странице несколько: их держит каждая панель с
 * действиями (карточка брони — и «Счета», и «Действия»). Закрытые не имеют атрибута `open`,
 * поэтому ищем именно открытое: иначе Playwright видит три элемента и отказывается работать.
 */
const openDialog = (page: Page) => page.locator('dialog[open][data-testid="confirm-dialog"]');

export async function confirmAction(page: Page, label: string) {
  const dialog = openDialog(page);
  await expect(dialog, 'окно подтверждения не открылось').toHaveCount(1);
  await dialog.getByRole('button', { name: label, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** Отказ в том же окне: действие не выполняется. */
export async function declineAction(page: Page) {
  await confirmAction(page, 'Оставить как есть');
}

/** Самое частое: отмена брони с карточки — прибрать за собой в конце сценария. */
export async function confirmCancelReservation(page: Page) {
  await confirmAction(page, 'Отменить бронь');
}
