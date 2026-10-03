import { expect, test, FIXTURE_API } from './fixtures';

/**
 * B5 «Состояния в списке броней» (tasks/todo.md): отказ API не выглядит как ноль броней — заголовок,
 * фильтры и адрес с датами остаются, вместо строк экран сбоя со следующим шагом; «Повторить загрузку»
 * возвращает список с теми же условиями; пока данные идут, виден скелетон с подписью словом.
 */
const API = FIXTURE_API;
const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/control`, { data: {} });
});

test('отказ API: заголовок и фильтры на месте, повтор возвращает список с теми же условиями', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { failPath: '/hotel/reservations' } });
  await page.goto(`/reservations?from=${today}&to=${today}&status=CONFIRMED&q=Тестовый`);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Брони');
  await expect(main.getByLabel('Поиск броней')).toHaveValue('Тестовый');
  const failure = main.getByTestId('reservations-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(failure.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
  // не «0 бронирований» и не пустое состояние
  await expect(main.getByTestId('reservations-empty')).toHaveCount(0);
  await expect(main.getByTestId('directory-meta')).toHaveCount(0);
  await expect(page).toHaveURL(/status=CONFIRMED/);
  // связь вернулась — повтор с теми же условиями
  await request.post(`${API}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('reservations-table')).toBeVisible();
  await expect(main.getByTestId('reservations-error')).toHaveCount(0);
  await expect(main.getByTestId('directory-meta')).toContainText('Подтверждены');
  await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}.*status=CONFIRMED.*q=/);
  await expect(main.getByLabel('Поиск броней')).toHaveValue('Тестовый');
});

test('отклонённый запрос: код и совет проверить адрес, без ссылки на подключения', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, {
    data: { failPath: '/hotel/reservations', failStatus: 400 },
  });
  await page.goto('/reservations');
  const failure = page.getByRole('main').getByTestId('reservations-error');
  await expect(failure).toContainText('Сервер отклонил запрос (код 400)');
  await expect(failure).toContainText('проверьте адрес страницы и даты');
  await expect(failure.getByRole('link', { name: 'Подключения API' })).toHaveCount(0);
});

test('пока список идёт — скелетон с подписью словом, затем таблица', async ({ page, request }) => {
  await request.post(`${API}/__test/control`, {
    data: { delayPath: '/hotel/reservations', delayMs: 2500 },
  });
  await page.goto('/reservations', { waitUntil: 'commit' });
  const loading = page.getByTestId('reservations-loading');
  await expect(loading).toBeVisible();
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  await expect(loading.getByRole('status')).toHaveText('Загружаем список броней…');
  await expect(page.getByRole('heading', { name: 'Брони', level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('main').getByTestId('reservations-table')).toBeVisible();
  await expect(loading).toHaveCount(0);
});
