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
 * Главная (срез 14): показатели за период сверху, полоса стойки на дату снизу.
 * Заезд, заведённый на дату, должен попасть в счётчик заездов и в «Требуют внимания» с причиной.
 */
test('главная открывается с корня; заезд на дату виден в счётчике и в «Требуют внимания»', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  // период по умолчанию — сегодня; показатели считаются из живых шахматки и счетов
  await expect(page.getByRole('link', { name: 'Сегодня', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // Показатели доезжают отдельным потоковым куском: пока он встраивается, та же разметка есть в двух
  // копиях — читаем только видимую область показателей, как и полосу стойки ниже
  const kpi = page.getByRole('region', { name: 'Показатели за период' });
  await expect(kpi.getByTestId('kpi-occupancy')).toContainText('%');
  await expect(kpi.getByTestId('kpi-revenue')).toContainText('₸');
  await expect(page.getByTestId('chart-categories').first()).toBeVisible();
  // месяц: столбики по дням, сравнение с прошлым отрезком
  await page.getByRole('link', { name: 'Этот месяц', exact: true }).first().click();
  await expect(page.getByTestId('chart-daily').first()).toBeVisible();
  await expect(page.getByTestId('kpi-compare').first()).toContainText(
    'Сравнение с предыдущим периодом',
  );

  // Только видимая полоса стойки: пока её кусок доезжает потоком, та же разметка лежит в скрытом сегменте
  const strip = page.getByRole('region', { name: 'Сегодня на стойке' });
  const card = async (id: string) => Number(await strip.getByTestId(id).innerText());

  // Заводим заведомый заезд на выбранную дату и проверяем, что счётчик вырос, а бронь без ячейки
  // попала в «Требуют внимания» с причиной. Сравнение счётчика с самим собой ничего бы не доказывало.
  const day = plus(6);
  await page.goto(`/today?date=${day}`);
  const before = await card('c-arrivals');

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
  const tasks = page.getByRole('complementary', { name: 'Задачи и размещение' });
  await expect(tasks).toContainText(number);
  // бронь без ячейки — стойка должна видеть причину
  await expect(tasks.getByRole('link', { name: new RegExp(number) })).toContainText('нет ячейки');
  // полоса стойки — на выбранную дату, и период тот же день
  await expect(page.getByRole('region', { name: 'Сегодня на стойке' })).toContainText(
    'На стойке',
  );
  await expect(page.getByLabel('Период: с')).toHaveValue(day);

  await page.screenshot({ path: 'reports/screenshots/desk-today.png', fullPage: true });

  // на дату из прошлого показатели тоже строятся
  await page.goto('/today?date=2026-08-15');
  await expect(page.getByRole('heading', { name: 'Главная' })).toBeVisible();
  await expect(page.getByLabel('Период: с')).toHaveValue('2026-08-15');
  await expect(page.getByTestId('period-caption')).toContainText('15 августа');
  expect(Number.isInteger(await card('c-arrivals'))).toBe(true);
});
