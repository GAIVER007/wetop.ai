import { FIXTURE_API, boardFilter, expect, openBoardFilters, test, devNoise } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

// адрес стенда общий для набора: `UI_FIXTURE_API` или `FIXTURE_PORT`, параллельные сессии не делят 4311
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('C1: сетка начинается до 384 px (350 до панели «Сегодня», поручение 02.10), фильтры объясняют дату статуса', async ({
  page,
}) => {
  await page.goto('/chessboard?from=2026-09-14&to=2026-09-20');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const box = await page.locator('.board-wrap').boundingBox();
  expect(box!.y).toBeLessThanOrEqual(384);
  // состояние мест считается на первую дату окна, подпись поля в окошке «Фильтры» это говорит
  // (PR 7 «Шахматки v2», с 09.10 поле в окошке)
  const pop = await openBoardFilters(page);
  await expect(pop.getByText('Места на 14 сент.', { exact: true })).toBeVisible();
  await pop.getByRole('button', { name: 'Закрыть фильтры' }).click();
  await page.getByLabel('Поиск в календаре').fill('Несуществующее место');
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await expect(page.getByTestId('board-empty')).toContainText('Ничего не найдено');
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
});

test('C1: мобильные даты, виды и фильтры имеют цели 44 px', async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/chessboard');
    const main = page.getByRole('main');
    await expect(main.getByTestId('unit-row')).toHaveCount(88);
    // PR 7 «Шахматки v2»: на телефоне категория и места — в окошке «Фильтры», в строке их нет
    const toggle = main.getByRole('button', { name: 'Фильтры', exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(main.locator('.board-toolbar').getByLabel('Категория в календаре')).toHaveCount(0);
    await page.getByTestId('board-period-button').click();
    // готовые периоды (7/14/30, месяц) с 09.10 живут в раскрывашке периода
    for (const control of [
      main.getByLabel('Период: с', { exact: true }),
      main.getByLabel('Период: по', { exact: true }),
      main.getByRole('button', { name: 'Применить', exact: true }),
      main.getByRole('link', { name: 'Предыдущая неделя', exact: true }),
      main.getByRole('link', { name: 'Неделя', exact: true }),
      toggle,
    ]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.board-period-pop').getByText('С', { exact: true })).toBeVisible();
    await expect(page.locator('.board-period-pop').getByText('По', { exact: true })).toBeVisible();
    // раскрывашка периода закрывается, чтобы не накрывать кнопку «Фильтры» под ней
    await page.getByTestId('board-period-button').click();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const filters = page.getByRole('dialog', { name: 'Фильтры календаря' });
    // вид строк с 09.10 тоже в окошке: кнопки с целями 44 px
    const viewButton = filters
      .getByRole('group', { name: 'Вид строк календаря' })
      .getByRole('button', { name: 'Обычный', exact: true });
    await expect(viewButton).toBeVisible();
    expect((await viewButton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await filters.getByRole('combobox', { name: 'Категория', exact: true }).selectOption('ROOM');
    await filters.getByRole('button', { name: 'Применить', exact: true }).click();
    await expect(main.getByTestId('unit-row')).toHaveCount(16);
    // заданная категория — чипом с крестиком: поля категории в строке на телефоне нет
    const chip = main.getByRole('button', { name: /^Убрать условие: / });
    await expect(chip).toBeVisible();
    expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await main.getByRole('button', { name: 'Сбросить', exact: true }).click();
    await expect(main.getByTestId('unit-row')).toHaveCount(88);
    await expect(main.getByRole('button', { name: 'Фильтры', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  }
});

test('C1: подсказка не выходит за экран, последние места доступны на телефоне', async ({
  page,
}) => {
  await page.goto('/chessboard');
  // Подсказка с 09.10 лежит внизу окошка «Фильтры» (ТЗ «Шахматка v2» §5), инструкция внутри
  const pop = await openBoardFilters(page);
  await pop.locator('details.board-filters-pop__help > summary').click();
  const help = pop.locator('.board-filters-pop__help');
  await expect(help).toContainText('Как работать с календарём');
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const popBox = await pop.boundingBox();
    expect(popBox!.x).toBeGreaterThanOrEqual(0);
    expect(popBox!.x + popBox!.width).toBeLessThanOrEqual(width);
  }
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 844 });
  // Scroll the grid to its bottom, then the page as a touch user would.
  // scrollIntoView alone would conceal overflow:hidden by scrolling it programmatically.
  await page.locator('.board-wrap').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.mouse.move(4, 500);
  await page.mouse.wheel(0, 2000);
  await expect(page.getByTestId('unit-link').last()).toBeInViewport({ ratio: 1 });
});

for (const [from, to, direction, expectedFrom, expectedTo] of [
  ['2026-09-28', '2026-10-04', 'Следующая неделя', '2026-10-05', '2026-10-11'],
  ['2026-12-28', '2027-01-03', 'Следующая неделя', '2027-01-04', '2027-01-10'],
  ['2028-03-06', '2028-03-12', 'Предыдущая неделя', '2028-02-28', '2028-03-05'],
] as const) {
  test(`переход календарной недели: ${from} → ${expectedFrom}`, async ({ page }) => {
    await page.goto(`/chessboard?from=${from}&to=${to}`);
    await page.getByTestId('board-period-button').click();
    await page.getByLabel('Период: с', { exact: true }).fill('2020-01-01');
    await page.getByRole('link', { name: direction, exact: true }).click();
    await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue(expectedFrom);
    await expect(page.getByLabel('Период: по', { exact: true })).toHaveValue(expectedTo);
    await expect(page.getByTestId('date-col')).toHaveCount(7);
    await expect(page).toHaveURL(`/chessboard?from=${expectedFrom}&to=${expectedTo}`);
    await page.reload();
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', expectedFrom);
    // SSR dates arrive before hydration. Exercise a client filter before testing popstate.
    await boardFilter(page, { category: 'ROOM' });
    await expect(page.getByTestId('unit-row')).toHaveCount(16);
    await page.goBack();
    await expect(page).toHaveURL(`/chessboard?from=${from}&to=${to}`);
    await expect(page.getByTestId('date-col').first()).toHaveAttribute('data-date', from);
  });
}

test('в неделе работают бронь, категории и создание на воскресенье', async ({ page }) => {
  await page.goto('/chessboard');
  const stay = page.getByTestId('stay-cell').first();
  const number = await stay.getAttribute('data-number');
  // одинарный клик — предпросмотр, полная карточка — двойным (ТЗ «Шахматка v2» §24)
  await stay.dblclick();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText(number!);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await boardFilter(page, { category: 'ROOM' });
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  const group = page.getByTestId('category-row').first().getByRole('button');
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await group.click();
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  const sunday = await page.getByTestId('date-col').last().getAttribute('data-date');
  // Брони фикстуры ставятся от «сегодня» (заезд сегодня, три ночи), и с четверга воскресенье у
  // R01–R03 занято — тест падал по дню недели. Берём первую комнату, у которой воскресенье свободно.
  const sundayFree = page.locator(`td[data-date="${sunday}"] [data-testid="free-cell"]`);
  const row = page.getByTestId('unit-row').filter({ has: sundayFree }).first();
  const unitCode = await row.getAttribute('data-unit-code');
  await row.locator(`td[data-date="${sunday}"] [data-testid="free-cell"]`).click();
  // PR 5 (ТЗ v2 §32): щелчок открывает окошко свободной клетки, форма — по «Новая бронь»
  await page
    .getByTestId('free-menu')
    .getByRole('link', { name: 'Новая бронь', exact: true })
    .click();
  const form = page.getByTestId('new-reservation-form');
  await expect(form.locator('[name="arrivalDate"]')).toHaveValue(sunday!);
  const monday = new Date(`${sunday}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() + 1);
  await expect(form.locator('[name="departureDate"]')).toHaveValue(
    monday.toISOString().slice(0, 10),
  );
  await expect(form.locator('[name="unitCode"]')).toHaveValue(unitCode!);
});

for (const theme of ['light', 'dark'] as const) {
  test(`неделя помещается на экране: ${theme}, обе панели и телефон`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/chessboard-week', { recursive: true });
    await page.emulateMedia({ colorScheme: theme });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/chessboard');
    const report = [];
    for (const width of [1440, 1024, 812, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page
        .locator('.board-wrap')
        .evaluate((el) => el.scrollWidth - el.clientWidth);
      if (width > 600) {
        expect(overflow, `${width}px`).toBeLessThanOrEqual(1);
        await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
      } else {
        expect(overflow, `${width}px`).toBeGreaterThan(300);
      }
      await expect(page.getByTestId('date-col').first()).toBeInViewport({ ratio: 1 });
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      report.push({ width, overflow, violations: result.violations });
      await page.screenshot({ path: `reports/chessboard-week/${theme}-${width}.png` });
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
    }
    // At desktop width the board has the whole window: navigation lives in the header (ADR-134).
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
    expect(errors).toEqual([]);
    writeFileSync(`reports/chessboard-week/${theme}.json`, JSON.stringify(report, null, 2));
  });
}

test('по умолчанию видна текущая неделя с понедельника по воскресенье', async ({ page }) => {
  const monday = new Date(Date.now() + 5 * 3600_000);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  await page.goto('/chessboard');
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue(
    monday.toISOString().slice(0, 10),
  );
  await expect(page.getByLabel('Период: по', { exact: true })).toHaveValue(
    sunday.toISOString().slice(0, 10),
  );
  await expect(page.getByTestId('date-col').first().locator('.board__wd')).toHaveText('пн');
  await expect(page.getByTestId('date-col').last().locator('.board__wd')).toHaveText('вс');
  // «7 дней» с 09.10 живёт в раскрывашке длины окна и отмечает текущую неделю
  await page.getByTestId('board-length-button').click();
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
