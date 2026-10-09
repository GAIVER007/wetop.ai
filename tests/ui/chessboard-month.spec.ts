import { FIXTURE_API, expect, test, devNoise } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('месяц: с первого по последнее число, включая прошлые дни', async ({ page }) => {
  const today = new Date(Date.now() + 5 * 3600_000);
  const first = `${today.toISOString().slice(0, 7)}-01`;
  today.setUTCMonth(today.getUTCMonth() + 1, 0);
  const last = today.toISOString().slice(0, 10);
  await page.goto('/chessboard');
  // Готовые периоды и «Месяц» живут внутри «Даты» (ТЗ «Шахматка v2» §7; с 09.10 там же 7/14/30).
  // Ссылки стоят в перерисовываемой форме, поэтому после перехода на 14 дней дожидаемся его конца,
  // иначе клик попадает в старый узел.
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByRole('link', { name: '14 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(14);
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByRole('link', { name: 'Месяц', exact: true }).click();
  await expect(page.getByLabel('Календарь: с', { exact: true })).toHaveValue(first);
  await expect(page.getByLabel('Календарь: по', { exact: true })).toHaveValue(last);
  await expect(page.getByTestId('date-col')).toHaveCount(Number(last.slice(8)));
  await expect(page.getByTestId('date-col').first().locator('.board__d')).toHaveText('01');
  await expect(page.getByTestId('date-col').last().locator('.board__d')).toHaveText(last.slice(8));
});

test('все 31 день помещаются по ширине окна', async ({ page }) => {
  await page.goto('/chessboard?from=2026-10-01&to=2026-10-31');
  await expect(page.getByTestId('date-col')).toHaveCount(31);
  for (const width of [768, 812, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.locator('.board-wrap').evaluate((el) => {
      const box = el as unknown as { scrollWidth: number; clientWidth: number };
      return box.scrollWidth - box.clientWidth;
    });
    expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('date-col').first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
  }
  // навигация в шапке (ADR-134): на 1024 px сетке отдана вся ширина окна
  await page.setViewportSize({ width: 1024, height: 1000 });
  await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
});

for (const [from, to, direction, expectedFrom, expectedTo] of [
  ['2026-10-01', '2026-10-31', 'Предыдущий месяц', '2026-09-01', '2026-09-30'],
  ['2026-12-01', '2026-12-31', 'Следующий месяц', '2027-01-01', '2027-01-31'],
  ['2027-03-01', '2027-03-31', 'Предыдущий месяц', '2027-02-01', '2027-02-28'],
  ['2028-01-01', '2028-01-31', 'Следующий месяц', '2028-02-01', '2028-02-29'],
] as const) {
  test(`переключение целого месяца: ${from} → ${expectedFrom}`, async ({ page }) => {
    await page.goto(`/chessboard?from=${from}&to=${to}`);
    // A previously edited date must not survive navigation into a different month.
    await page.getByRole('button', { name: 'Даты', exact: true }).click();
    await page.getByLabel('Календарь: с', { exact: true }).fill('2026-01-15');
    await page.getByRole('link', { name: direction, exact: true }).click();
    await expect(page.getByLabel('Календарь: с', { exact: true })).toHaveValue(expectedFrom);
    await expect(page.getByLabel('Календарь: по', { exact: true })).toHaveValue(expectedTo);
    await expect(page.getByTestId('date-col')).toHaveCount(Number(expectedTo.slice(8)));
    // Ссылка «Месяц» видна только в раскрытых «Датах»; после перехода они закрыты
    await page.getByRole('button', { name: 'Даты', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Месяц', exact: true })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.reload();
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', expectedFrom);
  });
}

test('7 дней, 14 дней, произвольный период и возврат к месяцу', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByRole('link', { name: '14 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(14);
  await expect(page.getByRole('link', { name: 'Следующий период', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByLabel('Календарь: с', { exact: true }).fill('2028-02-10');
  await page.getByLabel('Календарь: по', { exact: true }).fill('2028-02-20');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(11);
  // После «Применить» страница перерисована: под нагрузкой полного набора клик мог прийти до оживления кнопки,
  // и панель «Даты» не открывалась (29.09, 599/600) — открываем, пока «Месяц» не станет виден
  const month = page.getByRole('link', { name: 'Месяц', exact: true });
  await expect(async () => {
    if (!(await month.isVisible())) await page.getByRole('button', { name: 'Даты', exact: true }).click();
    await expect(month).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  await month.click();
  await expect(page.getByTestId('date-col')).toHaveCount(29);
  await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', '2028-02-01');
  await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  await expect(page.getByTestId('date-col').first().locator('.board__wd')).toHaveText('пн');
  await expect(page.locator('th.is-today')).toHaveCount(1);
});

test('30 дней: окно от сегодня, готовые периоды живут в «Датах», а не в строке управления', async ({
  page,
}) => {
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  await page.goto('/chessboard');
  // сегмента 7/14/30 в строке управления больше нет: шапку разгрузил владелец 09.10.2026
  await expect(page.locator('.board-controls .seg')).toHaveCount(0);
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await expect(page.locator('.board-quick-periods a')).toHaveText([
    '7 дней',
    '14 дней',
    '30 дней',
    'Месяц',
  ]);
  await page.getByRole('link', { name: '30 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', today);
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await expect(page.getByRole('link', { name: '30 дней', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  // стрелка шагает ровно на 30 дней
  await page.getByRole('link', { name: 'Следующий период', exact: true }).click();
  const next = new Date(`${today}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 30);
  await expect(page.getByTestId('date-col').first()).toHaveAttribute(
    'data-date',
    next.toISOString().slice(0, 10),
  );
  await expect(page.getByTestId('date-col')).toHaveCount(30);
  await page.getByRole('link', { name: 'Сегодня', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(7);
});

test('в месяце открываются брони, свободные даты и группы номеров', async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 1000 });
  await page.goto('/chessboard');
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByRole('link', { name: '14 дней', exact: true }).click();
  await expect(page.getByTestId('date-col')).toHaveCount(14);
  await page.getByRole('button', { name: 'Даты', exact: true }).click();
  await page.getByRole('link', { name: 'Месяц', exact: true }).click();
  const stay = page.getByTestId('stay-cell').first();
  const number = await stay.getAttribute('data-number');
  // одинарный клик — предпросмотр, полная карточка — двойным (ТЗ «Шахматка v2» §24)
  await stay.dblclick();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText(number!);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  const group = page.getByTestId('category-row').first().getByRole('button');
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.locator('[data-unit-code="R03"] [data-testid="unit-link"]').click();
  await expect(page).toHaveURL(/\/units\/R03$/);
  await page.goBack();
  await expect(page.getByTestId('chessboard')).toBeVisible();
  const lastFree = page.locator('[data-unit-code="R03"] [data-testid="free-cell"]').last();
  const href = await lastFree.getAttribute('href');
  const expected = new URL(href!, 'http://127.0.0.1:3100');
  await lastFree.click();
  // PR 5 (ТЗ v2 §32): щелчок открывает окошко свободной клетки, форма — по «Новая бронь»
  await page
    .getByTestId('free-menu')
    .getByRole('link', { name: 'Новая бронь', exact: true })
    .click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue(
    expected.searchParams.get('arrival')!,
  );
  await expect(form.locator('[name="departureDate"]')).toHaveValue(
    expected.searchParams.get('departure')!,
  );
  await expect(form.locator('[name="unitCode"]')).toHaveValue('R03');
});

for (const theme of ['light', 'dark'] as const) {
  test(`месячная сетка: ${theme}, читаемость и адаптивность`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/chessboard-month', { recursive: true });
    await page.emulateMedia({ colorScheme: theme });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/chessboard');
    await page.getByRole('button', { name: 'Даты', exact: true }).click();
    await page.getByRole('link', { name: '14 дней', exact: true }).click();
    await expect(page.getByTestId('date-col')).toHaveCount(14);
    await page.getByRole('button', { name: 'Даты', exact: true }).click();
    await page.getByRole('link', { name: 'Месяц', exact: true }).click();
    const report = [];
    // Next обновляет метаданные потоком: axe запускается после завершения перехода в месяц.
    await expect(page.getByRole('main').getByTestId('chessboard')).toHaveClass(/board--month/);
    await expect(page).toHaveTitle('WETOP: рабочее пространство');
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const layout = await page.evaluate(() => {
        const browser = globalThis as unknown as {
          innerWidth: number;
          document: { documentElement: { scrollWidth: number } };
        };
        return {
          viewport: browser.innerWidth,
          content: browser.document.documentElement.scrollWidth,
        };
      });
      expect(layout.content).toBeLessThanOrEqual(width + 1);
      // target-size (2.5.8) в месячном зуме не выполним геометрически: 31 ночь по 24px и колонка мест
      // шире узких окон, а «все дни без прокрутки» — требование этого же теста. Месяц — плотная карта
      // занятости (исключение «essential»); те же брони доступны целями ≥24px в неделе, поиске и списке.
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .disableRules(['target-size'])
        .analyze();
      report.push({ width, layout, violations: result.violations });
      await page.screenshot({ path: `reports/chessboard-month/${theme}-${width}.png` });
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
    expect(errors).toEqual([]);
    writeFileSync(`reports/chessboard-month/${theme}.json`, JSON.stringify(report, null, 2));
  });
}
