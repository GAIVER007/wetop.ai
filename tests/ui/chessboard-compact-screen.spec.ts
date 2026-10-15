import type { Page } from '@playwright/test';
import { FIXTURE_API, test, expect } from './fixtures';

/**
 * Рабочий экран календаря на ноутбуке 1366×768 (решение владельца 07.10.2026, baseline B).
 *
 * Контракт про смысл, а не про высоту сетки в пикселях: все 88 мест на месте, у страницы нет вертикальной
 * прокрутки, сетка доходит почти до низа окна, строка дат видна, и внутри сетки целиком видно не меньше восьми
 * строк мест. Строки считаются по их настоящим рамкам: строка видна, если она целиком ниже липкой строки дат
 * и выше нижней границы видимой области сетки.
 */
const VIEW_KEY = 'wetop.chessboard.view';
const MIN_ROWS = 8;
const MAX_BOTTOM_GAP = 32;

async function measure(page: Page) {
  return page.evaluate(() => {
    const wrap = document.querySelector('.board-wrap')!.getBoundingClientRect();
    const head = document.querySelector('.board thead')!.getBoundingClientRect();
    const rows = [...document.querySelectorAll('[data-testid="unit-row"]')].map((row) =>
      row.getBoundingClientRect(),
    );
    const visible = rows.filter(
      (box) => box.height > 0 && box.top >= head.bottom - 0.5 && box.bottom <= wrap.bottom + 0.5,
    ).length;
    return {
      visible,
      headTop: head.top,
      headBottom: head.bottom,
      wrapBottom: wrap.bottom,
      bottomGap: innerHeight - wrap.bottom,
      pageScrolls: document.documentElement.scrollHeight > innerHeight + 1,
      innerHeight,
    };
  });
}

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('ноутбук 1366×768: восемь строк мест видны целиком, страница не прокручивается', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/chessboard?from=2026-09-14&to=2026-09-20');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  const m = await measure(page);
  // строка дат видна целиком
  expect.soft(m.headTop).toBeGreaterThanOrEqual(0);
  expect.soft(m.headBottom).toBeLessThanOrEqual(m.innerHeight);
  expect
    .soft(m.pageScrolls, 'у страницы календаря не должно быть вертикальной прокрутки')
    .toBe(false);
  expect
    .soft(m.bottomGap, 'сетка должна доходить почти до низа окна')
    .toBeLessThanOrEqual(MAX_BOTTOM_GAP);
  expect.soft(m.visible, `видно строк мест: ${m.visible}`).toBeGreaterThanOrEqual(MIN_ROWS);
  await page.screenshot({ path: 'reports/chessboard-compact-screen.png' });
});

test('свёрнутые категории переживают перезагрузку и разворачиваются', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/chessboard?from=2026-09-14&to=2026-09-20');
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.getByRole('button', { name: 'Свернуть категории', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('unit-row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Развернуть категории', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
});

test('без сохранённого выбора вид «Обычный» (образец владельца 09.10), сохранённые «Компактный» и «Подробный» восстанавливаются', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/chessboard?from=2026-09-14&to=2026-09-20');
  const wrap = page.locator('.board-wrap');
  await expect(wrap).toHaveAttribute('data-density', 'normal');
  for (const view of ['compact', 'detailed'] as const) {
    await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [VIEW_KEY, view]);
    await page.reload();
    await expect(wrap).toHaveAttribute('data-density', view);
  }
  // выбор в переключателе «Вид» запоминается; с 09.10 переключатель живёт в окошке «Фильтры»
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page
    .getByRole('group', { name: 'Вид строк календаря' })
    .getByRole('button', { name: 'Компактный', exact: true })
    .click();
  await expect(wrap).toHaveAttribute('data-density', 'compact');
  await page.reload();
  await expect(wrap).toHaveAttribute('data-density', 'compact');
  // «Обычный» возвращается тем же переключателем и тоже помнится
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page
    .getByRole('group', { name: 'Вид строк календаря' })
    .getByRole('button', { name: 'Обычный', exact: true })
    .click();
  await expect(wrap).toHaveAttribute('data-density', 'normal');
  await page.reload();
  await expect(wrap).toHaveAttribute('data-density', 'normal');
});
