import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const API = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

test('контроль: поиск и чипы открытых неисправностей не меняют сводку и не повторяют API', async ({
  page,
  request,
}) => {
  // 21.09: два выпадающих списка отбора заменены чипами-счётчиками — отбор по-прежнему в браузере,
  // и ни один чип не идёт за списком в API заново (сводка сторожа читается один раз на загрузку)
  await request.post(`${API}/__test/control`, { data: { incidentsMix: true } });
  await page.goto('/incidents');
  await expect(page.getByTestId('incident-row')).toHaveCount(4);
  const before = await (await request.get(`${API}/__test/hits`)).json();
  await page.getByLabel('Поиск неисправности').fill('не существует');
  await expect(page.getByTestId('incidents-filter-empty')).toBeVisible();
  await expect(page.getByTestId('incidents-open')).toHaveText('4');
  await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await page.getByRole('button', { name: 'Срочные 1' }).click();
  await expect(page.getByTestId('incident-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Принятые 1' }).click();
  await expect(page.getByTestId('incident-status')).toHaveText('принято');
  await page.getByRole('button', { name: 'Все 4' }).click();
  await expect(page.getByTestId('incident-row')).toHaveCount(4);
  const after = await (await request.get(`${API}/__test/hits`)).json();
  expect(after.byPath['/guard/incidents']).toBe(before.byPath['/guard/incidents']);
});

test('контроль: принятие с ошибкой и повтором, закрытие и история сохраняются после reload', async ({
  page,
  request,
}) => {
  await page.goto('/incidents');
  await request.post(`${API}/__test/control`, {
    data: { failPath: '/guard/incidents/ui-incident/acknowledge' },
  });
  await page.getByTestId('incident-acknowledge').click();
  await expect(page.getByTestId('incident-row').getByRole('alert')).toBeVisible();
  await request.post(`${API}/__test/control`, { data: {} });
  await page.getByTestId('incident-acknowledge').click();
  await expect(page.getByTestId('incident-status')).toHaveText('принято');
  await page.reload();
  await expect(page.getByTestId('incident-status')).toHaveText('принято');
  await page.getByTestId('incident-resolve').click();
  await expect(page.getByTestId('incidents-empty')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('incidents-closed')).toContainText(
    'Тестовая бронь без назначенной ячейки',
  );
});

test('контроль: поиск журнала и переходы доступны до окончания медленного запроса', async ({
  page,
  request,
}) => {
  await page.goto('/journal');
  await expect(page.getByTestId('journal-row').first()).toBeVisible();
  await request.post(`${API}/__test/control`, { data: { delayPath: '/audit', delayMs: 5000 } });
  const start = performance.now();
  await page.goto('/journal?q=TEST', { waitUntil: 'commit' });
  await expect(page.getByLabel('Поиск в журнале')).toBeVisible({ timeout: 1500 });
  console.log(`CONTROL_JOURNAL_CONTROLS_MS ${Math.round(performance.now() - start)}`);
  await expect(page.getByTestId('journal-loading')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Контроль', exact: true })).toBeVisible();
  await expect(page.getByTestId('journal-row')).toHaveCount(1);
  await page.getByRole('link', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await request.post(`${API}/__test/control`, { data: {} });
  await page
    .getByRole('navigation', { name: 'Контроль', exact: true })
    .getByRole('link', { name: 'Неисправности', exact: true })
    .click();
  await expect(page).toHaveURL(/\/incidents$/);
  await expect(page.getByTestId('incident-row')).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  test(`контроль: мобильный вид, клавиатура и доступность ${theme}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    mkdirSync('reports/control-design-2026-09-21', { recursive: true });
    for (const route of ['/incidents', '/journal']) {
      await page.goto(route);
      const main = page.getByRole('main');
      await expect(main.getByRole('navigation', { name: 'Контроль', exact: true })).toBeVisible();
      await expect(main.locator('[data-testid$="loading"]')).toHaveCount(0);
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const audit = await new AxeBuilder({ page })
          .include('main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        await main.screenshot({
          path: `reports/control-design-2026-09-21/${route.slice(1)}-${theme}-${width}.png`,
        });
      }
    }
  });
}
