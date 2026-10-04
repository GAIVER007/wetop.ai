import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

/**
 * «Календарь» (02.10.2026, план `plans/calendar-litepms-2026-10-02.md`): раздел «Шахматка»
 * переименован в «Календарь», в строке управления — сводка дня (заезды, выезды, проживают,
 * свободно, загрузка; без денег — они в «Финансах») и быстрые действия «Поиск свободных номеров»
 * и «Неоплаченные»; пустые клетки показывают число месяца;
 * `?stays=debt` открывает сетку с уже включённым фильтром «С долгом».
 */

test('календарь: заголовок, сводка дня и быстрые действия', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  // сводка дня в строке управления: заезды, выезды, проживают, свободно, загрузка — ссылками
  const stats = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(stats).toBeVisible();
  await expect(stats.getByTestId('day-arrivals')).toBeVisible();
  await expect(stats.getByTestId('day-free')).toBeVisible();
  await expect(stats.getByTestId('day-occupancy')).toBeVisible();
  // деньги дня — в «Финансах», на календаре их нет (поручение 02.10)
  await expect(stats.getByText('К оплате')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Сегодня на стойке' })).toHaveCount(0);
  // быстрые действия ведут в существующие потоки
  await expect(page.getByRole('link', { name: 'Поиск свободных номеров' })).toHaveAttribute(
    'href',
    '/rooms/availability',
  );
  await expect(page.getByRole('link', { name: 'Неоплаченные' })).toHaveAttribute(
    'href',
    '/chessboard?stays=debt',
  );
  await expect(page.getByRole('link', { name: /Новая бронь/ })).toBeVisible();
});

test('?stays=debt включает существующий фильтр «С долгом» — «Неоплаченные» одной ссылкой', async ({
  page,
}) => {
  await page.goto('/chessboard?stays=debt');
  const main = page.getByRole('main');
  // строка условий появляется только при отборе: чип «С долгом» и счётчик строк
  await expect(main.getByRole('button', { name: /С долгом/ })).toBeVisible();
  await expect(main.getByRole('button', { name: /^Фильтры 1$/ })).toBeVisible();
  await expect(main.getByText(/Показано \d+ из \d+/)).toBeVisible();
});

// снимки визуального гейта: календарь целиком — заголовок, сводка дня, действия, сетка с числами
for (const theme of ['light', 'dark'] as const) {
  test(`гейт «Календарь»: ${theme}`, async ({ page }) => {
    const DIR = 'reports/calendar-2026-10-02';
    mkdirSync(DIR, { recursive: true });
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chessboard');
    await expect(page.getByRole('group', { name: 'Сегодня на объекте' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/${theme}-1440.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${DIR}/${theme}-390.png` });
  });
}

test('пустая клетка не дублирует дату из шапки календаря', async ({ page }) => {
  await page.goto('/chessboard');
  const free = page.getByTestId('free-cell').first();
  await expect(free).toBeAttached();
  await expect(free).toHaveText('');
  await expect(free.locator('.board__free-day')).toHaveCount(0);
});
