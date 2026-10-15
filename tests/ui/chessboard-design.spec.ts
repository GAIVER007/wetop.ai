import { FIXTURE_API, expect, test, devNoise } from './fixtures';
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

// адрес стенда общий для набора: `UI_FIXTURE_API` или `FIXTURE_PORT`, параллельные сессии не делят 4311
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('статусы шахматки понятны без открытия инструкции', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  mkdirSync('reports/chessboard-design-2026-09-20', { recursive: true });
  // Исходный вид сохраняется только при отдельном RED-прогоне.
  if (process.env.BOARD_DESIGN_BASELINE === '1') {
    await page.screenshot({
      caret: 'initial',
      path: 'reports/chessboard-design-2026-09-20/before-1440.png',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      caret: 'initial',
      path: 'reports/chessboard-design-2026-09-20/before-390.png',
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByTestId('board-legend-button').click();
  await expect(page.getByTestId('board-legend')).toBeVisible();
  await expect(page.getByTestId('board-legend')).toContainText('подтверждена');
  await expect(page.getByTestId('board-legend')).toContainText('проживает');
  // Основная строка компактна, переход к сегодняшней дате внутри меню месяца.
  await expect(page.getByRole('link', { name: 'Сегодня', exact: true })).toBeHidden();
  await page.getByTestId('board-period-button').click();
  await expect(page.getByRole('button', { name: 'Сегодня', exact: true })).toBeVisible();
});

test('ручные даты раскрываются с клавиатуры и сбрасываются при смене периода', async ({ page }) => {
  await page.goto('/chessboard');
  // Один контрол периода содержит календарь, пресеты и поля дат.
  const menu = page.locator('.board-nav .date-range');
  const opener = page.getByTestId('board-period-button');
  await expect(menu).toHaveJSProperty('open', false);
  await expect(page.getByLabel('Период: с', { exact: true })).toBeHidden();
  await opener.focus();
  await page.keyboard.press('Space');
  await expect(menu).toHaveJSProperty('open', true);
  await page.getByLabel('Период: с', { exact: true }).fill('2026-10-05');
  await page.getByLabel('Период: по', { exact: true }).fill('2026-10-11');
  await page.getByRole('button', { name: 'Применить', exact: true }).click();
  await expect(page).toHaveURL('/chessboard?from=2026-10-05&to=2026-10-11');
  await expect(page.getByTestId('date-col')).toHaveCount(7);
  // после перехода раскрывашка закрыта, поля несут новые даты
  await expect(menu).toHaveJSProperty('open', false);
  await page.getByRole('link', { name: 'Следующая неделя', exact: true }).click();
  await expect(page.getByLabel('Период: с', { exact: true })).toHaveValue('2026-10-12');
  await opener.click();
  await page.getByRole('button', { name: 'Сегодня', exact: true }).click();
  const today = await page.getByLabel('Период: с', {exact: true}).inputValue();
  await expect(page.getByLabel('Период: по', {exact: true})).toHaveValue(today);
  await page.getByRole('button', {name: 'Применить', exact: true}).click();
  await expect(page).toHaveURL(`/chessboard?from=${today}&to=${today}`);
});

for (const theme of ['light', 'dark'] as const) {
  test(`дизайн шахматки: ${theme}, компактное управление и доступная сетка`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/chessboard-design-2026-09-20', { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/chessboard');
    // Ждём не только SSR, но и интерактивный фильтр перед снимками.
    await page.getByLabel('Поиск в календаре').fill('R01');
    await expect(page.getByTestId('unit-row')).toHaveCount(1);
    await page.getByLabel('Поиск в календаре').fill('');
    await expect(page.getByTestId('unit-row')).toHaveCount(88);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const board = page.locator('.board-wrap');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      const overflow = await board.evaluate((el) => el.scrollWidth - el.clientWidth);
      if (width > 600) expect(overflow).toBeLessThanOrEqual(1);
      else expect(overflow).toBeGreaterThan(300);
      const box = await board.boundingBox();
      if (width >= 1440) expect(box!.y).toBeLessThanOrEqual(384);
      if (width <= 390) {
        await expect(page.getByRole('group', { name: 'Сегодня на объекте' })).toBeVisible();
        expect(box!.y).toBeLessThanOrEqual(760);
      }
      await expect(page.getByTestId('date-col').first()).toBeInViewport({ ratio: 1 });
      if (width > 600)
        await expect(page.getByTestId('date-col').last()).toBeInViewport({ ratio: 1 });
      // Обрезанный текст категории не должен заходить на соседние показатели.
      for (const name of await page.locator('.board-group-name-text').all()) {
        const overlap = await name.evaluate((el) => {
          const next = el.nextElementSibling;
          if (!next || getComputedStyle(next).display === 'none') return 0;
          return el.getBoundingClientRect().right - next.getBoundingClientRect().left;
        });
        expect(overlap).toBeLessThanOrEqual(1);
      }
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        audit.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await page.screenshot({
        caret: 'initial',
        path: `reports/chessboard-design-2026-09-20/${theme}-${width}.png`,
      });
    }
    expect(errors).toEqual([]);
  });
}
