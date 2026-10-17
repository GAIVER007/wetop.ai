import { test, expect } from '../ui/fixtures';
import pg from 'pg';
import { seed, date } from './tz11-helpers';

test('real PG delay shows inherited loading state rather than free empty grid', async ({ page, request }) => {
  await seed(page, request);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('BEGIN');
    await db.query('LOCK TABLE pms_test.appointments IN ACCESS EXCLUSIVE MODE');
    await page.goto(`/calendar?date=${date}`, { waitUntil: 'commit' });
    await expect(page.getByRole('main', { name: 'Загрузка страницы', exact: true })).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('beauty-grid')).toHaveCount(0);
  } finally {
    await db.query('ROLLBACK'); await db.end();
  }
  await expect(page.getByTestId('beauty-grid')).toBeVisible();
});
