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
test('главная открывается с корня; заезд на дату виден в «Требуют внимания»', async ({
  page,
  request,
}) => {
  await page.goto('/');
  // ADR-180: задачи и события дня на Главной, денежный период на Финансах.
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Главная', exact: true })).toBeVisible();
  await page.goto('/finance');
  await expect(page.getByRole('heading', { name: 'Финансы', exact: true })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Готовые периоды', exact: true })
      .getByRole('link', { name: 'Месяц', exact: true }),
  ).toHaveClass(/is-active/);

  // Заводим заезд на выбранную дату и проверяем рост очереди «Требуют внимания».
  const day = plus(0);
  await page.goto('/today');
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
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

  await page.goto('/today');
  await page.getByRole('button', { name: 'Все задачи', exact: true }).click();
  // бронь без ячейки — в очереди критичным, стойка видит причину
  await expect(unassigned).toHaveAttribute('data-count', String(unassignedBefore + 1));
  await expect(unassigned).toHaveAttribute('data-severity', 'critical');
  if (unassignedBefore < 3)
    await expect(unassigned.getByRole('link', { name: new RegExp(number) })).toContainText(
      'номер не назначен',
    );
  // Риски относятся к сегодняшнему дню.
  await expect(page.getByTestId('owner-risks')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Главная', exact: true})).toBeVisible();

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

  // Прошлый финансовый период не меняет задачи текущего дня на Главной.
  await page.goto('/finance?from=2026-08-15&to=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Финансы' })).toBeVisible();
  await expect(page.getByTestId('period-form').getByLabel('Период: с', { exact: true })).toHaveValue('2026-08-15');
  await expect(page.getByTestId('period-form').getByLabel('Период: по', { exact: true })).toHaveValue('2026-08-15');
  await expect(page.getByRole('main').getByTestId('owner-risks')).toHaveCount(0);
  await page.goto('/today');
  await expect(page.getByRole('main').getByTestId('owner-risks')).toBeVisible();
  await page.getByRole('button', {name: 'Все задачи', exact: true}).click();
  await expect(unassigned).toHaveAttribute('data-count', String(unassignedBefore + 1));
  await page.goto('/management/analytics?date=2026-08-15');
  await expect(page.getByRole('main').getByTestId('pa-period')).toContainText('15 августа');
});
