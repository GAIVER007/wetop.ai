import { expect, test } from './fixtures';
import { cardTab } from './card-tabs';
import { confirmAction, confirmDialog } from './confirm';
import { roomiestCategory } from './pick-category';

/**
 * Групповая бронь из формы и правка готовой брони (plans/plan-2026-09-09-closing.md, ADR-020).
 * Гости вымышленные (ADR-010). Проверяется то, что видит администратор:
 *  — «Количество мест» = 2 даёт два проживания на двух разных койках, и в календаре две клетки с номером брони;
 *  - заметки и источник правятся с карточки, число гостей в действиях неизменно;
 *  — «Закрыть счёт» появляется только при нулевом балансе и закрывает счёт.
 * Ограничения продаж (ADR-020) здесь не ставятся: стоп-продажа на живой категории ушла бы в каналы —
 * они проверены контрактным тестом apps/api/src/reservations/reservations.controller.test.ts.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 18;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};

test('групповая бронь на 2 койки → две клетки шахматки; правка заметок и источника, неизменное число гостей; ручное закрытие счёта', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const arrival = plus(12);
  const departure = plus(13);
  // групповая бронь на две койки — значит, в категории нужны минимум две свободные
  const DORM = await roomiestCategory(request, arrival, departure, 2);

  // ── Форма: «Количество мест» = 2, конкретная ячейка не выбирается ─────────────────────────
  await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  // источник и заметки с 02.10 под свёрнутым «Дополнительно» (booking-compact); open — без переключения
  await form.locator('details:has(select[name="source"])').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('select[name="source"]').selectOption('PHONE');
  await form.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  await expect(form.locator('select[name="unitCode"]')).toHaveCount(1);
  await form.locator('input[name="quantity"]').fill('2');
  await expect(form.locator('select[name="unitCode"]')).toHaveCount(0);
  await expect(form.getByTestId('group-hint')).toContainText('2 проживания');
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-группа');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();

  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  const rows = page.getByRole('main').getByTestId('stay-row');
  await expect(rows).toHaveCount(2);
  const unitA = (await rows.nth(0).locator('td').first().innerText()).trim();
  const unitB = (await rows.nth(1).locator('td').first().innerText()).trim();
  expect(unitA).not.toBe(unitB);
  expect(unitA).not.toContain('не назначена');
  expect(unitB).not.toContain('не назначена');
  // по счёту на каждое проживание
  await expect(page.getByRole('main').getByTestId('folio-panel')).toHaveCount(2);
  await page.screenshot({ path: 'reports/screenshots/group-reservation-card.png', fullPage: true });

  // ── Шахматка: две клетки с номером брони ──────────────────────────────────────────────────
  await page.goto(`/chessboard?from=${arrival}&to=${departure}`);
  // только плашки: с C2 (20.09) в клетке есть и ссылки меню «⋯» (карточка, «Переселить») — они не клетки
  await expect(page.locator(`[data-testid="stay-cell"][data-number="${number}"]`)).toHaveCount(2);
  await page.screenshot({ path: 'reports/screenshots/group-reservation-chessboard.png' });

  // ── Правка: заметки и источник ────────────────────────────────────────────────────────────
  await page.goto(`/reservations/${number}`);
  const edit = page.getByRole('main').getByTestId('edit-reservation-form');
  await cardTab(page, 'Действия');
  await edit.locator('select[name="source"]').selectOption('WHATSAPP');
  await edit.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ · поздний заезд, ключ у соседа');
  await edit.getByRole('button', { name: 'Сохранить' }).click();
  // текст есть и в подписи, и в поле ввода — проверяем именно подпись на карточке
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('reservation-notes')).toContainText(
    'поздний заезд, ключ у соседа',
  );
  await expect(page.locator('main')).toContainText('WhatsApp');

  // Число гостей задано при создании, в действиях оно недоступно для изменения.
  await cardTab(page, 'Действия');
  await expect(page.locator('[data-testid^="guests-form-"]')).toHaveCount(0);
  await expect(page.getByRole('main').locator('input[name="adults"]')).toHaveCount(0);
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-guests-count').first()).toContainText(
    '· 1',
  );

  // ── Ручное закрытие счёта: кнопки нет при долге, есть при нулевом балансе ─────────────────
  const panel = page.getByRole('main').getByTestId('folio-panel').first();
  await cardTab(page, 'Счета');
  await expect(panel.locator('[data-testid^="close-folio-"]')).toHaveCount(0);
  await panel.getByTestId('payment-form').getByRole('button', { name: 'Проверить оплату' }).click();
  await panel
    .getByTestId('payment-form')
    .getByRole('button', { name: 'Подтвердить оплату' })
    .click();
  await expect(panel.getByTestId('folio-balance')).toContainText('оплачено');
  await panel.locator('[data-testid^="close-folio-"]').click();
  await confirmAction(page, 'Закрыть счёт');
  await expect(panel.getByTestId('folio-closed')).toBeVisible();
  await expect(panel.getByTestId('payment-form')).toHaveCount(0);
  await page.screenshot({ path: 'reports/screenshots/desk-edit-folio-closed.png', fullPage: true });

  // прибрать за собой: бронь отменяется, койки освобождаются
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmDialog(page, 'Подтвердить отмену');
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('отменена');
});
