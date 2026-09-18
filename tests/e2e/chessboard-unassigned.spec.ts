import { expect, test } from '@playwright/test';
import { cardTab } from './card-tabs';
import { confirmCancelReservation } from './confirm';
import { roomiestCategory } from './pick-category';

/**
 * Строка «Без ячейки» на шахматке — паритет со строкой «Без номера» в Exely: проживание без назначения
 * не занимает клетку сетки, но стойка обязана видеть его на доске, а не только с карточки.
 * Путь через интерфейс: в форме новой брони ячейка «— назначить позже —». Проверяется то, что видит
 * стойка: блок над сеткой с числом, категорией, номером-ссылкой, датами и статусом; на сетке клетки
 * нет; доска, не задевающая ночи брони, её не показывает; после отмены бронь из блока исчезает.
 * Гость вымышленный (ADR-010), бронь отменяется в конце; метка E2E-АВТОТЕСТ — для уборки и сверок.
 */
const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 28;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};
const API = process.env.APP_API_URL ?? 'http://127.0.0.1:3001';

test('бронь без ячейки видна в блоке «Без ячейки» над сеткой, после отмены исчезает', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const arrival = plus(16);
  const departure = plus(18);
  const DORM = await roomiestCategory(request, arrival, departure);

  // ── бронь без ячейки из формы ─────────────────────────────────────────────────────────────
  await page.goto(`/reservations/new?arrival=${arrival}&departure=${departure}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption(DORM);
  const optionText = await form
    .locator(`select[name="accommodationTypeCode"] option[value="${DORM}"]`)
    .textContent();
  const categoryName = (optionText ?? '').replace(/\s*\(свободно \d+\)\s*$/, '').trim();
  expect(categoryName).not.toBe('');
  await form.locator('select[name="unitCode"]').selectOption({ value: '' }); // — назначить позже —
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-без-ячейки');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;
  await cardTab(page, 'Действия');
  await expect(page.getByText('ячейка не назначена').first()).toBeVisible();

  // ── шахматка: блок над сеткой ─────────────────────────────────────────────────────────────
  await page.goto(`/chessboard?from=${arrival}&to=${departure}`);
  const block = page.getByRole('main').getByTestId('unassigned-stays');
  await expect(block).toBeVisible();
  const count = Number(await block.getAttribute('data-count'));
  expect(count).toBeGreaterThanOrEqual(1);
  await expect(block).toContainText(`Без ячейки: ${count}`);
  await expect(block).toContainText(categoryName);
  const item = block.locator(`[data-testid="unassigned-stay"][data-number="${number}"]`);
  await expect(item).toHaveCount(1);
  // даты словами (§14), сырые — в datetime
  await expect(item.locator('time').nth(0)).toHaveAttribute('datetime', arrival);
  await expect(item.locator('time').nth(1)).toHaveAttribute('datetime', departure);
  await expect(item).toContainText('подтверждена');
  await expect(item.getByRole('link', { name: number })).toHaveAttribute(
    'href',
    `/reservations/${number}`,
  );
  // на сетке клетки этой брони нет — ячейка не назначена
  await expect(page.locator(`[data-testid="stay-cell"][data-number="${number}"]`)).toHaveCount(0);
  await page.screenshot({ path: 'reports/screenshots/chessboard-unassigned.png', fullPage: false });

  // ── API: в диапазоне доски бронь есть, вне его — нет ──────────────────────────────────────
  type Unassigned = { confirmationNumber: string; categoryCode: string; status: string };
  const inRange = await page.request.get(`${API}/chessboard?from=${arrival}&to=${departure}`);
  const listed = ((await inRange.json()).unassigned as Unassigned[]).find(
    (u) => u.confirmationNumber === number,
  );
  expect(listed).toMatchObject({ categoryCode: DORM, status: 'CONFIRMED' });
  // доска до plus(15) включительно: ночи [plus(10), plus(16)), заезд plus(16) их не задевает
  const outOfRange = await page.request.get(`${API}/chessboard?from=${plus(10)}&to=${plus(15)}`);
  expect(
    ((await outOfRange.json()).unassigned as Unassigned[]).map((u) => u.confirmationNumber),
  ).not.toContain(number);

  // ── ссылка ведёт на карточку ──────────────────────────────────────────────────────────────
  await item.getByRole('link', { name: number }).click();
  await expect(page).toHaveURL(new RegExp(`/reservations/${number}$`));
  await expect(page.getByRole('heading', { name: /Бронь/ })).toBeVisible();

  // ── прибрать за собой: отмена, и бронь уходит из блока ────────────────────────────────────
  await cardTab(page, 'Действия');
  await page.getByRole('main').getByTestId('cancel-reservation').click();
  await confirmCancelReservation(page);
  await cardTab(page, 'Обзор');
  await expect(page.getByRole('main').getByTestId('stay-row').first()).toContainText('отменена');
  await page.goto(`/chessboard?from=${arrival}&to=${departure}`);
  await expect(
    page.getByRole('main').getByTestId('unassigned-stays').locator(`[data-number="${number}"]`),
  ).toHaveCount(0);
});
