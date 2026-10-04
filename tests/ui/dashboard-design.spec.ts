import { expect, test } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

/**
 * «Показатели за период» без повторов (правила 21.09.2026). С A1 (ADR-103) блок жил на
 * `/management/dashboard`, с AN2 (ADR-114) это «Аналитика → Обзор»: состав показателей и определения
 * ADR-047 не менялись, переехало место; правила ниже держит «Обзор».
 *
 * Было: «нет базы для сравнения» стояло под каждой из шести плиток — шесть одинаковых строк; при периоде
 * в один день загрузка по категориям рисовалась дважды — полосами в «Загрузке по категориям» и той же
 * колонкой «Загрузка» в таблице «По категориям»; подписи плиток склеивались через « · » (§14); на
 * телефоне таблица «По категориям» из пяти колонок обрезалась прокруткой без признака.
 */
const fixture = FIXTURE_API;
const OVERVIEW = '/management/analytics';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

/** «Подробности: ночи, средний чек, категории и источники» свёрнуты: открываем перед таблицей */
async function details(main: import('@playwright/test').Locator) {
  const summary = main.locator('.pa-details > summary');
  await summary.click();
  await expect(main.locator('.pa-details')).toHaveAttribute('open', '');
}

test('показатели: «нет данных для сравнения» один раз, загрузка по категориям не дважды, подписи без точек', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto(`${OVERVIEW}?period=today`);
  await expect(main.getByTestId('pa-chart-categories')).toBeVisible();

  // одна видимая фраза о базе сравнения на все плитки; под плитками — «—», а слово остаётся
  // только программе чтения (1 px, за краем)
  const hidden = main.locator('.kpi-delta .sr-only');
  await expect(main.getByTestId('pa-compare')).toContainText('в прошлом периоде данных нет');
  expect(await main.getByText('нет данных для сравнения').count()).toBe(await hidden.count());
  for (const width of await hidden.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().width),
  ))
    expect(width).toBeLessThanOrEqual(1);
  await expect(main.locator('.kpi-delta--none').first()).toContainText('—');

  // один день: загрузку по категориям показывают полосы, таблица её не повторяет. Таблица категорий
  // с 01.10.2026 стоит в свёрнутых «Подробностях» под графиками (компактная «Аналитика»)
  await details(main);
  const table = main.getByTestId('pa-categories');
  await expect(table.getByRole('columnheader', { name: 'Загрузка' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Продано ночей' })).toBeVisible();

  // подписи плиток и полос — словами через запятую, не « · »
  for (const hint of await main.locator('.kpi__hint').allTextContents())
    expect(hint, `подпись плитки «${hint}» склеена точкой`).not.toContain(' · ');
  await expect(main.getByTestId('pa-chart-categories')).not.toContainText(' · ');

  // период больше дня: полос по категориям нет, и колонка «Загрузка» в таблице нужна
  await page.goto(`${OVERVIEW}?period=week`);
  await expect(main.getByTestId('pa-chart-occupancy')).toBeVisible();
  await expect(main.getByTestId('pa-chart-categories')).toHaveCount(0);
  await details(main);
  await expect(
    main.getByTestId('pa-categories').getByRole('columnheader', { name: 'Загрузка' }),
  ).toBeVisible();
});

test('показатели: на телефоне таблица категорий складывается, а не обрезается прокруткой', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${OVERVIEW}?period=week`);
  await details(main);
  const table = main.getByTestId('pa-categories');
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

/**
 * «Быстрые действия» и «Требуют внимания» — Главная (23.09.2026, поручение владельца
 * «сделай круче, улучши функционал»; с A1 блоки стоят сразу под полосой «На стойке»).
 *
 * Было: пять одинаковых кнопок без чисел — сколько заездов осталось, видно только в плитках выше;
 * «Заселить гостя» открывал окно выбора даже когда заселять некого, и там был пустой список; в углу
 * блока стоял значок «+», который ничего не делал. У «Требуют внимания» при нуле оставалась одна
 * фраза «Всё в порядке», и не было видно, что именно проверено.
 *
 * Стало: на каждой кнопке — число дел из того же `DeskDay`, что и плитки; вместо значка «+» — ссылка
 * «Все брони»; у «Требуют внимания» разбивка по трём причинам с числами, и она видна и при нуле.
 *
 * Поправка того же вечера по снимку владельца с живой стойки: в рабочей базе на сегодня нет ни одной
 * брони, и «ноль гасит кнопку» оставил пять мёртвых кнопок — а в пустой день кнопка нужнее всего:
 * гость пришёл с улицы или бронь пришла в экстранет канала, и её надо завести. Теперь без дел кнопка
 * не гаснет, а ведёт туда, где действие начинается, и говорит куда. И второе: подпись стояла в строку
 * с названием и сжимала его — «Продлит / ь прожива / ние»; теперь она под названием.
 */
test('главная: «Требуют внимания» разбито по важности, сумма равна счётчику; быстрых действий нет', async ({
  page,
}) => {
  await page.goto('/today');
  // с 03.10 Главная — экран владельца: брони и действия смены живут в «Календаре» и «Бронях»
  await expect(page.getByRole('region', { name: 'Быстрые действия' })).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('link', { name: /Новая бронь/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const tally = page.getByTestId('attention-tally');
  await expect(tally.getByRole('listitem')).toHaveText([/Критично/, /Важно/, /К сведению/]);
  const numbers = (await tally.locator('strong').allInnerTexts()).map(Number);
  await expect(page.locator('#day-attention .attention-count')).toHaveText(
    String(numbers.reduce((a, b) => a + b, 0)),
  );
});
