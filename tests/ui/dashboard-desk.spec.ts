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
    quick(page).getByRole('button', { name: /Создать счёт/ }).locator('.quick-action__count'),
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

test('3. блок «Требуют внимания» один и стоит сразу под полосой стойки; сводки-дубля сверху нет', async ({
  page,
}) => {
  // A1 (ADR-103): малую сводку сверху сняли — блок один, с разбивкой по причинам
  await page.goto('/today');
  await expect(page.getByTestId('attention-summary')).toHaveCount(0);
  const blocks = page.locator('#day-attention');
  await expect(blocks).toHaveCount(1);
  await expect(blocks.getByRole('heading', { name: 'Требуют внимания' })).toBeVisible();
  // порядок: полоса «На стойке» выше блока задач
  const stripY = (await page
    .getByRole('region', { name: 'Сегодня на стойке' })
    .boundingBox())!.y;
  const attentionY = (await blocks.boundingBox())!.y;
  expect(stripY).toBeLessThan(attentionY);
  // день без дел — блок говорит «Всё в порядке», дубля тоже нет
  await page.goto('/today?date=2027-06-01');
  await expect(page.getByTestId('attention-summary')).toHaveCount(0);
  await expect(page.locator('#day-attention')).toContainText('Всё в порядке');
});

test('4. названия действий и имена гостей 14 px, подписи 13 px; название действия в одну строку', async ({
  page,
}) => {
  await page.goto('/today');
  expect(await fontSize(quick(page).locator('.quick-action__label').first())).toBe('14px');
  expect(await fontSize(page.locator('#day-attention .attention-item strong').first())).toBe(
    '14px',
  );
  expect(await fontSize(page.locator('#day-attention .attention-item small').first())).toBe(
    '13px',
  );
  expect(await fontSize(quick(page).getByRole('link', { name: 'Все брони' }))).toBe('13px');
  await page.goto('/today?date=2027-06-01');
  expect(await fontSize(quick(page).locator('.quick-action__hint').first())).toBe('13px');
  // крупнее кегль — не повод рвать название: и с числом, и с подписью оно в одну строку
  for (const [path, width] of [
    ['/today', 1440],
    ['/today', 1024],
    ['/today?date=2027-06-01', 1440],
    ['/today?date=2027-06-01', 1024],
    ['/today', 390],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    const lines = await quick(page)
      .locator('.quick-action__label')
      .evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
          return { text: el.textContent, lines: Math.round(el.getBoundingClientRect().height / lh) };
        }),
      );
    expect(
      lines.filter((l) => l.lines > 1),
      `${path} на ${width}`,
    ).toEqual([]);
  }
});

test('5. полоса «На стойке»: числа без цвета статуса, выехавший с долгом не прячется за «все счета оплачены»', async ({
  page,
}) => {
  await page.goto('/today');
  const strip = page.getByRole('region', { name: 'Сегодня на стойке' });
  const color = (id: string) =>
    strip.getByTestId(id).evaluate((el) => getComputedStyle(el).color);
  const neutral = await color('c-inhouse');
  // §9: зелёный — «заселён», жёлтый — «внимание», синий — «подтверждена»; счётчик дня ни то, ни другое.
  // С A1 число — ссылка в раздел, но цвет по-прежнему наследуется, а не «синий ссылки»
  for (const id of ['c-arrivals', 'c-departures', 'c-free', 'c-occupancy'])
    expect(await color(id)).toBe(neutral);
  // шесть плиток дня: Проживают · Заезды · Выезды · Свободно · Загрузка · К оплате (A1, ADR-103)
  await expect(strip.locator('.desk-stat')).toHaveCount(6);
  await expect(strip.getByTestId('c-occupancy')).toContainText('%');
  // у живущих долга нет (значение — из API как есть), но TEST4 выехал сегодня с долгом 16 000 ₸
  await expect(strip.getByTestId('c-debt')).toHaveText('0 ₸');
  await expect(strip).not.toContainText('все счета оплачены');
  await expect(strip.getByRole('link', { name: 'выехавших с долгом: 1' })).toHaveAttribute(
    'href',
    '#day-attention',
  );
  // «сейчас» — отметка текущего дня, а не статус «норма»: не зелёная
  const now = strip.getByText('сейчас', { exact: true });
  const success = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--success').trim(),
  );
  const probe = await page.evaluate((c) => {
    const el = document.createElement('i');
    el.style.color = c;
    document.body.append(el);
    const rgb = getComputedStyle(el).color;
    el.remove();
    return rgb;
  }, success);
  expect(await now.evaluate((el) => getComputedStyle(el).color)).not.toBe(probe);
});

test('6. список «Требуют внимания» без своей прокрутки: задачи не прячутся под край блока', async ({
  page,
}) => {
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/today');
    const list = page.locator('#day-attention .attention-list');
    await expect(list).toBeVisible();
    const style = await list.evaluate((el) => {
      const s = getComputedStyle(el);
      return { maxHeight: s.maxHeight, overflowY: s.overflowY };
    });
    expect(style, `ширина ${width}`).toEqual({ maxHeight: 'none', overflowY: 'visible' });
  }
});

test('7. строки главной без разделителя « · »', async ({ page }) => {
  await page.goto('/today');
  const main = page.getByRole('main');
  const texts = [
    await main.getByRole('region', { name: 'Сегодня на стойке' }).locator('h2').innerText(),
    ...(await main.locator('#day-attention .attention-item').allInnerTexts()),
  ];
  for (const text of texts) expect(text, text).not.toContain(' · ');
  // подпись отрезка «Аналитики» — через запятую: «1 сент. — 30 сент., 30 дней» (ADR-114)
  await page.goto('/management/analytics?period=month');
  const caption = await main.getByTestId('pa-period').innerText();
  expect(caption, caption).not.toContain(' · ');
  await page.goto('/today');
  await quick(page)
    .getByRole('button', { name: /Выселить гостя/ })
    .click();
  for (const text of await page
    .getByRole('dialog', { name: 'Выселить гостя' })
    .locator('.assistant-results > a')
    .allInnerTexts())
    expect(text).not.toContain(' · ');
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

test('9. размеры шрифта на главной и в «Аналитике» — из шкалы §6, число плитки 24 px', async ({
  page,
}) => {
  const scale = ['12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px'];
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
    await expect(main.getByRole('region', { name: 'Сегодня на стойке' })).toBeVisible();
    await expect(main.getByRole('region', { name: 'Быстрые действия' })).toBeVisible();
    expect(await offScale(main), `главная, ширина ${width}`).toEqual([]);
    // число плитки дня — 24 px (--text-3xl), как и до A1
    if (width === 1440) expect(await fontSize(main.getByTestId('c-inhouse'))).toBe('24px');
    // «Показатели за период» с AN2 — «Аналитика» (ADR-114): шесть плиток в ряд, число 24 px (--text-3xl)
    await page.goto('/management/analytics?period=week');
    await expect(main.getByTestId('pa-chart-occupancy')).toBeVisible();
    expect(await offScale(main), `аналитика, обзор, ширина ${width}`).toEqual([]);
    if (width === 1440) expect(await fontSize(main.getByTestId('pa-kpi-occupancy'))).toBe('24px');
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
    [1440, '28px'],
    [650, '28px'],
    [390, '24px'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/today');
    expect(await title(), `ширина ${width}`).toBe(size);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await quick(page)
    .getByRole('button', { name: /Выселить гостя/ })
    .click();
  await page
    .getByRole('dialog', { name: 'Выселить гостя' })
    .getByRole('link', { name: /20260913-TEST3/ })
    .click();
  const drawer = page.locator('.booking-drawer .page__title');
  await expect(drawer).toBeVisible();
  expect(await fontSize(drawer)).toBe('20px');
});
