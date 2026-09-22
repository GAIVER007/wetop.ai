import { expect, test } from '@playwright/test';

/**
 * «Главная» без повторов (21.09.2026, продолжение правки «чтобы каши не было»; ADR-049 не трогается:
 * состав показателей, роль дашборда и порядок блоков те же).
 *
 * Было: «нет базы для сравнения» стояло под каждой из шести плиток — шесть одинаковых строк; при периоде
 * в один день загрузка по категориям рисовалась дважды — полосами в «Загрузке по категориям» и той же
 * колонкой «Загрузка» в таблице «По категориям»; подписи плиток склеивались через « · » (§14); на
 * телефоне таблица «По категориям» из пяти колонок обрезалась прокруткой без признака — видны были
 * только категория и загрузка.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('главная: «нет базы для сравнения» один раз, загрузка по категориям не дважды, подписи без точек', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/today');
  await expect(main.getByTestId('chart-categories')).toBeVisible();

  // одна видимая фраза о базе сравнения на все плитки; под плитками — «—», а слово остаётся
  // только программе чтения (1 px, за краем)
  const all = main.getByText('нет базы для сравнения');
  const hidden = main.locator('.kpi-delta .sr-only');
  await expect(main.getByTestId('kpi-compare')).toContainText('нет базы для сравнения');
  expect((await all.count()) - (await hidden.count())).toBe(1);
  for (const width of await hidden.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().width),
  ))
    expect(width).toBeLessThanOrEqual(1);
  await expect(main.locator('.kpi-delta--none').first()).toContainText('—');

  // один день: загрузку по категориям показывают полосы, таблица её не повторяет
  const table = main.getByTestId('categories-table');
  await expect(table.getByRole('columnheader', { name: 'Загрузка' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Ночей продано' })).toBeVisible();

  // подписи плиток и полос — словами через запятую, не « · »
  for (const hint of await main.locator('.kpi__hint').allTextContents())
    expect(hint, `подпись плитки «${hint}» склеена точкой`).not.toContain(' · ');
  await expect(main.getByTestId('chart-categories')).not.toContainText(' · ');

  // период больше дня: полос по категориям нет, и колонка «Загрузка» в таблице нужна
  await page.goto('/today?period=week');
  await expect(main.getByTestId('chart-daily')).toBeVisible();
  await expect(
    main.getByTestId('categories-table').getByRole('columnheader', { name: 'Загрузка' }),
  ).toBeVisible();
});

test('главная: на телефоне таблица категорий складывается, а не обрезается прокруткой', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today?period=week');
  const table = main.getByTestId('categories-table');
  await expect(table).toBeVisible();
  const clipped = await table.evaluate((el) => {
    const scroller = el.closest('.table-scroll') ?? el.parentElement!;
    return scroller.scrollWidth - scroller.clientWidth;
  });
  expect(clipped, 'таблица категорий уезжает в прокрутку вбок').toBeLessThanOrEqual(1);
  // в сложенной строке слово стоит рядом с числом: «ночей 12», «выручка 72 000 ₸»
  await expect(table.locator('tbody tr').first()).toContainText(/ночей/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
