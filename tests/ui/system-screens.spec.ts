import { expect, test } from '@playwright/test';

/**
 * D4 «Журнал и неисправности» (tasks/todo.md): выборка журнала названа словами, разделы — чипами, отказ API не
 * уносит экран (поиск и раздел остаются, вместо строк сбой с повтором), пустой результат называет условие и путь к
 * последним операциям, время в `<time>`; у «Неисправностей» отказ состояния сторожа — сбой с повтором, пустые
 * таблицы говорят, что это значит; на телефоне строки читаются без прокрутки вбок; загрузка — словом.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('журнал: выборка словами, разделы чипами, сбой без потери формы, пустой результат с причиной', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/journal');
  await expect(main.getByTestId('journal-meta')).toHaveText('Последние 3 операции');
  await expect(main.getByTestId('journal-meta')).not.toContainText(' · ');
  await expect(main.getByTestId('journal-row').first().locator('time')).toHaveAttribute(
    'datetime',
    /T08:30:00/,
  );
  // раздел — чипом с текущим состоянием, выборка пересчитана
  const filters = main.getByRole('navigation', { name: 'Раздел журнала' });
  await filters.getByRole('link', { name: 'сотрудники', exact: true }).click();
  await expect(page).toHaveURL(/type=user/);
  await expect(filters.getByRole('link', { name: 'сотрудники', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(main.getByTestId('journal-meta')).toHaveText('1 операция, раздел «сотрудники»');
  // пусто по условиям — условие названо, путь к последним операциям
  await page.goto('/journal?q=нет-такого&type=Reservation');
  const empty = main.getByTestId('journal-empty');
  await expect(empty).toContainText('Операций по запросу «нет-такого», раздел «брони» нет');
  await expect(main.getByTestId('journal-meta')).toContainText(
    '0 операций, по запросу «нет-такого», раздел «брони» (поиск по всей истории)',
  );
  await empty.getByRole('link', { name: 'Показать последние операции' }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(3);
  // отказ API: поиск и раздел на месте, повтор возвращает строки с теми же условиями
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/audit' } });
  await page.goto('/journal?q=TEST&type=Reservation');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Журнал действий');
  await expect(main.getByLabel('Поиск в журнале')).toHaveValue('TEST');
  const failure = main.getByTestId('journal-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('journal-table')).toHaveCount(0);
  await expect(main.getByTestId('journal-meta')).toHaveCount(0);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('journal-row')).toHaveCount(1);
  await expect(page).toHaveURL(/q=TEST/);
  // телефон: строка карточкой, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/journal');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'журнал шире экрана телефона').toBeLessThanOrEqual(layout.viewport + 1);
  const row = main.getByTestId('journal-row').first();
  await expect(row.locator('td').nth(0)).toHaveCSS('grid-column-start', '2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом
  await request.post(`${fixture}/__test/control`, { data: { delayPath: '/audit', delayMs: 2500 } });
  await page.goto('/journal', { waitUntil: 'commit' });
  await expect(main.getByTestId('journal-loading')).toContainText('Загружаем журнал действий');
  await expect(main.getByTestId('journal-row').first()).toBeVisible({ timeout: 15_000 });
});

test('неисправности: сбой состояния сторожа с повтором, пустые таблицы объяснены, время в <time>, телефон', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  await page.goto('/incidents');
  await expect(main.getByTestId('incident-row').locator('time').first()).toHaveAttribute(
    'datetime',
    /\d{4}-\d{2}-\d{2}T/,
  );
  await expect(main.getByTestId('incidents-closed-empty')).toContainText(
    'За сутки ничего не закрывалось',
  );
  // закрыли единственную — открытых нет, и сказано, откуда возьмётся новая
  await main.getByTestId('incident-resolve').click();
  const empty = main.getByTestId('incidents-empty');
  await expect(empty).toContainText('Открытых неисправностей нет');
  await expect(empty).toContainText('Сторож проверяет систему раз в минуту');
  await expect(main.getByTestId('incidents-closed')).toContainText(
    'Тестовая бронь без назначенной ячейки',
  );
  // сбой состояния сторожа: плитки не выдуманы, списки на месте, повтор возвращает состояние
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/control`, { data: { failPath: '/guard/status' } });
  await page.goto('/incidents');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Неисправности');
  const failure = main.getByTestId('incidents-status-error');
  await expect(failure).toContainText('Проверьте подключение и повторите запрос');
  await expect(main.getByTestId('incidents-open')).toHaveText('—');
  await expect(main.getByTestId('incident-row')).toHaveCount(1);
  await request.post(`${fixture}/__test/control`, { data: {} });
  await failure.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(main.getByTestId('incidents-status-error')).toHaveCount(0);
  await expect(main.getByTestId('incidents-open')).toHaveText('1');
  await expect(main.getByTestId('guard-running')).toContainText('работает');
  // телефон: строка карточкой, кнопки в своей строке, без прокрутки вбок
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/incidents');
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'неисправности шире экрана телефона').toBeLessThanOrEqual(
    layout.viewport + 1,
  );
  await expect(main.getByTestId('incident-row').locator('td').nth(4)).toHaveCSS(
    'grid-row-start',
    '4',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  // загрузка словом
  await request.post(`${fixture}/__test/control`, {
    data: { delayPath: '/guard/status', delayMs: 2500 },
  });
  await page.goto('/incidents', { waitUntil: 'commit' });
  await expect(main.getByTestId('incidents-loading')).toContainText('Читаем состояние сторожа');
  await expect(main.getByTestId('incidents-open')).toBeVisible({ timeout: 15_000 });
});
