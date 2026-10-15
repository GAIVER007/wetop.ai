import { FIXTURE_API, expect, test } from './fixtures';

const add = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

for (const width of [360, 390, 430, 1440]) {
  for (const close of ['escape', 'button'] as const) {
    test(`free panel ${width} ${close}: restores cell focus without scrolling`, async ({
      page,
      request,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const stay = await (
        await request.get(`${FIXTURE_API}/reservations/20260913-TEST1`, {
          headers: { 'x-wetop-test-client': '1' },
        })
      ).json();
      const from = stay.arrivalDate as string;
      await page.goto(`/chessboard?from=${from}&to=${add(from, 6)}`);
      await page.getByLabel('Поиск в календаре').fill('R07');
      const cell = page.locator(`[data-unit-code="R07"] td[data-date="${add(from, 3)}"]`);
      await cell.getByTestId('free-cell').click();
      const panel = page.getByTestId('free-menu');
      await expect(panel).toBeVisible();
      const before = await page
        .locator('.board-wrap')
        .evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop, page: window.scrollY }));
      if (close === 'escape') await panel.press('Escape');
      else await panel.getByRole('button', { name: 'Закрыть', exact: true }).click();
      await expect(panel).toBeHidden();
      await expect(cell).toBeFocused();
      const after = await page
        .locator('.board-wrap')
        .evaluate((el) => ({ left: el.scrollLeft, top: el.scrollTop, page: window.scrollY }));
      expect(after).toEqual(before);
      await expect(cell).toHaveAttribute('tabindex', '-1');
      await cell.getByTestId('free-cell').click();
      await expect(panel).toBeVisible();
      if (width <= 600) {
        await panel.getByLabel('Период проживания').selectOption('2');
        await expect(
          panel.getByRole('link', { name: 'Создать бронь', exact: true }),
        ).toHaveAttribute(
          'href',
          `/reservations/new?arrival=${add(from, 3)}&departure=${add(from, 6)}&unit=R07`,
        );
      } else {
        await expect(panel.getByRole('link', { name: 'Новая бронь', exact: true })).toHaveAttribute(
          'href',
          `/reservations/new?arrival=${add(from, 3)}&departure=${add(from, 4)}&unit=R07`,
        );
      }
    });
  }
}

test('free panel outside click leaves focus on the selected control', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/chessboard');
  const search = page.getByLabel('Поиск в календаре');
  await search.fill('R07');
  const cell = page.getByTestId('free-cell').first();
  await cell.click();
  await expect(page.getByTestId('free-menu')).toBeVisible();
  await search.click();
  await expect(page.getByTestId('free-menu')).toBeHidden();
  await expect(search).toBeFocused();
});
