import { expect, test } from './fixtures';

const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
/*
 * Свой отрезок будущих суток. Два спека на одних ночях дерутся за одни и те же койки:
 * прогон в два воркера падал то на одном тесте, то на другом, а поодиночке был зелёным.
 * Карта отрезков — tests/README.md, раздел «Окна дат». Новый спек — новый отрезок.
 */
const BASE = 4;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};

/** Рабочий день стойки: заезды, выезды и живущие на дату, и что мешает заселить. */
test('экран «Сегодня» открывается с корня и показывает три списка на дату', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Обзор дня' })).toBeVisible();

  // три группы всегда на месте, даже если пусто
  for (const g of ['arrivals', 'departures', 'inhouse'])
    await expect(page.getByTestId(`group-${g}`)).toBeVisible();

  const rows = async (g: string) => page.getByTestId(`row-${g}`).count();
  const card = async (id: string) => Number(await page.getByTestId(id).innerText());

  // Заводим заведомый заезд на выбранную дату и проверяем, что он реально попал в список заездов,
  // а счётчик вырос. Сравнение счётчика со строками той же таблицы ничего бы не доказывало.
  const day = plus(6);
  const before = { count: 0, rows: 0 };
  await page.goto(`/today?date=${day}`);
  before.count = await card('c-arrivals');
  before.rows = await rows('arrivals');
  expect(before.count).toBe(before.rows);

  await page.goto(`/reservations/new?arrival=${day}&departure=${plus(7)}`);
  const form = page.getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form.locator('select[name="accommodationTypeCode"]').selectOption('exely-5074688');
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-день');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;

  await page.goto(`/today?date=${day}`);
  await expect(page.getByTestId('group-arrivals')).toContainText(number);
  expect(await card('c-arrivals')).toBe(before.count + 1);
  expect(await rows('arrivals')).toBe(before.rows + 1);
  // бронь без ячейки — стойка должна видеть причину
  await expect(page.getByTestId('group-arrivals')).toContainText('нет ячейки');

  await page.screenshot({ path: 'reports/screenshots/desk-today.png', fullPage: true });

  // на дату из прошлого списки тоже строятся
  await page.goto('/today?date=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Обзор дня' })).toBeVisible();
  await expect(page.getByLabel('Дата рабочего дня')).toHaveValue('2026-08-15');
  expect(await card('c-arrivals')).toBe(await rows('arrivals'));
});
