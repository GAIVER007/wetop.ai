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
