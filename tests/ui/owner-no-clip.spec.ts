import { mkdirSync } from 'node:fs';
import { expect, test } from './fixtures';

/**
 * «Все бизнесы» (владелец 31.10.2026: «сделай удобней, текст обрезается»): названия бизнесов и подписи видны целиком,
 * таблица без горизонтальной прокрутки на ноутбуке и телефоне. Данные стенда вымышленные.
 */
for (const width of [1280, 390]) {
  test(`все бизнесы: ничего не обрезано, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/owner');
    const main = page.getByRole('main');
    await expect(main.getByTestId('owner-table')).toBeVisible();
    // ни одна подпись и ни одна сумма не обрезана многоточием и не вылезает из своей ячейки
    const cut = await main.evaluate((root) =>
      [...root.querySelectorAll<HTMLElement>('h1, h2, h3, b, dt, dd, small, .owner__sub, th, td, .btn')]
        .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.textContent?.trim() ?? ''),
    );
    expect(cut).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (process.env.SCHEDULE_SHOTS) {
      mkdirSync(process.env.SCHEDULE_SHOTS, { recursive: true });
      await page.screenshot({ path: `${process.env.SCHEDULE_SHOTS}/owner-${width}.png`, fullPage: true });
    }
  });
}

/**
 * «Все бизнесы» в один экран без обреза снизу (владелец 01.11.2026, скрин ноутбука: «нижняя часть обрезанная»):
 * на 1440×900 и на ноутбуке 1280×720 страница не листается, последняя строка таблицы видна целиком.
 */
for (const [width, height] of [[1440, 900], [1280, 720]] as const)
  test(`все бизнесы в один экран ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/owner');
    const table = page.getByRole('main').getByTestId('owner-table');
    await expect(table).toBeVisible();
    const fit = await page.evaluate(() => ({
      overflow: document.documentElement.scrollHeight - innerHeight,
      lastRow: Math.round(document.querySelector('[data-testid="owner-row"]:last-child')!.getBoundingClientRect().bottom),
    }));
    expect(fit.overflow).toBeLessThanOrEqual(0);
    expect(fit.lastRow).toBeLessThanOrEqual(height);
    // выручка за полгода осталась: в карточке итога своей валюты
    await expect(page.getByTestId('owner-total-KZT').getByTestId('owner-chart-KZT')).toBeVisible();
  });
