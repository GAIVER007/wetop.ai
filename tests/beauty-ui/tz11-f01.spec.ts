import { chooseCalendarEmployee } from './calendar-employee';
import { test, expect } from '../ui/fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { api, date, evidence, seed, nextDate } from './tz11-helpers';

for (const width of [1440, 390]) for (const theme of ['light', 'dark'] as const) {
  test(`F01 occupied intervals survive filters ${width} ${theme}`, async ({ page, request }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const f = await seed(page, request);
    const first = (await f.book('10:00')).appointments[0];
    await f.book('12:00', 0, 1, 'Тест второй');
    await f.book('10:00', 1, 1, 'Тест другой мастер');
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      const before = (await db.query('SELECT * FROM pms_test.appointments WHERE id=$1', [first.id])).rows;
      await page.goto(`/calendar?date=${date}`);
      const board = width === 390 ? page.getByTestId('beauty-mobile-calendar') : page.getByTestId('beauty-grid');
      await expect(board).toBeVisible();
      const free = (time: string) => board.getByRole('button', { name: `Тест Анна, ${time}, свободно`, exact: true });
      await expect(free('10:00')).toHaveCount(0);
      await page.getByText(/^Фильтры/).click();
      await page.getByLabel('Статус записи', { exact: true }).selectOption('DONE');
      // The regression MUST fail here on baseline: hidden BOOKED is falsely advertised as free.
      await expect(free('10:00'), 'hidden blocking appointment must never become a free cell').toHaveCount(0);
      await expect(page.getByTestId('beauty-day-summary')).toContainText('По выбранным фильтрам');
      for (const status of ['BOOKED', 'CONFIRMED', 'IN_PROGRESS', 'DONE']) {
        await db.query('UPDATE pms_test.appointments SET status=$2 WHERE id=$1', [first.id, status]);
        await page.reload();
        await page.getByText(/^Фильтры/).click();
        for (const [service, filterStatus] of [['', 'NO_SHOW'], [f.services[1].id, ''], [f.services[1].id, 'DONE']]) {
          await page.getByLabel('Услуга', { exact: true }).selectOption(service);
          await page.getByLabel('Статус записи', { exact: true }).selectOption(filterStatus);
          await expect(free('10:00')).toHaveCount(0);
          await expect(free('10:30')).toHaveCount(0);
          await expect(free('12:00')).toHaveCount(0);
          await expect(free('11:00')).toBeVisible();
        }
      }
      await db.query('UPDATE pms_test.appointments SET status=$2 WHERE id=$1', [first.id, 'BOOKED']);
      const rejected = await request.post(api + '/beauty/appointments', { headers: f.headers, data: { employeeId: f.employees[0].id, serviceId: f.services[0].id, startsAt: `${date}T10:00:00+05:00`, firstName: 'Тест конфликт' } });
      expect(rejected.status()).toBe(409);
      const after = (await db.query('SELECT * FROM pms_test.appointments WHERE id=$1', [first.id])).rows;
      expect(after).toEqual(before);
      const day = await (await request.get(api + `/beauty/appointments?date=${date}`, { headers: f.headers })).json();
      expect(day.appointments).toHaveLength(3);
      expect(day.appointments.map((a: { id: string }) => a.id)).toContain(first.id);
      mkdirSync(evidence + '/screenshots', { recursive: true });
      await page.screenshot({ path: `${evidence}/screenshots/f01-filtered-${width}-${theme}.png`, fullPage: true });
      await page.getByLabel('Услуга', { exact: true }).selectOption('');
      await page.getByLabel('Статус записи', { exact: true }).selectOption('');
      await chooseCalendarEmployee(page, 'Тест Борис');
      if (width === 390) await expect(page.locator('.employee-filter summary')).toContainText('Тест Борис');
      await expect(board.getByRole('button', { name: 'Тест Борис, 10:00, свободно', exact: true })).toHaveCount(0);
      await chooseCalendarEmployee(page, 'Тест Анна');
      await board.locator('.beauty-tile').filter({ hasText: 'Тест клиент' }).click();
      await expect(page.getByRole('dialog', { name: 'Запись', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Закрыть: Запись', exact: true }).click();
      await page.goto(`/appointments?date=${date}`);
      await page.getByRole('button', { name: 'Тест клиент', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Запись', exact: true })).toContainText('Тест стрижка');
      for (const status of ['CANCELLED', 'NO_SHOW']) {
        await db.query('UPDATE pms_test.appointments SET status=$2 WHERE id=$1', [first.id, status]);
        await page.goto(`/calendar?date=${date}`);
        await expect(free('10:00')).toBeAttached();
      }
      await page.goto(`/calendar?date=${nextDate}`);
      await expect(free('10:00')).toBeVisible();
      await page.context().addCookies([{ name: 'wetop_scope', value: encodeURIComponent(`business=${f.business};location=${f.locations[1]}`), domain: '127.0.0.1', path: '/' }]);
      await page.goto(`/calendar?date=${date}`);
      await expect(page.getByTestId('beauty-day-summary')).toContainText('Записей на этот день нет');
      writeFileSync(`${evidence}/f01-${width}-${theme}.json`, JSON.stringify({ id: first.id, before, after, count: day.appointments.length, conflictStatus: rejected.status() }, null, 2));
    } finally { await db.end(); }
  });
}
