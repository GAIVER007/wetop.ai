import AxeBuilder from '@axe-core/playwright';
import { seedMarket } from './ds1c-market-seed';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * MV8.5 DS1c: остальные примитивы (DESIGN.md §8.2) в браузере на экранах-представителях: доля, плитка,
 * день, период, размеры окон, обязательность поля, таблица с липкой колонкой, главная кнопка, телефон и
 * axe. Салон и ресторан проверяют свой день своими наборами (`tests/beauty-ui`, `tests/food-ui`).
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

const kit = (page: Page) => page.getByTestId('kit-light');

test('доля на «Сайт → Аналитика»: родной progress с именем и числом, без ширины строкой стиля', async ({
  page,
}) => {
  await page.goto('/website/analytics');
  const bars = page.getByRole('main').getByRole('progressbar');
  expect(await bars.count()).toBeGreaterThan(0);
  const first = bars.first();
  await expect(first).toHaveAttribute('max', '100');
  await expect(first).toHaveAttribute('aria-label', /^Доля: /);
  await expect(page.locator('.share__fill, .share__track')).toHaveCount(0);
  const styled = await page
    .getByRole('main')
    .locator('.share-bar [style]')
    .count();
  expect(styled).toBe(0);
});

test('плитка: тон чертой слева, изменение словами, плитка-ссылка с фокусом', async ({ page }) => {
  await page.goto('/design-system');
  const section = kit(page).locator('section[data-component="stat"]');
  const danger = section.locator('.stat--tone-danger').first();
  const shadow = await danger.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain('inset');
  const bg = await danger.evaluate((el) => getComputedStyle(el).backgroundColor);
  const plain = await section.locator('.stat:not([class*="tone"])').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg).toBe(plain);
  await expect(section.getByText('+3,2 п.п.')).toBeVisible();
  const link = section.getByRole('link', { name: /Заезды сегодня/ });
  await link.focus();
  await expect(link).toBeFocused();
  const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await expect(link.locator('a, button')).toHaveCount(0);
});

test('день: предыдущий, следующий, «Сегодня» и поле «Дата» с подписью', async ({ page }) => {
  await page.goto('/design-system');
  const bar = kit(page).locator('section[data-component="date-bar"] .date-bar').first();
  const date = bar.getByLabel('Дата', { exact: true });
  await expect(date).toHaveValue('2026-10-12');
  await bar.getByRole('button', { name: 'Следующий день' }).click();
  await expect(date).toHaveValue('2026-10-13');
  await bar.getByRole('button', { name: 'Предыдущий день' }).click();
  await bar.getByRole('button', { name: 'Предыдущий день' }).click();
  await expect(date).toHaveValue('2026-10-11');
  await date.fill('2026-11-01');
  await expect(date).toHaveValue('2026-11-01');
  await bar.getByRole('button', { name: 'Сегодня', exact: true }).click();
  await expect(date).toHaveValue('2026-10-12');
  const second = kit(page).locator('section[data-component="date-bar"] .date-bar').nth(1);
  await expect(second.getByRole('button', { name: 'Сегодня', exact: true })).toHaveCount(0);
});

test('период «Броней»: готовые отрезки ссылками, поля «С» и «По», применяет «Показать», адрес прежний', async ({
  page,
}) => {
  await page.goto('/reservations?from=2026-09-10&to=2026-09-24');
  const picker = page.locator('.period-picker');
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('navigation', { name: 'Готовые периоды' })).toBeVisible();
  await expect(picker.getByLabel('Период: с')).toHaveValue('2026-09-10');
  await picker.getByLabel('Период: по').fill('2026-09-20');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page).toHaveURL(/from=2026-09-10/);
  await expect(page).toHaveURL(/to=2026-09-20/);
  await expect(page.locator('.period-picker').getByLabel('Период: по')).toHaveValue('2026-09-20');
});

test('размеры окон: «Новая задача» sm, новая бронь lg, Escape закрывает и возвращает фокус', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tasks');
  const open = page.getByTestId('task-new');
  await open.click();
  const task = page.getByRole('dialog', { name: 'Новая задача' });
  await expect(task).toBeVisible();
  expect(Math.round((await task.boundingBox())!.width)).toBe(400);
  await page.keyboard.press('Escape');
  await expect(task).toBeHidden();
  await expect(open).toBeFocused();

  await page.goto('/reservations');
  await page.getByRole('link', { name: 'Новая бронь' }).first().click();
  const booking = page.getByRole('dialog', { name: 'Новая бронь' });
  await expect(booking).toBeVisible();
  expect(Math.round((await booking.boundingBox())!.width)).toBe(760);
});

test('поле: обязательное с родным required и знаком, необязательное словом', async ({ page }) => {
  await page.goto('/design-system');
  const section = kit(page).locator('section[data-component="form-grid"]');
  const name = section.getByRole('textbox', { name: 'Имя', exact: true });
  await expect(name).toHaveAttribute('required', '');
  // знак виден (`::after`), но подпись и имя поля остаются «Имя»: прежние `getByLabel` не ломаются
  await expect(section.getByLabel('Имя', { exact: true })).toHaveCount(1);
  const mark = await section
    .locator('.field__label--required')
    .first()
    .evaluate((el) => getComputedStyle(el, '::after').content);
  expect(mark).toContain('*');
  const middle = section.getByLabel(/^Отчество/);
  await expect(middle).not.toHaveAttribute('required', /.*/);
  await expect(section.locator('.field__optional')).toHaveText('необязательно');
});

test('таблица `/market`: липкая колонка отелей общим классом, имя области прокрутки', async ({
  page,
  request,
}) => {
  await seedMarket(request);
  await page.goto('/market');
  const table = page.getByTestId('market-table');
  await expect(table).toHaveClass(/tbl--sticky-column/);
  const position = await table
    .locator('th.market-table__name')
    .first()
    .evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe('sticky');
  await expect(
    page.getByRole('region', { name: 'Загрузка по ночам: вы и конкуренты' }),
  ).toBeVisible();
});

test('главная кнопка: под курсором фон --primary-hover, без фильтра и градиента', async ({ page }) => {
  await page.goto('/design-system');
  const button = kit(page)
    .locator('section[data-component="button"] [data-state="default"] .btn')
    .first();
  const hoverToken = await kit(page).evaluate((el) =>
    getComputedStyle(el).getPropertyValue('--primary-hover').trim(),
  );
  await button.hover();
  // переход фона длится 180 мс: читаем цвет только после его конца, иначе на медленном раннере приходит
  // промежуточный цвет (CI release-checks 37835129463: rgb(6, 77, 152) вместо rgb(6, 74, 146))
  const style = await button.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((a) => a.finished));
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, image: s.backgroundImage, filter: s.filter };
  });
  const expected = await page.evaluate((hex) => {
    const probe = document.createElement('div');
    probe.style.color = hex;
    document.body.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  }, hoverToken);
  expect(style.bg).toBe(expected);
  expect(style.image).toBe('none');
  expect(style.filter).toBe('none');
});

const SCREENS = ['/market', '/website/analytics', '/reservations?from=2026-09-10&to=2026-09-24', '/design-system'];

const PRIMITIVES = ['.stat', '.share-bar', '.form-grid', '.period-picker', '.date-bar', '.tbl--sticky-column'];

for (const theme of ['light', 'dark'] as const) {
  test(`390 px: представители DS1c без прокрутки вбок, axe по новым примитивам (${theme})`, async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await seedMarket(request);
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of SCREENS) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, route).toBeLessThanOrEqual(0);
      const present = [];
      for (const selector of PRIMITIVES) {
        if ((await page.locator(selector).count()) > 0) present.push(selector);
      }
      expect(present.length, route).toBeGreaterThan(0);
      const result = await new AxeBuilder({ page })
        .include(present.join(', '))
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        route,
      ).toEqual([]);
    }
  });
}
