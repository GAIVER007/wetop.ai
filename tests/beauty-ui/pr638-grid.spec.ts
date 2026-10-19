import { test, expect } from '../ui/fixtures';
import { api, evidence, seed } from './tz11-helpers';

// Real Beauty schedule/API + owned PostgreSQL, not the permissive tests/ui fixture.
// Q-SCHED-1 (подтверждено владельцем 18.10.2026): переключатель в сетке меняет только эту дату через однодневное
// отсутствие; недельный шаблон и выходной по графику меняются в окне мастера, там же защита от чужой правки.
// Неделя после текущей по часам филиала (Asia/Almaty в посеве): API отдаёт только отсутствия с dateTo >= сегодня,
// поэтому зашитая дата превращалась в прошедшую и выключенный день пропадал из ответа (календарная гниль, не баг).
const futureMonday = (weeks: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const at = new Date(`${today}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7) + 7 * weeks);
  return at.toISOString().slice(0, 10);
};
const week = futureMonday(1);
const nextWeek = futureMonday(2);

test('PR638 grid switch changes only that date, the weekly template and the other master stay', async ({ page, request }) => {
  const f = await seed(page, request);
  const a = f.employees[0]!;
  const b = f.employees[1]!;
  const read = async (id: string) => {
    const response = await request.get(`${api}/beauty/schedule?employee=${id}`, { headers: f.headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const offOn = (s: { timeOffs: Array<{ dateFrom: string; dateTo: string }> }, date: string) =>
    s.timeOffs.some((t) => t.dateFrom === date && t.dateTo === date);
  const original = await read(a.id);
  const other = await read(b.id);
  await page.goto(`/beauty/schedule?week=${week}`);
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Тест Анна', exact: true }) });
  const monday = row.getByRole('switch').first();
  await expect(monday).toBeChecked();
  await monday.uncheck();
  await expect.poll(async () => offOn(await read(a.id), week)).toBe(true);
  await expect(monday).toBeEnabled();
  expect((await read(a.id)).week).toEqual(original.week);
  expect((await read(b.id)).week).toEqual(other.week);
  // следующая неделя: тот же понедельник по шаблону рабочий
  await page.getByRole('link', { name: 'Следующая неделя', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`week=${nextWeek}`));
  await expect(monday).toBeChecked();
  await page.getByRole('link', { name: 'Прошлая неделя', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`week=${week}`));
  await expect(monday).not.toBeChecked();
  await monday.check();
  await expect.poll(async () => offOn(await read(a.id), week)).toBe(false);
  await page.reload();
  await expect(monday).toBeChecked();
  // выходной по шаблону: в ячейке нет переключателя, окно мастера объясняет, что меняется каждая неделя
  await f.call(`/beauty/employees/${a.id}/working-hours`, {
    intervals: [], expectedRevision: (await read(a.id)).weekRevision,
  }, 'put');
  await page.reload();
  await expect(row.getByRole('switch')).toHaveCount(0);
  await expect(row.getByText('Выходной по графику').first()).toBeVisible();
  await row.getByRole('button', { name: /^Изменить график/ }).first().click();
  await expect(page.getByTestId('beauty-week-hint')).toBeVisible();
  expect((await read(b.id)).week).toEqual(other.week);
  await page.keyboard.press('Escape');
  for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/screenshots/pr638-grid-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
  }
});

test('PR638 stale weekly window rejects repeated saves without replacing the competing week', async ({ page, request }) => {
  const f = await seed(page, request);
  const a = f.employees[0]!;
  const read = async () => {
    const response = await request.get(`${api}/beauty/schedule?employee=${a.id}`, { headers: f.headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await page.goto('/beauty/schedule?week=2026-10-19');
  await page.getByRole('button', { name: 'Тест Анна', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const save = dialog.getByRole('button', { name: 'Сохранить график', exact: true });
  await expect(save).toBeVisible();
  const original = await read();
  await f.call(`/beauty/employees/${a.id}/working-hours`, {
    expectedRevision: original.weekRevision,
    intervals: [{ weekday: 1, timeFrom: '10:00', timeTo: '16:00' }],
  }, 'put');
  const competing = await read();
  expect(competing.weekRevision).not.toBe(original.weekRevision);
  // Do not reload or inject competing.weekRevision into the still-open stale window.
  for (let attempt = 0; attempt < 2; attempt++) {
    await save.click();
    await expect(dialog.getByRole('alert').filter({ hasText: 'Данные изменены в другом окне' }))
      .toContainText('Данные изменены в другом окне');
    const stored = await read(); // Assertion only: this GET never updates the editor's token.
    expect(stored.weekRevision).toBe(competing.weekRevision);
    expect(stored.week).toEqual(competing.week);
  }
});
