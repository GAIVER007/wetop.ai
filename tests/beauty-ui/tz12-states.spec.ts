import { test, expect } from '../ui/fixtures';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { writeFileSync } from 'node:fs';
import { seed, date, evidence } from './tz11-helpers';

test('calendar outside schedule has a visible non-color state', async ({ page, request }) => {
  await seed(page, request);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/calendar?date=${date}`);
  await expect(
    page.getByTestId('beauty-mobile-calendar').getByText('Вне графика', { exact: true }).first(),
  ).toBeVisible();
});

test('empty one dense no result and real API error remain distinct', async ({ page, request }) => {
  const f = await seed(page, request);
  await page.goto(`/calendar?date=${date}`);
  await expect(page.getByTestId('beauty-day-summary')).toContainText('Записей на этот день нет');
  await f.book('10:00');
  await page.reload();
  await expect(page.getByTestId('beauty-day-summary')).toHaveText('Записей: 1');
  // единая шапка: на компьютере статус в строке отборов, на телефоне в «Фильтрах»
  await page.getByLabel('Статус записи', { exact: true }).selectOption('DONE');
  await expect(page.getByTestId('beauty-day-summary')).toContainText('По выбранным фильтрам');
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('UPDATE pms_test.locations SET timezone=$1 WHERE id=$2', [
      'Invalid/SyntheticZone',
      f.locations[0],
    ]);
    await page.reload();
    await expect(page.getByTestId('beauty-journal-error')).toBeVisible();
    await expect(page.getByTestId('beauty-day-summary')).toHaveCount(0);
  } finally {
    await db.query('UPDATE pms_test.locations SET timezone=$1 WHERE id=$2', [
      'Asia/Almaty',
      f.locations[0],
    ]);
    await db.end();
  }
});

for (const theme of ['light', 'dark'] as const)
  test(`keyboard focus labels contrast and mobile targets ${theme}`, async ({ page, request }) => {
    await seed(page, request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const results: object[] = [];
    for (const route of ['calendar', 'appointments']) {
      await page.goto(`/${route}?date=${date}`);
      if (route === 'calendar') {
        const timeline = await new AxeBuilder({ page }).include('[data-testid="beauty-mobile-calendar"]').withTags(['wcag2aa']).analyze();
        expect(timeline.violations).toEqual([]);
      }
      const create = page.getByRole('button', { name: 'Новая запись', exact: true });
      const box = (await create.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      await create.focus();
      await page.keyboard.press('Enter');
      const editor = page.getByRole('dialog', { name: 'Новая запись', exact: true });
      await expect(editor).toBeVisible();
      await editor.getByLabel('Телефон или имя', { exact: true }).focus();
      const focus = await editor
        .getByLabel('Телефон или имя', { exact: true })
        .evaluate((el) => ({
          matches: el.matches(':focus-visible'),
          outline: getComputedStyle(el).outlineStyle,
        }));
      expect(focus.matches).toBeTruthy();
      expect(focus.outline).not.toBe('none');
      const axe = await new AxeBuilder({ page })
        .include('.appointment-editor[open]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      await editor.getByLabel('Заметка', { exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(editor.getByRole('button', { name: 'Записать', exact: true })).toBeFocused();
      results.push({ route, theme, createTarget: box, focus, violations: axe.violations });
      await page.keyboard.press('Escape');
      await expect(editor).toBeHidden();
      await expect(create).toBeFocused();
    }
    writeFileSync(`${evidence}/accessibility-${theme}.json`, JSON.stringify(results, null, 2));
  });
