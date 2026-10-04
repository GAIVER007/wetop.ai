import { expect, test } from './fixtures';
import { roomiestCategory } from './pick-category';

const today = new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
// This scenario intentionally verifies today's operations; other BASE windows start at +3.
const BASE = 0;
const plus = (n: number) => {
  const x = new Date(`${today}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + BASE + n);
  return x.toISOString().slice(0, 10);
};

/** Дашборд: операции всегда за сегодня, финансовый период выбирается отдельно.
 * Новая бронь должна изменить счётчик и задачи; аналитика читает ту же базу.
 */
test('главная открывается с корня; заезд на дату виден в счётчике и в «Требуют внимания»', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  // деньги по умолчанию за месяц, виджеты сверху всегда о сегодняшнем дне (03.10.2026)
  await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // Только видимый блок: Next также содержит скрытые потоковые сегменты.
  const strip = page.getByRole('region', { name: 'Гостиница сегодня' });
  const arrivals = async () => Number(await strip.getByTestId('tw-arrivals').innerText());

  // Заводим заведомый заезд на выбранную дату и проверяем, что счётчик вырос, а бронь без ячейки
  // попала в «Требуют внимания» с причиной. Сравнение счётчика с самим собой ничего бы не доказывало.
  const day = plus(0);
  await page.goto(`/today?date=${day}`);
  const before = await arrivals();
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  // A3: брони без ячейки — одна строка очереди с числом; брони под ней — первые три
  const tasks = page.getByRole('region', { name: 'Требуют внимания' });
  const unassigned = tasks.locator('[data-event="unassigned"]');
  await expect(tasks.getByRole('heading', { name: 'Требуют внимания' })).toBeVisible();
  const unassignedBefore = (await unassigned.count())
    ? Number(await unassigned.getAttribute('data-count'))
    : 0;

  await page.goto(`/reservations/new?arrival=${day}&departure=${plus(1)}`);
  const form = page.getByRole('main').getByTestId('new-reservation-form');
  // источник и заметки с 02.10 под свёрнутым «Дополнительно» (booking-compact); open — без переключения
  await form.locator('details:has(select[name="source"])').evaluate((d) => {
    (d as HTMLDetailsElement).open = true;
  });
  await form.locator('select[name="source"]').selectOption('WALK_IN');
  await form
    .locator('select[name="accommodationTypeCode"]')
    .selectOption(await roomiestCategory(request, day, plus(1)));
  await form.locator('input[name="firstName"]').fill('Гость');
  await form.locator('input[name="lastName"]').fill('Тест-день');
  await form.locator('textarea[name="notes"]').fill('E2E-АВТОТЕСТ'); // сверка исключает автотесты
  await form.getByRole('button', { name: 'Создать бронь' }).click();
  await expect(page).toHaveURL(/\/reservations\/\d{8}-[A-Z0-9]{6}$/);
  const number = page.url().split('/').pop()!;

  await page.goto(`/today?date=${day}`);
  expect(await arrivals()).toBe(before + 1);
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  // бронь без ячейки — в очереди критичным, стойка видит причину
  await expect(unassigned).toHaveAttribute('data-count', String(unassignedBefore + 1));
  await expect(unassigned).toHaveAttribute('data-severity', 'critical');
  if (unassignedBefore < 3)
    await expect(unassigned.getByRole('link', { name: new RegExp(number) })).toContainText(
      'нет ячейки',
    );
  // Операции относятся к сегодняшнему дню.
  await expect(strip).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Начало периода')).toHaveValue(day);

  await page.screenshot({ path: 'reports/screenshots/desk-today.png', fullPage: true });

  // Показатели за период — «Аналитика» из живых шахматки и счетов; прежний адрес ведёт туда с той же датой
  await page.goto(`/management/dashboard?date=${day}`);
  await expect(page).toHaveURL(new RegExp(`/management/analytics\\?date=${day}$`));
  const kpi = page.getByRole('region', { name: 'Показатели за период' });
  await expect(kpi.getByTestId('pa-kpi-occupancy')).toContainText('%');
  await expect(kpi.getByTestId('pa-kpi-revenue')).toContainText('₸');
  expect(Number(await kpi.getByTestId('pa-kpi-bookings').innerText())).toBeGreaterThanOrEqual(1);
  await expect(page.getByRole('main').getByTestId('pa-chart-categories')).toBeVisible();
  // два дня: столбики по дням, сравнение с прошлым отрезком
  await page.goto(`/management/analytics?period=custom&from=${day}&to=${plus(1)}`);
  await expect(page.getByRole('main').getByTestId('pa-chart-occupancy')).toBeVisible();
  await expect(page.getByRole('main').getByTestId('pa-compare')).toContainText('Сравнение с');
  // «Загрузка» за тот же день: бронь без ячейки — в «Без размещения», категории — из календаря
  await page.goto(`/management/analytics/occupancy?date=${day}`);
  expect(
    Number(await page.getByRole('main').getByTestId('pa-kpi-unassigned').innerText()),
  ).toBeGreaterThanOrEqual(1);
  await expect(
    page.getByRole('main').getByTestId('statistics-table').locator('tbody tr').first(),
  ).toBeVisible();

  // Прошлый финансовый период не меняет сегодняшние операции гостиницы.
  await page.goto('/today?date=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('main').getByLabel('Начало периода')).toHaveValue('2026-08-15');
  await expect(page.getByRole('main').getByLabel('Конец периода')).toHaveValue('2026-08-15');
  expect(await arrivals()).toBe(before + 1);
  await expect(strip.getByRole('link', { name: 'Календарь', exact: true })).toHaveAttribute(
    'href',
    `/chessboard?from=${today}&to=${today}`,
  );
  await page.goto('/management/analytics?date=2026-08-15');
  await expect(page.getByRole('main').getByTestId('pa-period')).toContainText('15 августа');
});
