import { expect, test, type Page } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Компания» и филиалы (Platform P3, ADR-130; план `plans/platform-p3-branches-2026-10-01.md`): владелец добавляет
 * филиал панелью (ошибка у поля, тёзка, 409 от API); «Открыть» в таблице ставит куку `wetop_scope` и меняет объект
 * стойки; управляющему кнопки нет, администратору раздел закрыт; сводка по филиалам с итогом; axe, темы, ширины.
 * Переключатель филиала в карточке объекта слева, из `main` (`shell/branch-switcher.tsx`), проверяет `branches.spec.ts`.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/platform-p3-branches-2026-10-01';
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('владелец добавляет филиал: ошибки у поля, тёзка, 409 от API', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/organization');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Компания' })).toBeVisible();
  await expect(main.getByTestId('company-branch')).toHaveCount(1);
  await expect(main.getByTestId('company-branch').first()).toContainText('Текущий');

  await main.getByTestId('branch-add').click();
  const dialog = page.getByRole('dialog', { name: 'Новый филиал' });
  await expect(dialog).toBeVisible();
  const name = dialog.getByLabel('Название филиала');
  await dialog.getByRole('button', { name: 'Создать филиал' }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toHaveText('Укажите название филиала');

  await name.fill('luxx aparts');
  await dialog.getByRole('button', { name: 'Создать филиал' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Филиал с таким названием уже есть');
  await expect(name).toHaveValue('luxx aparts');

  await name.fill('Luxx Astana');
  await dialog.getByLabel('Адрес').fill('Астана, пр. Мангилик Ел, 1');
  await dialog.getByRole('button', { name: 'Создать филиал' }).click();
  await expect(page.getByTestId('company-saved')).toContainText('Филиал «Luxx Astana» добавлен');
  await expect(main.getByTestId('company-branch')).toHaveCount(2);
  await expect(main.getByTestId('company-branch').nth(1)).toContainText('Luxx Astana');
  await expect(main.getByRole('button', { name: 'Открыть филиал Luxx Astana' })).toBeVisible();
});

test('выбор филиала: «Открыть» ставит куку, объект стойки и текущая строка меняются', async ({
  page,
  request,
  context,
}) => {
  await control(request, { branches: ['Luxx Astana'] });
  await signIn(page);
  await page.goto('/organization');
  const main = page.getByRole('main');
  await expect(main.getByTestId('company-branch')).toHaveCount(2);
  await main.getByRole('button', { name: 'Открыть филиал Luxx Astana' }).click();
  await expect(main.getByTestId('company-branch').nth(1)).toContainText('Текущий');
  const cookie = (await context.cookies()).find((c) => c.name === 'wetop_scope');
  // Next кодирует значение куки; стойка раскодирует его перед пересылкой (`scopeHeader`)
  expect(decodeURIComponent(cookie?.value ?? '')).toMatch(/^business=[0-9a-f-]{36};location=[0-9a-f-]{36}$/);
  // объект в шапке слева, объект выбранного филиала
  await expect(page.locator('.sidebar-shell .workspace-property strong')).toHaveText('Luxx Astana');
  // сводка подсвечивает текущий
  const rows = main.getByTestId('company-summary-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('(текущий)');

  // обратно, «Открыть» у первого
  await main.getByRole('button', { name: 'Открыть филиал Luxx Aparts' }).click();
  await expect(page.locator('.sidebar-shell .workspace-property strong')).toHaveText('Luxx Aparts');
  await expect(main.getByTestId('company-branch').first()).toContainText('Текущий');
});

test('сводка по филиалам: строки по каждому, итог суммой, готовые отрезки', async ({ page, request }) => {
  await control(request, { branches: ['Luxx Astana', 'Luxx Shymkent'] });
  await signIn(page);
  await page.goto('/organization?period=week');
  const main = page.getByRole('main');
  const summary = main.getByTestId('company-summary');
  await expect(summary).toBeVisible();
  await expect(main.getByTestId('company-summary-row')).toHaveCount(3);
  // 7 дней: филиалы 10/4, 20/8, 30/12 номеров и занятых, итог 24 из 60 = 40 %
  await expect(main.getByTestId('company-summary-row').nth(0)).toContainText('40 %');
  const total = main.getByTestId('company-total');
  await expect(total).toHaveCount(1);
  await expect(total).toContainText('Итого');
  await expect(total).toContainText('40 %');
  await expect(total).toContainText('168');
  await expect(summary.getByRole('link', { name: '7 дней' })).toHaveAttribute('aria-current', 'page');
  await expect(main.getByTestId('company-period')).toContainText('7 дней');
});

test('роли: управляющий видит без кнопки, администратору раздел закрыт, в «только чтении» кнопки нет', async ({
  page,
  request,
}) => {
  await control(request, { role: 'MANAGER' });
  await signIn(page);
  await page.goto('/organization');
  const main = page.getByRole('main');
  await expect(main.getByTestId('company-branches')).toBeVisible();
  await expect(main.getByTestId('branch-add')).toHaveCount(0);
  await expect(main.getByTestId('company-facts')).toContainText('Филиал добавляет владелец организации');

  await control(request, { role: 'STAFF' });
  await page.goto('/organization');
  await expect(page.getByRole('main').getByTestId('company-branches')).toHaveCount(0);
  await expect(page.getByRole('main')).toContainText('доступ');

  await control(request, { role: 'OWNER', orgTrialDays: 0 });
  await page.goto('/organization');
  await expect(page.getByRole('main').getByTestId('company-branches')).toBeVisible();
  await expect(page.getByRole('main').getByTestId('branch-add')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`доступность и снимки (${theme})`, async ({ page, request }) => {
    await control(request, { branches: ['Luxx Astana'] });
    await signIn(page);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/organization');
    await expect(page.getByRole('main').getByTestId('company-summary')).toBeVisible();
    const results = await new AxeBuilder({ page }).include('main').analyze();
    expect(results.violations).toEqual([]);
    mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `${SHOTS}/company-${theme}-1440.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/company-${theme}-390.png`, fullPage: true });
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(scroll).toBeLessThanOrEqual(0);
    await page.getByRole('main').getByTestId('branch-add').click();
    await expect(page.getByRole('dialog', { name: 'Новый филиал' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/company-${theme}-390-drawer.png` });
  });
}
