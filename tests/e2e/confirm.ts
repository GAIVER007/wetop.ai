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
 * действиями (карточка брони — и «Счета», и «Действия»), а выезжающая карточка брони в календаре —
 * тоже role=dialog. Закрытые не имеют атрибута `open`, поэтому ищем именно открытое окно подтверждения.
 */
const openDialog = (page: Page) => page.locator('dialog[open][data-testid="confirm-dialog"]');

/**
 * Отказы стойки (`role="alert"`) без объявителя переходов Next.js: он тоже `role="alert"` и после действия читает новый
 * заголовок страницы («WETOP: рабочее пространство»), а сбоем это не является (PR #852, 25.10.2026: незаезд прошёл, тест
 * упал на объявителе).
 */
const errorAlerts = (page: Page) =>
  page.getByRole('alert').and(page.locator(':not(#__next-route-announcer__):not(next-route-announcer *)'));

/** Нажать кнопку действия в открытом окне; `expectText` — что окно обязано сказать до нажатия (сумма, штраф). */
export async function confirmDialog(page: Page, button: string, expectText?: string | RegExp) {
  const dialog = openDialog(page);
  await expect(dialog, 'окно подтверждения не открылось').toHaveCount(1);
  if (expectText) await expect(dialog).toContainText(expectText);
  const previousAlerts = await errorAlerts(page).allTextContents();
  await dialog.getByRole('button', { name: button, exact: true }).click();
  let outcome = '';
  await expect.poll(async () => {
    const alerts = await errorAlerts(page).filter({ visible: true }).allTextContents();
    const error = alerts.find((text) => text.trim() && !previousAlerts.includes(text));
    if (error) return (outcome = `error: ${error.trim()}`);
    if (await dialog.count() === 0) return (outcome = 'closed');
    // Checkout alone has a known follow-up confirmation for outstanding debt.
    const next = dialog.getByRole('button', { name: 'Выселить с долгом', exact: true });
    if (button === 'Выселить' && await next.count() === 1 && await next.isEnabled())
      return (outcome = 'next');
    return (outcome = 'pending');
  }, { message: `Подтверждение «${button}» не завершилось` }).toMatch(/^(closed|next|error:)/);
  if (outcome.startsWith('error:')) throw new Error(outcome);
}

/** То же без проверки текста — для окон вне карточки (переселение в календаре, закрытие счёта). */
export async function confirmAction(page: Page, label: string) {
  await confirmDialog(page, label);
}

/** Отказ в окне с кнопкой отказа по умолчанию («Оставить как есть»): действие не выполняется. */
export async function declineAction(page: Page) {
  await confirmDialog(page, 'Оставить как есть');
}

/** Самое частое: отмена брони с карточки — прибрать за собой в конце сценария. */
export async function confirmCancelReservation(page: Page) {
  await confirmDialog(page, 'Подтвердить отмену');
}
