import { expect, test, devNoise, type Page } from './fixtures';
import type { APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * «Производный тариф» и «Промокоды» (DATA_MODEL §20, ADR-128, срез D4; решения владельца 29.09: Q-233, Q-230, Q-231).
 * Вкладка «Тарифные планы» получает «Добавить производный тариф» и колонку условий словами; вкладка «Промокоды» —
 * таблицу, добавление и выключение. Ошибки — словами у формы, «только чтение» — без кнопок. Стенд — подставной API.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/direct-sales-d4-2026-09-29';
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

test('производный тариф: добавить, условия словами, ошибка у формы, правка процента', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/rates/plans');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить производный тариф' }).click();
  const drawer = page.getByRole('dialog', { name: 'Новый производный тариф' });
  await drawer.getByLabel('Название').fill('Раннее бронирование');
  await drawer.getByLabel('Родительский тариф').selectOption({ label: 'Стандартный' });
  await drawer.getByLabel('Скидка, %').fill('0');
  await drawer.getByRole('button', { name: 'Сохранить' }).click();
  await expect(drawer.getByRole('alert')).toContainText('от 1 до 90');
  await drawer.getByLabel('Скидка, %').fill('15');
  await drawer.getByLabel('Заезд не раньше чем за, дн.').fill('30');
  await drawer.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const row = planRow(page, 'Раннее бронирование');
  await expect(row).toContainText('−15% от «Стандартный»; заезд не раньше чем за 30 дн.');
  // у обычного тарифа условий нет
  await expect(planRow(page, 'Стандартный').first()).toContainText('—');

  await main
    .getByTestId('rate-plans-table')
    .getByRole('button', { name: 'Раннее бронирование' })
    .click();
  const edit = page.getByRole('dialog', { name: 'Раннее бронирование' });
  await edit.getByLabel('Скидка, %').fill('20');
  await edit.getByRole('button', { name: 'Сохранить условия' }).click();
  await expect(row).toContainText('−20% от «Стандартный»');
});

test('промокоды: вкладка, добавить, повтор кода — ошибка, выключить', async ({ page }) => {
  await signIn(page);
  await page.goto('/rates/plans');
  const main = page.getByRole('main');
  const tabs = main.getByRole('navigation', { name: 'Тарифы и цены' });
  await tabs.getByRole('link', { name: 'Промокоды' }).click();
  await expect(page).toHaveURL(/\/rates\/promo$/);
  await expect(tabs.getByRole('link', { name: 'Промокоды' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await main.getByRole('button', { name: 'Добавить промокод' }).click();
  const drawer = page.getByRole('dialog', { name: 'Новый промокод' });
  await drawer.getByLabel('Код', { exact: true }).fill('summer10');
  await drawer.getByLabel('Скидка, %').fill('10');
  await drawer.getByLabel('Использований не больше').fill('5');
  await drawer.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const table = main.getByTestId('promo-table');
  const row = table.getByRole('row', { name: /SUMMER10/ });
  await expect(row).toContainText('10%');
  await expect(row).toContainText('0 из 5');
  await expect(row).toContainText('действует');

  await main.getByRole('button', { name: 'Добавить промокод' }).click();
  const again = page.getByRole('dialog', { name: 'Новый промокод' });
  await again.getByLabel('Код', { exact: true }).fill('SUMMER10');
  await again.getByLabel('Скидка, %').fill('5');
  await again.getByRole('button', { name: 'Сохранить' }).click();
  await expect(again.getByRole('alert')).toContainText('уже есть');
  await page.keyboard.press('Escape');

  await row.getByRole('button', { name: 'Выключить' }).click();
  await expect(row).toContainText('не действует');
  await expect(row.getByRole('button', { name: 'Включить' })).toBeVisible();
});

test('«только чтение»: производные тарифы и промокоды видны, кнопок правки нет', async ({
  page,
  request,
}) => {
  await signIn(page);
  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/rates/plans');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Добавить производный тариф' })).toHaveCount(0);
  await page.goto('/rates/promo');
  await expect(page.getByRole('button', { name: 'Добавить промокод' })).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки D4 и доступность: ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
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
    await main.getByRole('button', { name: 'Добавить производный тариф' }).click();
    const drawer = page.getByRole('dialog', { name: 'Новый производный тариф' });
    await drawer.getByLabel('Название').fill('Раннее бронирование');
    await drawer.getByLabel('Родительский тариф').selectOption({ label: 'Стандартный' });
    await drawer.getByLabel('Скидка, %').fill('15');
    await drawer.getByLabel('Заезд не раньше чем за, дн.').fill('30');
    await axe();
    await shot('derived-form');
    await drawer.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await axe();
    await shot('rate-plans-derived');

    await page.goto('/rates/promo');
    await main.getByRole('button', { name: 'Добавить промокод' }).click();
    const promo = page.getByRole('dialog', { name: 'Новый промокод' });
    await promo.getByLabel('Код', { exact: true }).fill('SUMMER10');
    await promo.getByLabel('Скидка, %').fill('10');
    await promo.getByLabel('Проживание с').fill('2026-11-01');
    await promo.getByLabel('Проживание по').fill('2026-11-30');
    await axe();
    await shot('promo-form');
    await promo.getByRole('button', { name: 'Сохранить' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await axe();
    await shot('promo-table');
    expect(errors).toEqual([]);
  });
}
