import { expect, test } from './fixtures';
import { roomiestCategory } from './pick-category';

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

/**
 * Главная — рабочий экран дня (A1, ADR-103): полоса стойки и задачи; показатели за период — в
 * «Аналитике» (`/management/analytics`, ADR-114; прежний адрес `/management/dashboard` ведёт туда,
 * определения ADR-047 те же). Заезд, заведённый на дату, должен попасть в счётчик заездов, в
 * «Требуют внимания» с причиной и в брони «Аналитики» за этот день.
 */
test('главная открывается с корня; заезд на дату виден в счётчике и в «Требуют внимания»', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  // день по умолчанию — сегодня
  await expect(page.getByRole('link', { name: 'Сегодня', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Только видимая полоса стойки: пока её кусок доезжает потоком, та же разметка лежит в скрытом сегменте
  const strip = page.getByRole('region', { name: 'Сегодня на стойке' });
  const card = async (id: string) => Number(await strip.getByTestId(id).innerText());

  // Заводим заведомый заезд на выбранную дату и проверяем, что счётчик вырос, а бронь без ячейки
  // попала в «Требуют внимания» с причиной. Сравнение счётчика с самим собой ничего бы не доказывало.
  const day = plus(6);
  await page.goto(`/today?date=${day}`);
  const before = await card('c-arrivals');
  // A3: брони без ячейки — одна строка очереди с числом; брони под ней — первые три
  const tasks = page.getByRole('region', { name: 'Требуют внимания' });
  const unassigned = tasks.locator('[data-event="unassigned"]');
  await expect(tasks.getByRole('heading', { name: 'Требуют внимания' })).toBeVisible();
  const unassignedBefore = (await unassigned.count())
    ? Number(await unassigned.getAttribute('data-count'))
    : 0;

  await page.goto(`/reservations/new?arrival=${day}&departure=${plus(7)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, day, plus(7)));
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-день');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;

  await page.goto(`/today?date=${day}`);
  expect(await card('c-arrivals')).toBe(before + 1);
  // бронь без ячейки — в очереди критичным, стойка видит причину
  await expect(unassigned).toHaveAttribute('data-count', String(unassignedBefore + 1));
  await expect(unassigned).toHaveAttribute('data-severity', 'critical');
  if (unassignedBefore < 3)
    await expect(unassigned.getByRole('link', { name: new RegExp(number) })).toContainText('нет ячейки');
  // полоса стойки — на выбранную дату; день стоит в полосе дня
  await expect(page.getByRole('region', { name: 'Сегодня на стойке' })).toContainText('На стойке');
  await expect(page.getByRole('main').getByLabel('День стойки: дата')).toHaveValue(day);

  await page.screenshot({ path: 'reports/screenshots/desk-today.png', fullPage: true });

  // Показатели за период — «Аналитика» из живых шахматки и счетов; прежний адрес ведёт туда с той же датой
  await page.goto(`/management/dashboard?date=${day}`);
  await expect(page).toHaveURL(new RegExp(`/management/analytics\\?date=${day}$`));
  const kpi = page.getByRole('region', { name: 'Показатели за период' });
  await expect(kpi.getByTestId('pa-kpi-occupancy')).toContainText('%');
  await expect(kpi.getByTestId('pa-kpi-revenue')).toContainText('₸');
  expect(Number(await kpi.getByTestId('pa-kpi-bookings').innerText())).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('pa-chart-categories')).toBeVisible();
  // два дня: столбики по дням, сравнение с прошлым отрезком
  await page.goto(`/management/analytics?period=custom&from=${day}&to=${plus(7)}`);
  await expect(page.getByTestId('pa-chart-occupancy')).toBeVisible();
  await expect(page.getByTestId('pa-compare')).toContainText('Сравнение с');
  // «Загрузка» за тот же день: бронь без ячейки — в «Без размещения», категории — из шахматки
  await page.goto(`/management/analytics/occupancy?date=${day}`);
  expect(Number(await page.getByTestId('pa-kpi-unassigned').innerText())).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('statistics-table').locator('tbody tr').first()).toBeVisible();

  // на дату из прошлого полоса тоже строится, а показатели за день — на своём экране
  await page.goto('/today?date=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('main').getByLabel('День стойки: дата')).toHaveValue('2026-08-15');
  expect(Number.isInteger(await card('c-arrivals'))).toBe(true);
  await page.goto('/management/analytics?date=2026-08-15');
  await expect(page.getByRole('main').getByTestId('pa-period')).toContainText('15 августа');
});
