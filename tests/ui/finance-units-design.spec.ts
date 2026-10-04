import { expect, test } from '@playwright/test';
import { FIXTURE_API } from './fixtures';

/**
 * «Деньги за период» и карточка ячейки без каши (21.09.2026, продолжение правки).
 *
 * Найдено на стенде: на «Деньгах» три таблицы по три колонки («По видам начислений», «Проживание по
 * категориям», «Оплаты по способам») стояли в панелях по 335 px, а общий `.table-scroll > .tbl`
 * держит `min-width: 520px` — колонка «Сумма» (сами деньги) уходила в прокрутку без признака, на
 * 1440 px за краем было 185 px. В карточке ячейки подзаголовок склеен точками («номер · Двухместный
 * номер · комната R1»), даты проживаний печатались как в базе («2026-09-21»), заголовок со скобками.
 */
const fixture = FIXTURE_API;

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

for (const [name, width, height] of [
  ['1440', 1440, 1000],
  ['телефон', 390, 844],
] as const) {
  test(`деньги за период: колонка «Сумма» видна без прокрутки вбок (${name})`, async ({ page }) => {
    const main = page.getByRole('main');
    await page.setViewportSize({ width, height });
    await page.goto('/finance');
    await expect(main.getByTestId('finance-charges')).toBeVisible();
    // «Проживание по категориям» с 01.10.2026 свёрнуто под «По видам начислений»: раскрываем, чтобы
    // проверить и его колонку «Сумма»
    await main.getByTestId('finance-charges').getByText('Проживание по категориям').click();
    await expect(main.getByTestId('category-table')).toBeVisible();
    for (const id of ['finance-charges', 'finance-money']) {
      const tables = main.getByTestId(id).locator('table');
      const n = await tables.count();
      expect(n, `${id}: таблиц нет`).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const table = tables.nth(i);
        const clipped = await table.evaluate((el) => {
          const scroller = el.closest('.table-scroll') ?? el.parentElement!;
          return scroller.scrollWidth - scroller.clientWidth;
        });
        expect(clipped, `${id}: таблица ${i + 1} обрезана прокруткой`).toBeLessThanOrEqual(1);
        // «Сумма» — внутри своей панели по горизонтали (по вертикали таблица может быть ниже экрана)
        const overhang = await table.getByRole('columnheader', { name: 'Сумма' }).evaluate((th) => {
          const scroller = th.closest('.table-scroll') ?? th.closest('table')!.parentElement!;
          return th.getBoundingClientRect().right - scroller.getBoundingClientRect().right;
        });
        expect(overhang, `${id}: «Сумма» за краем панели`).toBeLessThanOrEqual(1);
        // деньги не переносятся на две строки («24 000» / «₸») даже в узкой панели
        const wrapped = await table.locator('tbody td.num').evaluateAll(
          (cells) =>
            cells.filter((td) => {
              const range = document.createRange();
              range.selectNodeContents(td);
              return range.getClientRects().length > 1;
            }).length,
        );
        expect(wrapped, `${id}: сумма перенесена на две строки`).toBe(0);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}

test('карточка ячейки: подзаголовок словами, даты проживаний в <time>, заголовок без скобок', async ({
  page,
}) => {
  const main = page.getByRole('main');
  await page.goto('/units/R01');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Ячейка R01');
  const subtitle = main.locator('.page__subtitle');
  await expect(subtitle).toContainText('комната R1');
  await expect(subtitle).toContainText('Двухместный номер');
  await expect(subtitle).not.toContainText(' · ');
  await expect(main.getByRole('heading', { name: 'Ближайшие проживания, 60 дней' })).toBeVisible();
  const stays = main.getByTestId('unit-stays');
  const row = stays.locator('tbody tr').first();
  await expect(row.locator('time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  await expect(row).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(row).toContainText(/\d{2}\.\d{2}\.\d{4}/);
});
