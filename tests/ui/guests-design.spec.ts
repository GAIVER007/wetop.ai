import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * «Гости» (21.09.2026, поручение владельца «проверь, чтобы всё чётко отображалось»).
 *
 * Найдено на стенде: над пустым состоянием рисовалась шапка таблицы из шести колонок; подпись выборки
 * говорила «Гости с проживанием на сегодня: 1 гость» даже при выбранном «Выехали» — условие не названо,
 * а «на сегодня» для выехавшего неверно; статус брался из словаря броней во множественном числе
 * («Завершены», «Проживают») и описывал одного гостя; разделы по статусу рисовались обычными ссылками,
 * а не чипами, как в «Бронях» и «Журнале»; имя гостя — ссылка цветом обычного текста и без подчёркивания.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/control`, { data: {} });
});

test('гости: выборка названа одним предложением со статусом, статус гостя — в единственном числе', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/guests');
  const meta = main.getByTestId('guests-today-count');
  await expect(meta).not.toContainText(':');
  await expect(meta).toContainText('9 гостей');

  // статус описывает одного гостя, а не пачку броней
  await expect(main.getByTestId('guests-today-table')).toContainText('живёт');
  await expect(main.getByText('Проживают', { exact: true })).toHaveCount(1); // только чип раздела
  await expect(main.getByText('Завершены', { exact: true })).toHaveCount(0);

  // выбранный раздел назван в выборке
  await page.goto('/guests?status=CHECKED_OUT');
  await expect(main.getByTestId('guests-today-count')).toContainText('выехали');
  await expect(main.getByTestId('guests-today-table')).toContainText('выехал');
});

test('гости: пустой список не рисует шапку таблицы, разделы — чипы, имя гостя видно как ссылка', async ({
  page,
  request,
}) => {
  const main = page.getByRole('main');
  // разделы — те же чипы, что на «Неисправностях» и в «Журнале»
  await page.goto('/guests');
  const filters = main.getByRole('navigation', { name: 'Гости по статусу' });
  await expect(filters).toHaveClass(/chips/);
  const chipHeight = await filters
    .getByRole('link', { name: 'Проживают', exact: true })
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(chipHeight).toBeGreaterThanOrEqual(38);

  // имя гостя отличается от обычного текста: ссылка подчёркивается под курсором и в фокусе
  const guest = main.getByTestId('guests-today-table').getByRole('link').first();
  await guest.hover();
  await expect(guest).toHaveCSS('text-decoration-line', 'underline');

  // имя читается от левого края ячейки: старый класс `.directory-guest` центрировал его (21.09)
  const offset = await guest.evaluate(
    (el) => el.getBoundingClientRect().left - el.closest('td')!.getBoundingClientRect().left,
  );
  expect(offset, 'имя гостя не прижато к левому краю ячейки').toBeLessThanOrEqual(16);

  // поле поиска вмещает свою подсказку целиком
  const input = main.getByLabel('Поиск гостей');
  expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(280);

  // пусто: шапки из шести колонок над пустым состоянием нет
  await request.post(`${fixture}/__test/control`, { data: { noBookings: true } });
  await page.goto('/guests');
  await expect(main.getByTestId('guests-today-empty')).toBeVisible();
  await expect(main.getByTestId('guests-today-table')).toHaveCount(0);
  await expect(main.getByRole('columnheader')).toHaveCount(0);

  const audit = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
});
