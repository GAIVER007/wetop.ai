import { test, expect } from '../ui/fixtures';
import { api, evidence, seed } from './tz11-helpers';

// Real Beauty schedule/API + owned PostgreSQL, not the permissive tests/ui fixture.
test('PR638 grid persists default hours, weekly template and selected master only', async ({ page, request }) => {
  const f = await seed(page, request);
  const a = f.employees[0]!;
  const b = f.employees[1]!;
  const read = async (id: string) => {
    const response = await request.get(`${api}/beauty/schedule?employee=${id}`, { headers: f.headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const original = await read(a.id);
  const other = await read(b.id);
  await f.call(`/beauty/employees/${a.id}/working-hours`, {
    intervals: [], expectedRevision: original.weekRevision,
  }, 'put');
  await page.goto('/beauty/schedule?week=2026-10-19');
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Тест Анна', exact: true }) });
  const monday = row.getByRole('switch').first();
  await expect(monday).not.toBeChecked();
  await monday.check();
  await expect.poll(async () => (await read(a.id)).week.find((d: { weekday: number }) => d.weekday === 1).intervals)
    .toEqual([{ timeFrom: '09:00', timeTo: '18:00' }]);
  await expect(monday).toBeEnabled();
  expect((await read(b.id)).week).toEqual(other.week);
  await page.getByRole('link', { name: 'Следующая неделя', exact: true }).click();
  await expect(page).toHaveURL(/week=2026-10-26/);
  await expect(monday).toBeChecked();
  await monday.uncheck();
  await expect.poll(async () => (await read(a.id)).week.flatMap((d: { intervals: unknown[] }) => d.intervals)).toEqual([]);
  await page.reload();
  await expect(monday).not.toBeChecked();
  expect((await read(b.id)).week).toEqual(other.week);
  for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/screenshots/pr638-grid-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
  }
});

test('PR638 stale grid rejects repeated writes without replacing the competing week', async ({ page, request }) => {
  const f = await seed(page, request);
  const a = f.employees[0]!;
  await page.goto('/beauty/schedule?week=2026-10-19');
  const monday = page.getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Тест Анна', exact: true }) })
    .getByRole('switch').first();
  await expect(monday).toBeChecked();
  const read = async () => {
    const response = await request.get(`${api}/beauty/schedule?employee=${a.id}`, { headers: f.headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const original = await read();
  await f.call(`/beauty/employees/${a.id}/working-hours`, {
    expectedRevision: original.weekRevision,
    intervals: [{ weekday: 1, timeFrom: '10:00', timeTo: '16:00' }],
  }, 'put');
  const competing = await read();
  expect(competing.weekRevision).not.toBe(original.weekRevision);
  // Do not reload or inject competing.weekRevision into the still-open stale UI.
  for (let attempt = 0; attempt < 2; attempt++) {
    await monday.uncheck();
    await expect(page.getByRole('alert')).toContainText('Данные изменены в другом окне');
    await expect(monday).toBeChecked();
    const stored = await read(); // Assertion only: this GET never updates the editor's token.
    expect(stored.weekRevision).toBe(competing.weekRevision);
    expect(stored.week).toEqual(competing.week);
  }
});
