import { expect, test, type Locator, type Page } from './fixtures';

/**
 * Разбор «Главной» 23.09.2026 — критика по DESIGN.md, находки 1–9 (отчёт и снимки —
 * `reports/desk-critique-2026-09-23/`). Каждый тест держит одну находку и был красным на коде до правки.
 *
 * Данные фикстуры на сегодня: заезды без заселения — TESTAA, TEST1, TEST2; не заехал вовремя — TEST8;
 * уезжает и ещё живёт — TEST3; уже выселен, но с долгом 16 000 ₸ — TEST4; живут — TEST5, TEST6, TEST7.
 */
const fixture = 'http://127.0.0.1:4311';

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

const quick = (page: Page) => page.getByRole('region', { name: 'Быстрые действия' });
const fontSize = (loc: Locator) => loc.evaluate((el) => getComputedStyle(el).fontSize);

test('1. число на быстром действии равно строкам в окне выбора, в окне только те, с кем это действие можно сделать', async ({
  page,
}) => {
  await page.goto('/today');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  const living = ['20260913-TEST3', '20260913-TEST5', '20260913-TEST6', '20260913-TEST7'];
  const cases = [
    {
      // заезды сегодня без заселения и «не заехал вовремя»; живущий сюда не попадает
      label: 'Заселить гостя',
      has: ['20260913-TESTAA', '20260913-TEST1', '20260913-TEST2', '20260913-TEST8'],
      not: ['20260913-TEST5'],
    },
    // уезжает сегодня и ещё живёт; уже выселенный — нет
    { label: 'Выселить гостя', has: ['20260913-TEST3'], not: ['20260913-TEST4'] },
    // живут сейчас, включая уезжающих сегодня: продлевают чаще всего именно их
    { label: 'Продлить проживание', has: living, not: ['20260913-TESTAA', '20260913-TEST4'] },
    { label: 'Переселить', has: living, not: ['20260913-TESTAA', '20260913-TEST4'] },
  ];
  for (const c of cases) {
    const button = quick(page).getByRole('button', { name: new RegExp(c.label) });
    await expect(button.locator('.quick-action__count')).toHaveText(String(c.has.length));
    await button.click();
    const dialog = page.getByRole('dialog', { name: c.label });
    await expect(dialog.locator('.assistant-results > a')).toHaveCount(c.has.length);
    for (const n of c.has) await expect(dialog).toContainText(n);
    for (const n of c.not) await expect(dialog).not.toContainText(n);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  // «Создать счёт» — любая бронь дня, а не дело: число на нём ничего не значило бы
  await expect(
    quick(page)
      .getByRole('button', { name: /Создать счёт/ })
      .locator('.quick-action__count'),
  ).toHaveCount(0);
});

test('2. из окна выбора карточка открывается на кнопке этого действия для этого проживания', async ({
  page,
}) => {
  const cases = [
    { label: 'Выселить гостя', booking: '20260913-TEST3', target: 'check-out-ui-item-3' },
    { label: 'Заселить гостя', booking: '20260913-TEST8', target: 'check-in-ui-item-8' },
    { label: 'Продлить проживание', booking: '20260913-TEST5', target: 'extend-ui-item-5' },
    { label: 'Переселить', booking: '20260913-TEST6', target: 'assign-unit-ui-item-6' },
  ];
  for (const c of cases) {
    await page.goto('/today');
    await page
      .getByTestId('owner-dashboard')
      .getByRole('button', { name: 'Работа с гостями', exact: true })
      .click();
    await quick(page)
      .getByRole('button', { name: new RegExp(c.label) })
      .click();
    await page
      .getByRole('dialog', { name: c.label })
      .getByRole('link', { name: new RegExp(c.booking) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/reservations/${c.booking}\\?do=`));
    const target = page.getByTestId(c.target);
    // фокус и видимая рамка, но не нажатие: действие по-прежнему подтверждает человек
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('data-quick-target', '');
    await expect(target).toBeInViewport();
  }
});

test('3. одна очередь внимания в панели; выбор финансового периода не меняет сегодняшний срез', async ({
  page,
}) => {
  await page.goto('/today?date=2027-06-01');
  await expect(page.getByRole('region', { name: 'Гостиница сегодня' })).toBeVisible();
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.locator('#day-attention')).toHaveCount(1);
  await expect(page.locator('#day-attention .attention-list')).toBeVisible();
  await expect(page.locator('#day-attention')).not.toContainText('Всё в порядке');
});
test('4. действия сохраняют читаемые размеры внутри панели', async ({ page }) => {
  await page.goto('/today');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  expect(await fontSize(quick(page).locator('.quick-action__label').first())).toBe('15px');
  expect(await fontSize(quick(page).getByRole('link', { name: 'Все брони' }))).toBe('14px');
});
test('5. долг у выезжающих отдельно от финансов периода, задолженность уже выехавшего остаётся в очереди', async ({
  page,
}) => {
  await page.goto('/today');
  await expect(page.getByTestId('c-debt')).toHaveText('0 ₸');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  await expect(page.locator('#day-attention')).toContainText('20260913-TEST4');
});
test('6. очередь прокручивается вместе с панелью, без вложенной прокрутки списка', async ({
  page,
}) => {
  await page.goto('/today');
  await page.getByRole('button', { name: 'Требуют внимания', exact: true }).click();
  const list = page.locator('#day-attention .attention-list');
  await expect(list).toBeVisible();
  expect(await list.evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible');
});
test('7. краткие подписи без декоративных разделителей', async ({ page }) => {
  await page.goto('/today');
  expect(await page.getByTestId('owner-dashboard').innerText()).not.toContain(' · ');
});
test('8. подробности дня на графике без наведения: день выбирается кнопками и касанием, таблица без title', async ({
  page,
}) => {
  // с AN2 график по дням — «Аналитика → Обзор» (ADR-114): у загрузки и у выручки свои подписи дня
  await page.goto('/management/analytics?period=week');
  const main = page.getByRole('main');
  const chart = main.getByTestId('pa-chart-occupancy');
  await expect(chart).toBeVisible();
  await expect(chart.locator('[title]')).toHaveCount(0);
  const day = main.getByTestId('pa-chart-occupancy-day');
  // по умолчанию — сегодняшний день, подробности видны без наведения
  await expect(day).toContainText('занято');
  await expect(main.getByTestId('pa-chart-revenue-day')).toContainText('заездов');
  const todayText = await day.innerText();
  const panel = main.locator('.dash-panel').filter({ has: page.getByTestId('pa-chart-occupancy') });
  const prev = panel.getByRole('button', { name: 'Предыдущий день' });
  const next = panel.getByRole('button', { name: 'Следующий день' });
  await expect(next).toBeDisabled();
  // с клавиатуры: Enter на кнопке листает дни
  await prev.focus();
  await page.keyboard.press('Enter');
  await expect(day).not.toHaveText(todayText);
  await next.click();
  await expect(day).toHaveText(todayText);
  // касание столбика выбирает его день
  await chart.locator('.bar').first().click();
  await expect(prev).toBeDisabled();
  await expect(day).not.toHaveText(todayText);
  // таблица по категориям: «из N возможных» видно в ячейке, а не в title
  const table = main.getByTestId('pa-categories');
  await expect(table.locator('[title]')).toHaveCount(0);
  await expect(table.locator('tbody tr').first()).toContainText(' из ');
});

test('9. размеры шрифта на главной и в «Аналитике» — из шкалы §6, число плитки 26 px', async ({
  page,
}) => {
  // шкала §6 с 29.09.2026 — на шаг крупнее прежней 12…28
  const scale = ['13px', '14px', '15px', '17px', '19px', '22px', '26px', '30px'];
  const offScale = (main: import('@playwright/test').Locator) =>
    main.evaluate((root, allowed) => {
      const seen = new Map<string, string>();
      for (const el of root.querySelectorAll('*')) {
        // закрытое окно и скрытая подпись в DOM есть, но на экране их нет — считаем то, что видно
        if (!el.checkVisibility()) continue;
        if (!(el as HTMLElement).innerText?.trim() && !el.matches('input')) continue;
        const size = getComputedStyle(el).fontSize;
        if (!allowed.includes(size) && !seen.has(size))
          seen.set(size, `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      }
      return [...seen].map(([size, where]) => `${size} ${where}`);
    }, scale);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/today');
    const main = page.getByRole('main');
    await expect(main.getByRole('region', { name: 'Гостиница сегодня' })).toBeVisible();

    expect(await offScale(main), `главная, ширина ${width}`).toEqual([]);
    // число плитки дня — --text-3xl (26 px с 29.09)
    if (width === 1440)
      expect(await fontSize(main.getByTestId('owner-guests').locator('strong'))).toBe('26px');
    // «Показатели за период» с AN2 — «Аналитика» (ADR-114): шесть плиток в ряд, число --text-3xl (26 px)
    await page.goto('/management/analytics?period=week');
    await expect(main.getByTestId('pa-chart-occupancy')).toBeVisible();
    expect(await offScale(main), `аналитика, обзор, ширина ${width}`).toEqual([]);
    if (width === 1440) expect(await fontSize(main.getByTestId('pa-kpi-occupancy'))).toBe('26px');
    await page.goto('/management/analytics/occupancy');
    await expect(main.getByTestId('statistics-table')).toBeVisible();
    expect(await offScale(main), `аналитика, загрузка, ширина ${width}`).toEqual([]);
  }
});

/**
 * 24.09.2026, остаток разбора: заголовок страницы задан в трёх файлах (28, 30 и на телефоне 23 и 25), побеждал
 * последний — 25 px на телефоне и 19 px в панели брони, вне шкалы §6. Теперь 28 / 24 / 20 токенами везде.
 */
test('10. заголовок страницы и панели брони — по шкале §6', async ({ page }) => {
  const title = () => fontSize(page.getByRole('main').locator('.page__title').first());
  for (const [width, size] of [
    // --text-4xl / --text-3xl (30 / 26 px с 29.09)
    [1440, '30px'],
    [650, '30px'],
    [390, '26px'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/today');
    expect(await title(), `ширина ${width}`).toBe(size);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await page
    .getByTestId('owner-dashboard')
    .getByRole('button', { name: 'Работа с гостями', exact: true })
    .click();
  await quick(page)
    .getByRole('button', { name: /Выселить гостя/ })
    .click();
  await page
    .getByRole('dialog', { name: 'Выселить гостя' })
    .getByRole('link', { name: /20260913-TEST3/ })
    .click();
  const drawer = page.locator('.booking-drawer .page__title');
  await expect(drawer).toBeVisible();
  expect(await fontSize(drawer)).toBe('22px'); // --text-2xl
});
