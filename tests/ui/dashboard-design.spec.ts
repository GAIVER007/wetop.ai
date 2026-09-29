import { expect, test } from '@playwright/test';

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
const fixture = 'http://127.0.0.1:4311';
const OVERVIEW = '/management/analytics';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

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

  // один день: загрузку по категориям показывают полосы, таблица её не повторяет
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
test('главная: быстрые действия называют число дел, без дел ведут к началу действия, внимание разбито по причинам', async ({
  page,
}) => {
  await page.goto('/today');
  const quick = page.getByRole('region', { name: 'Быстрые действия' });

  // числа из того же `DeskDay` и равны строкам окна выбора (разбор 23.09.2026, находка 1): заселить —
  // три заезда без заселения и один «не заехал вовремя», выселить — один, переселить — три живущих
  // и один уезжающий сегодня; подробно — `dashboard-desk.spec.ts`
  await expect(quick.getByRole('button', { name: /Заселить гостя/ })).toContainText('4');
  await expect(quick.getByRole('button', { name: /Выселить гостя/ })).toContainText('1');
  await expect(quick.getByRole('button', { name: /Переселить/ })).toContainText('4');
  // вместо значка «+» — ссылка, которая куда-то ведёт
  await expect(quick.getByRole('link', { name: 'Все брони' })).toHaveAttribute(
    'href',
    '/reservations',
  );

  // разбивка сверху видна и при нуле (23.09); с A3 — по важности: Критично, Важно, К сведению, и сумма равна счётчику
  const tally = page.getByTestId('attention-tally');
  await expect(tally.getByRole('listitem')).toHaveText([/Критично/, /Важно/, /К сведению/]);
  const numbers = (await tally.locator('strong').allInnerTexts()).map(Number);
  await expect(page.locator('#day-attention .attention-count')).toHaveText(
    String(numbers.reduce((a, b) => a + b, 0)),
  );

  // день без броней: ни одной мёртвой кнопки — каждая ведёт туда, где действие начинается
  await page.goto('/today?date=2027-06-01');
  const empty = page.getByRole('region', { name: 'Быстрые действия' });
  await expect(empty.locator('button:disabled')).toHaveCount(0);
  const checkIn = empty.getByRole('link', { name: /Заселить гостя/ });
  await expect(checkIn).toHaveAttribute('href', '/reservations/new');
  await expect(checkIn).toContainText('нет заездов — новая бронь');
  for (const label of ['Выселить гостя', 'Продлить проживание', 'Переселить', 'Создать счёт']) {
    await expect(empty.getByRole('link', { name: new RegExp(label) })).toHaveAttribute(
      'href',
      '/reservations',
    );
  }
  await expect(empty.getByRole('link', { name: /Продлить проживание/ })).toContainText(
    'никто не проживает — найти бронь',
  );
  // название действия — в одну строку: подпись не сжимает его до «Продлит / ь». Снимок владельца —
  // окно ноутбука, где на кнопку приходится ~260 px; на 1440 дефект не виден
  await page.setViewportSize({ width: 1024, height: 900 });
  const lines = await empty.locator('.quick-action__label').evaluateAll((els) =>
    els.map((el) => {
      const cs = getComputedStyle(el);
      // `line-height: normal` не число — берём обычные для него 1,2 кегля
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
      return { text: el.textContent, lines: Math.round(el.getBoundingClientRect().height / lh) };
    }),
  );
  expect(lines.filter((l) => l.lines > 1)).toEqual([]);
  await expect(empty.getByTestId('attention-tally')).toHaveCount(0);
});
