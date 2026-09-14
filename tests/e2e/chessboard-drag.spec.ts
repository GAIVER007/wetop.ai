import { expect, test } from '@playwright/test';
import { cardTab } from './card-tabs';

/**
 * Переселение перетаскиванием в шахматке: администратор тянет клетку брони на другую строку-ячейку
 * той же категории. Проверяется то, что видит стойка: вопрос с номером брони и ячейкой, после
 * подтверждения — на карточке брони новая ячейка, на шахматке новая клетка занята, старая свободна.
 * Гость вымышленный (ADR-010), бронь отменяется в конце; метка E2E-АВТОТЕСТ — для уборки и сверок.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 14;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
const DORM = 'exely-5074688'; // dorm: свободные койки одной категории есть всегда

test('перетаскивание клетки брони на свободную койку той же категории переселяет с даты клетки', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const arrival = plus(12);
  const departure = plus(14); // две ночи: обе клетки должны переехать

  // ── бронь на койке A ──────────────────────────────────────────────────────────────────────
  await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitA = (await unitSelect.locator('option').nth(1).getAttribute('value'))!;
  const unitB = (await unitSelect.locator('option').nth(2).getAttribute('value'))!;
  expect(unitB).not.toBe(unitA);
  await unitSelect.selectOption(unitA);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-переезд');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  await expect(page.getByTestId('stay-row').first().locator('td').first()).toHaveText(unitA);

  // ── шахматка: тянем клетку заезда с A на строку B ─────────────────────────────────────────
  await page.goto(`/chessboard?from=${arrival}&to=${departure}`);
  const rowA = page.locator(`[data-testid="unit-row"][data-unit-code="${unitA}"]`);
  const rowB = page.locator(`[data-testid="unit-row"][data-unit-code="${unitB}"]`);
  const source = rowA.locator(`[data-testid="stay-cell"][data-date="${arrival}"]`);
  await expect(source).toHaveAttribute('data-number', number);
  // койка B на эти ночи свободна — иначе сервер откажет (409), и тест проверял бы не переезд
  await expect(rowB.locator(`td[data-date="${arrival}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(rowB.locator(`td[data-date="${plus(13)}"]`)).toHaveAttribute('data-state', 'FREE');

  page.once('dialog', (d) => {
    expect(d.message()).toBe(`Переселить бронь ${number} в ячейку ${unitB} с даты ${arrival}?`);
    void d.accept();
  });
  await source.dragTo(rowB.locator(`td[data-date="${arrival}"]`));

  // после переселения сетка перерисована с сервера: обе ночи на B, A свободна, ошибки нет
  await expect(rowB.locator(`[data-testid="stay-cell"][data-number="${number}"]`)).toHaveCount(2);
  await expect(rowA.locator(`td[data-date="${arrival}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(rowA.locator(`td[data-date="${plus(13)}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(page.getByTestId('drag-error')).toHaveCount(0);
  await page.screenshot({ path: 'reports/screenshots/chessboard-drag.png', fullPage: false });

  // ── карточка брони: ячейка B ──────────────────────────────────────────────────────────────
  await page.goto(`/reservations/${number}`);
  // ячейка — первая колонка строки проживания; проверять всю строку нельзя: там даты с теми же цифрами
  const unitCell = page.getByTestId('stay-row').first().locator('td').first();
  await expect(unitCell).toHaveText(unitB);
  await expect(unitCell).not.toHaveText(unitA);

  // прибрать за собой: бронь отменяется, койка освобождается
  page.once('dialog', (d) => d.accept());
  await cardTab(page, 'Действия');
  await page.getByTestId('cancel-reservation').click();
  await cardTab(page, 'Обзор');
  await expect(page.getByTestId('stay-row').first()).toContainText('отменена');
});
