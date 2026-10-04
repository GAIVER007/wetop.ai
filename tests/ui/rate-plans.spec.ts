import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Тарифные планы» (SET4, `plans/property-settings-set4-2026-09-29.md`, дополнение 29.09 к ADR-115): правило отмены
 * живёт у тарифа, а не в настройках. Вкладка «Тарифов и цен» — таблица тарифов с правилом словами, без кодов; правку
 * делает панель, которая называет, сколько будущих броней она заденет (правило действует и для них — решение
 * владельца 29.09). Строки правила на «Ценах» больше нет. Стенд — подставной API с тем же разбором, что у API.
 */
const API = FIXTURE_API;
const SHOTS = 'reports/property-settings-set4-2026-09-29';
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
const planRow = (page: Page, name: string) =>
  page.getByTestId('rate-plans-table').getByRole('row', { name: new RegExp(name) });

test('вкладки «Цены | Тарифные планы»: правило словами у тарифа, кодов нет, на «Ценах» строки правила нет', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/rates');
  const main = page.getByRole('main');
  const tabs = main.getByRole('navigation', { name: 'Тарифы и цены' });
  await expect(tabs.getByRole('link', { name: 'Цены' })).toHaveAttribute('aria-current', 'page');
  await expect(main).not.toContainText('При отмене по тарифу');

  await tabs.getByRole('link', { name: 'Тарифные планы' }).click();
  await expect(page).toHaveURL(/\/rates\/plans$/);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Тарифы и цены');
  await expect(tabs.getByRole('link', { name: 'Тарифные планы' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const row = planRow(page, 'Стандартный');
  await expect(row).toContainText('Стоимость первой ночи');
  await expect(row).toContainText('действует');
  await expect(main.getByTestId('rate-plans-table')).not.toContainText('BASE');
});

test('правка правила: панель называет затронутые брони, «Сохранить» ждёт другого выбора, правило сохраняется', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/rates/plans');
  const main = page.getByRole('main');
  const ahead = Number(await planRow(page, 'Стандартный').locator('td.num').innerText());
  expect(ahead).toBeGreaterThan(0);

  await main.getByTestId('rate-plans-table').getByRole('button', { name: 'Стандартный' }).click();
  const drawer = page.getByRole('dialog', { name: 'Стандартный' });
  const save = drawer.getByRole('button', { name: 'Сохранить' });
  await expect(drawer.getByRole('radio', { name: /Стоимость первой ночи/ })).toBeChecked();
  await expect(save).toBeDisabled();
  await expect(drawer.getByTestId('rate-plan-affected')).toContainText(
    `Правило действует и для уже принятых броней: по тарифу ${ahead} будущ`,
  );

  await drawer.getByRole('radio', { name: /Без штрафа/ }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(main.getByTestId('rate-plan-saved')).toHaveText(
    '✓ Правило тарифа «Стандартный» сохранено',
  );
  await expect(planRow(page, 'Стандартный')).toContainText('Без штрафа');
  await page.reload();
  await expect(planRow(page, 'Стандартный')).toContainText('Без штрафа');
});

test('тариф без будущих броней: панель говорит, что правило коснётся новых', async ({
  page,
  request,
}) => {
  await control(request, { softPlan: true });
  await signIn(page);
  await page.goto('/rates/plans');
  const main = page.getByRole('main');
  await expect(planRow(page, 'Гибкий без штрафа')).toContainText('Без штрафа');
  await main
    .getByTestId('rate-plans-table')
    .getByRole('button', { name: 'Гибкий без штрафа' })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Гибкий без штрафа' }).getByTestId('rate-plan-affected'),
  ).toHaveText('Будущих броней по тарифу нет — правило коснётся новых.');
});

test('«только чтение»: тарифы и правила видны, править нельзя', async ({ page, request }) => {
  await signIn(page);
  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/rates/plans');
  const main = page.getByRole('main');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(planRow(page, 'Стандартный')).toContainText('Стоимость первой ночи');
  await expect(main.getByTestId('rate-plans-table').getByRole('button')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки SET4 и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await control(request, { softPlan: true });
    await signIn(page);
    mkdirSync(SHOTS, { recursive: true });
    const main = page.getByRole('main');
    const axe = async () => {
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
    };
    const shot = async (name: string) => {
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: `${SHOTS}/${name}-${theme}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
    };

    await page.goto('/rates/plans');
    await expect(main.getByTestId('rate-plans-table')).toBeVisible();
    await axe();
    await shot('rate-plans');

    await main.getByTestId('rate-plans-table').getByRole('button', { name: 'Стандартный' }).click();
    const drawer = page.getByRole('dialog', { name: 'Стандартный' });
    await drawer.getByRole('radio', { name: /Стоимость всего проживания/ }).check();
    await expect(drawer.getByTestId('rate-plan-affected')).toBeVisible();
    await axe();
    await shot('rate-plan-edit');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goto('/rates');
    await expect(main.getByRole('navigation', { name: 'Тарифы и цены' })).toBeVisible();
    await shot('rates-prices-tabs');

    await control(request, { orgTrialDays: 'ended' });
    await page.goto('/rates/plans');
    await expect(page.getByTestId('read-only-banner')).toBeVisible();
    await shot('rate-plans-read-only');
    expect(errors).toEqual([]);
  });
}
