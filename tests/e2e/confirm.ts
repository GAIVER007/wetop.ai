import { expect, type Page } from '@playwright/test';

/**
 * Окно подтверждения стойки (`ConfirmDialog`, DESIGN.md §8, §15) вместо `window.confirm`: с 16.09.2026
 * (срез 7.3) отмена, незаезд и выселение с долгом спрашивают через него, показывая сумму до подтверждения.
 *
 * Прежде тесты ловили окно браузера через `page.once('dialog', …)` — его надо было подписать ДО клика.
 * Теперь вопрос задаёт сама страница, поэтому порядок обычный: нажали действие, прочитали вопрос,
 * нажали кнопку в окне. Кнопка названа действием («Отменить бронь»), как её нажимает администратор.
 *
 * Открытое окно — только одно, но `<dialog>` на странице несколько: их держит каждая панель с
 * действиями (карточка брони — и «Счета», и «Действия»), а выезжающая карточка брони на шахматке —
 * тоже role=dialog. Закрытые не имеют атрибута `open`, поэтому ищем именно открытое окно подтверждения.
 */
const openDialog = (page: Page) => page.locator('dialog[open][data-testid="confirm-dialog"]');

/** Нажать кнопку действия в открытом окне; `expectText` — что окно обязано сказать до нажатия (сумма, штраф). */
export async function confirmDialog(page: Page, button: string, expectText?: string | RegExp) {
  const dialog = openDialog(page);
  await expect(dialog, 'окно подтверждения не открылось').toHaveCount(1);
  if (expectText) await expect(dialog).toContainText(expectText);
  await dialog.getByRole('button', { name: button, exact: true }).click();
  await expect(openDialog(page)).toHaveCount(0);
}

/** То же без проверки текста — для окон вне карточки (переселение на шахматке, закрытие счёта). */
export async function confirmAction(page: Page, label: string) {
  await confirmDialog(page, label);
}

/** Отказ в окне с кнопкой отказа по умолчанию («Оставить как есть»): действие не выполняется. */
export async function declineAction(page: Page) {
  await confirmDialog(page, 'Оставить как есть');
}

/** Самое частое: отмена брони с карточки — прибрать за собой в конце сценария. */
export async function confirmCancelReservation(page: Page) {
  await confirmDialog(page, 'Отменить бронь');
}
