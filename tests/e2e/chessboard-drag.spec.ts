import { expect, test } from './fixtures';
import { unitOption } from './unit-options';
import { cardTab } from './card-tabs';
import { confirmAction, confirmDialog } from './confirm';
import { roomiestCategory } from './pick-category';

/**
 * Переселение перетаскиванием в календаре: администратор тянет клетку брони на другую строку-ячейку
 * той же категории. Проверяется то, что видит стойка: вопрос с номером брони и ячейкой, после
 * подтверждения — на карточке брони новая ячейка, в календаре новая клетка занята, старая свободна.
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

test('перетаскивание клетки брони на свободную койку той же категории переселяет с даты клетки', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const arrival = plus(12);
  const departure = plus(14); // две ночи: обе клетки должны переехать
  // Категория — та, где больше всего свободных мест: нужна вторая свободная койка той же категории
  const DORM = await roomiestCategory(request, arrival, departure, 2);

  // ── бронь на койке A ──────────────────────────────────────────────────────────────────────
  await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  // источник и заметки с 02.10 под свёрнутым «Дополнительно» (booking-compact); open — без переключения
  await form.locator('details:has(select[name="source"])').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  const unitSelect = form.locator('select[name="unitCode"]');
  const unitA = await unitOption(unitSelect);
  const unitB = await unitOption(unitSelect, 1);
  expect(unitB).not.toBe(unitA);
  await unitSelect.selectOption(unitA);
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-переезд');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  await expect(
    page.getByRole('main').getByTestId('stay-row').first().locator('td').first(),
  ).toHaveText(unitA);

  // ── шахматка: тянем клетку заезда с A на строку B ─────────────────────────────────────────
  await page.goto(
    `/chessboard?from=${arrival}&to=${departure}&category=${encodeURIComponent(DORM)}`,
  );
  const rowA = page
    .getByRole('main')
    .locator(`[data-testid="unit-row"][data-unit-code="${unitA}"]`);
  const rowB = page
    .getByRole('main')
    .locator(`[data-testid="unit-row"][data-unit-code="${unitB}"]`);
  const source = rowA.locator(`[data-testid="stay-cell"][data-date="${arrival}"]`);
  await expect(source).toHaveAttribute('data-number', number);
  // койка B на эти ночи свободна — иначе сервер откажет (409), и тест проверял бы не переезд
  await expect(rowB.locator(`td[data-date="${arrival}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(rowB.locator(`td[data-date="${plus(13)}"]`)).toHaveAttribute('data-state', 'FREE');

  // Реальный жест с несколькими dragover: одиночного dragTo недостаточно для preview/drop.
  const target = rowB.locator(`td[data-date="${arrival}"]`);
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  await source.hover();
  await page.mouse.down();
  const targetBox = (await target.boundingBox())!;
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 6,
  });
  await page.mouse.move(targetBox.x + targetBox.width / 2 + 3, targetBox.y + targetBox.height / 2, {
    steps: 2,
  });
  await expect(rowB.getByTestId('drop-ghost')).toBeVisible();
  await page.mouse.up();
  // вопрос стойки: номер брони в заголовке, ячейки и дата переезда — в теле
  const confirm = page.getByRole('main').getByTestId('confirm-dialog');
  await expect(confirm).toContainText(`Переселить бронь ${number}?`);
  await expect(confirm).toContainText(unitB);
  await confirmAction(page, 'Переселить');

  // после переселения сетка перерисована с сервера: обе ночи на B, A свободна, ошибки нет
  await expect(rowB.locator(`[data-testid="stay-cell"][data-number="${number}"]`)).toHaveCount(2);
  await expect(rowA.locator(`td[data-date="${arrival}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(rowA.locator(`td[data-date="${plus(13)}"]`)).toHaveAttribute('data-state', 'FREE');
  await expect(page.getByRole('main').getByTestId('drag-error')).toHaveCount(0);
  await page.screenshot({ path: 'reports/screenshots/chessboard-drag.png', fullPage: false });

  // ── карточка брони: ячейка B ──────────────────────────────────────────────────────────────
  await page.goto(`/reservations/${number}`);
  // ячейка — первая колонка строки проживания; проверять всю строку нельзя: там даты с теми же цифрами
  const unitCell = page.getByRole('main').getByTestId('stay-row').first().locator('td').first();
  await expect(unitCell).toHaveText(unitB);
  await expect(unitCell).not.toHaveText(unitA);

  // прибрать за собой: бронь отменяется, койка освобождается
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmDialog(page, 'Отменить бронь');
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('Отменена');
});
