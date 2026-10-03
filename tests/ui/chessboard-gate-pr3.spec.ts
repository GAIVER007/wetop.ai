import { expect, test, FIXTURE_API } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Снимки стоп-гейта PR 3 «Шахматка v2» (карточка брони и быстрый предпросмотр) по списку владельца:
 * 1 ночь, 2 ночи, длинная бронь, долг, оплачено полностью, заселён, заезд сегодня, выезд сегодня,
 * отменённая/незаезд, узкая плашка в 30 днях, открытый предпросмотр — в светлой и тёмной теме.
 * Данные — design-seed стенда (фонд как у Luxx, гости вымышленные, ADR-010). Спек ничего не доказывает
 * red→green: он снимает артефакты гейта, а счётчики строк подтверждают, что снят настоящий экран.
 */
const DIR = 'reports/chessboard-v2-pr3-2026-09-27/gate';
const fixture = FIXTURE_API;
const row = (code: string) => `[data-testid="unit-row"][data-unit-code="${code}"]`;

for (const theme of ['light', 'dark'] as const) {
  test(`гейт PR 3: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync(DIR, { recursive: true });
    await request.post(`${fixture}/__test/reset`);
    expect((await request.post(`${fixture}/__test/design-seed`)).ok()).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    // окно со вчерашнего дня: видны и выезды сегодня (последняя ночь — вчера), и заезды сегодня
    const yesterday = new Date(Date.now() + 5 * 3600_000 - 86_400_000);
    const end = new Date(yesterday.getTime() + 6 * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    await page.goto(`/chessboard?from=${iso(yesterday)}&to=${iso(end)}`);
    await expect(page.getByTestId('unit-row')).toHaveCount(88);

    // неделя целиком: сегодня, заезды и выезды дня, брони разной длины
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-week.png` });
    // строки по состояниям (крупно)
    const rows: Array<[string, string]> = [
      ['R01', 'arrival-today-debt'], // заезд сегодня, 3 ночи, долг суммой
      ['R04', 'departure-today-checked-in'], // заселён, выезд сегодня
      ['R05', 'two-nights-paid'], // 2 ночи, оплачено полностью — без индикатора долга
      ['M04', 'one-night'], // 1 ночь
      ['M03', 'long-debt'], // 6 ночей, заезд сегодня, долг
      ['R08', 'checked-in-debt'], // заселён, долг
      ['R07', 'cancelled-no-show'], // отмена и незаезд: места свободны, на сетке их нет
    ];
    for (const [code, name] of rows) {
      await page.locator(row(code)).scrollIntoViewIfNeeded();
      await page.locator(row(code)).screenshot({ path: `${DIR}/${theme}-row-${name}.png` });
    }

    // крупные строки прокрутили сетку вниз — возвращаем её наверх, как видит смена
    const toTop = () =>
      page.locator('.board-wrap').evaluate((el) => {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      });
    await toTop();
    // открытый предпросмотр: подтверждённая с долгом и заселённый
    await page
      .locator(`${row('R01')} [data-testid="stay-cell"]`)
      .first()
      .click();
    const preview = page.getByTestId('stay-preview');
    await expect(preview.getByTestId('preview-sums')).toContainText('₸');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-preview-confirmed.png` });
    await page.keyboard.press('Escape');
    await page
      .locator(`${row('R08')} [data-testid="stay-cell"]`)
      .first()
      .click();
    await expect(preview.getByTestId('preview-sums')).toContainText('₸');
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-preview-checked-in.png` });
    await page.keyboard.press('Escape');

    // 30 дней: узкие плашки — «Имя Ф.», точка долга; длинные — имя у края при прокрутке
    await page.getByRole('link', { name: '30 дней', exact: true }).click();
    await expect(page.getByTestId('date-col')).toHaveCount(30);
    await toTop();
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-30-days.png` });
    await page.locator('.board-wrap').evaluate((el) => {
      el.scrollLeft = 360;
    });
    await page.screenshot({ caret: 'initial', path: `${DIR}/${theme}-30-days-scrolled.png` });
  });
}
