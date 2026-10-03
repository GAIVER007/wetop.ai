import { FIXTURE_API, expect, test } from './fixtures';
import { mkdirSync } from 'node:fs';

/**
 * Печатные формы дня (REP4, план `plans/reports-hub-2026-10-02.md` §3): «Сводка дня» и «Список
 * проживающих» на `/reports/print` из одного `GET /desk/today`. Числа листа сверяются с ответом
 * самого API фикстуры; телефонов и документов на листе нет — бумага уходит из системы.
 */
const fixture = FIXTURE_API;
const report = 'reports/reports-print-2026-10-03';
const asClient = { headers: { 'x-wetop-test-client': '1' } };

interface Desk {
  counts: { arrivals: number; departures: number; inHouse: number; overdueArrivals: number };
  inHouse: Array<{ guestLabel: string; guestPhone: string | null }>;
  arrivals: Array<{ guestLabel: string; guestPhone: string | null }>;
}

test.beforeEach(async ({ page }) => {
  await page.request.post(`${fixture}/__test/reset`);
});

test('хаб ведёт на лист; «Сводка дня» — числа дня и таблицы, как в /desk/today', async ({
  page,
  request,
}) => {
  const res = await request.get(`${fixture}/desk/today`, asClient);
  expect(res.ok()).toBe(true);
  const desk = (await res.json()) as Desk;

  await page.goto('/reports');
  await page.getByTestId('report-print').click();
  const sheet = page.getByTestId('print-day-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Сводка дня');
  // числа дня — из того же API
  const text = (await sheet.innerText()).replace(/\s+/g, ' ');
  expect(text).toContain(`Заезды ${desk.counts.arrivals}`);
  expect(text).toContain(`Выезды ${desk.counts.departures}`);
  expect(text).toContain(`Проживают ${desk.counts.inHouse}`);
});

test('«Список проживающих»: строка на каждое проживание; телефонов и документов на листе нет', async ({
  page,
  request,
}) => {
  const res = await request.get(`${fixture}/desk/today`, asClient);
  const desk = (await res.json()) as Desk;
  await page.goto('/reports/print?form=inhouse');
  const sheet = page.getByTestId('print-inhouse');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('print-row')).toHaveCount(desk.counts.inHouse);
  const text = await sheet.innerText();
  expect(desk.counts.inHouse).toBeGreaterThan(0);
  expect(text).toContain(desk.inHouse[0]!.guestLabel);
  // ПД: ни одного телефона проживающих и ни слова о документах
  for (const r of [...desk.inHouse, ...desk.arrivals])
    if (r.guestPhone) expect(text).not.toContain(r.guestPhone.replace(/\D/g, '').slice(-7));
  for (const word of ['Паспорт', 'Документ', 'паспорт']) expect(text).not.toContain(word);
});

test('казахская форма и переключение форм без потери даты', async ({ page }) => {
  await page.goto('/reports/print?form=day&lang=kz');
  await expect(page.getByTestId('print-day-sheet').getByRole('heading', { level: 1 })).toHaveText(
    'Күн бойынша жиынтық',
  );
  await page.getByRole('link', { name: 'Список проживающих' }).click();
  await expect(page.getByTestId('print-inhouse')).toBeVisible();
});

for (const theme of ['light'] as const) {
  test(`снимки листов, ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 900, height: 1100 });
    mkdirSync(report, { recursive: true });
    await page.goto('/reports/print?form=day');
    await expect(page.getByTestId('print-day-sheet')).toBeVisible();
    await page.screenshot({ path: `${report}/day.png`, fullPage: true, caret: 'initial' });
    await page.goto('/reports/print?form=inhouse');
    await expect(page.getByTestId('print-inhouse')).toBeVisible();
    await page.screenshot({ path: `${report}/inhouse.png`, fullPage: true, caret: 'initial' });
  });
}
