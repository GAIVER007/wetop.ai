import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';

/* Раскрытие прогноза, повтор после отказов и телефонные размеры блоков владельца на «Главной» `/today` (ADR-180). */
const SHOTS = 'reports/finance-home-merge-2026-10-09';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('forecast details expose availability and open the selected calendar day', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  // прогноз свёрнут по умолчанию (ADR-180): раскрыть перед работой с «Загрузкой по дням»
  await page.getByText('Прогноз загрузки', { exact: true }).click();
  const trigger = page.getByRole('button', { name: 'Загрузка по дням', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Ближайшие 7 дней', exact: true });
  await expect(dialog).toBeVisible();
  const days = dialog.getByRole('link');
  await expect(days).toHaveCount(7);
  expect((await days.first().boundingBox())!.height).toBeGreaterThanOrEqual(64);
  await expect(days.first()).toContainText('Свободно');
  const href = await days.nth(1).getAttribute('href');
  expect(href).toMatch(/^\/chessboard\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
  await page.screenshot({
    caret: 'initial',
    path: `${SHOTS}/forecast.png`,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await days.nth(1).click();
  await expect(page).toHaveURL(new RegExp(href!.replace('?', '\\?')));
});

test('forecast can recover in place after a temporary API failure', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '/desk/dashboard' } });
  await page.goto('/today');
  const load = page.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await load.getByText('Прогноз загрузки', { exact: true }).click();
  await expect(load.getByText('Прогноз загрузки недоступен', { exact: false })).toBeVisible();
  // отказ аналитики не трогает очередь внимания: она живёт своими запросами
  await expect(page.getByRole('button', { name: 'Все задачи', exact: true })).toBeVisible();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '' } });
  await load.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(load.getByTestId('owner-outlook-chart')).toBeVisible();
  await expect(load.getByRole('button', { name: 'Повторить', exact: true })).toHaveCount(0);
});

test('unavailable inventory stays explicit and can be retried', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '/chessboard' } });
  await page.goto('/today');
  const load = page.getByRole('region', { name: 'Загрузка и операционные показатели' });
  await expect(load.getByTestId('c-occupancy')).toHaveText('Нет данных');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { failPath: '' } });
  await load.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(load.getByTestId('c-occupancy')).not.toHaveText('Нет данных');
});

for (const width of [390, 1440])
  test(`slow inventory keeps daily events usable and shows a stable loading card at ${width} px`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/today');
    const readyCard = page.getByRole('region', { name: 'Загрузка и операционные показатели' });
    await expect(readyCard).toBeVisible();
    const ready = await readyCard.boundingBox();
    await request.post(`${FIXTURE_API}/__test/control`, {
      data: { delayPath: '/chessboard', delayMs: 6000 },
    });
    await page.goto('/today', { waitUntil: 'commit' });
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    const loading = page.getByRole('status', { name: 'Загружаем загрузку…', exact: true });
    await expect(loading).toBeVisible({ timeout: 2000 });
    // слот карточки измеряем сам по себе: заглушку может успеть сменить настоящая карточка
    // Измеряем видимый слот один раз, чтобы смена streamed-узла не дала null между вызовами.
    const slot = page.locator('.owner-load:visible').first();
    let loadingHeight: number | null = null;
    await expect
      .poll(async () => {
        loadingHeight = (await slot.boundingBox())?.height ?? null;
        return loadingHeight;
      })
      .not.toBeNull();
    expect(Math.abs(loadingHeight! - ready!.height)).toBeLessThan(24);
    await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toBeVisible({
      timeout: 2000,
    });
    if (width === 390) await page.screenshot({ caret: 'initial', path: `${SHOTS}/loading.png` });
    await expect(page.getByTestId('c-occupancy')).toBeVisible();
  });

for (const theme of ['light', 'dark'] as const) {
  test(`forecast drawer stays accessible at 320 px in ${theme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/today');
    await page.getByText('Прогноз загрузки', { exact: true }).click();
    await page.getByRole('button', { name: 'Загрузка по дням', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Ближайшие 7 дней', exact: true });
    await expect(dialog).toBeVisible();
    for (const link of await dialog.getByRole('link').all()) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(64);
    }
    expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      audit.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.screenshot({
      caret: 'initial',
      path: `${SHOTS}/forecast-${theme}-320.png`,
    });
  });
}

test('weekly outlook opens a calendar day directly', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  await page.getByText('Прогноз загрузки', { exact: true }).click();
  const days = page.getByTestId('owner-outlook-chart').getByRole('link');
  await expect(days).toHaveCount(7);
  const day = days.nth(2);
  const href = await day.getAttribute('href');
  expect(href).toMatch(/^\/chessboard\?from=(\d{4}-\d{2}-\d{2})&to=\1$/);
  await day.focus();
  await day.press('Enter');
  await expect(page).toHaveURL(new RegExp(href!.replace('?', '\\?')));
});

test('compact owner summary fits a 360 by 800 phone first screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/today');
  await page.getByText('Прогноз загрузки', { exact: true }).click();
  await expect(page.getByTestId('owner-outlook-chart').getByRole('link')).toHaveCount(7);
  // загрузка начинает первый экран; события дня ниже, достижимы прокруткой (ADR-180)
  await expect(page.getByTestId('c-occupancy')).toBeInViewport();
  await expect(page.getByRole('region', { name: 'Сегодня', exact: true })).toBeAttached();
  await page.screenshot({ path: `${SHOTS}/mobile-360.png` });
});
