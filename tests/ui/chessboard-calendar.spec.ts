import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

/**
 * «Календарь» (02.10.2026, план `plans/calendar-litepms-2026-10-02.md`): раздел «Шахматка»
 * переименован в «Календарь», в строке управления показана компактная сводка дня без повторов
 * (заезды, горящие брони, выезды, проживания, незаезды, свободные номера и загрузка; без денег) и быстрые действия
 * «Поиск свободных номеров» и «Неоплаченные»;
 * `?stays=debt` открывает сетку с уже включённым фильтром «С долгом».
 */

test('календарь: заголовок, сводка дня и быстрые действия', async ({ page }) => {
  await page.goto('/chessboard');
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  // В сводке остаются только рабочие показатели без задач и дней рождения.
  const stats = page.getByRole('group', { name: 'Сегодня на объекте' });
  await expect(stats).toBeVisible();
  await expect(stats.getByTestId('day-arrivals')).toBeVisible();
  await expect(stats.getByTestId('day-departures')).toBeVisible();
  await expect(stats.getByTestId('day-tasks')).toHaveCount(0);
  await expect(stats.getByTestId('day-noshow')).toBeVisible();
  await expect(stats.getByTestId('day-hot')).toBeVisible();
  await expect(stats.getByTestId('day-free')).toBeVisible();
  await expect(stats.getByTestId('day-occupied')).toBeVisible();
  await expect(stats.getByTestId('day-occupancy')).toBeVisible();
  await expect(stats.getByText('Проживания')).toBeVisible();
  await expect(stats.getByText('Дни рождения')).toBeHidden();
  // деньги дня — в «Финансах», на календаре их нет (поручение 02.10)
  await expect(stats.getByText('К оплате')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Сегодня на стойке' })).toHaveCount(0);
  // Search preserves the visible inclusive calendar period as exclusive stay dates.
  const dateColumns = page.getByTestId('date-col');
  const arrival = (await dateColumns.first().getAttribute('data-date'))!;
  const last = (await dateColumns.last().getAttribute('data-date'))!;
  const departure = new Date(Date.parse(`${last}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  await expect(page.getByRole('link', { name: 'Поиск свободных номеров' })).toHaveAttribute(
    'href',
    `/rooms/availability?arrival=${arrival}&departure=${departure}`,
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

test('даты в шапке не повторяют свободные и занятые места', async ({ page }) => {
  await page.goto('/chessboard');
  const headers = page.getByTestId('date-col');
  await expect(headers).not.toHaveCount(0);
  await expect(headers.locator('.board-day-metrics')).toHaveCount(0);
  await expect(headers.locator('.board__free-count')).toHaveCount(0);
  await expect(headers.locator('[data-testid^="occupied-"]')).toHaveCount(0);
});
