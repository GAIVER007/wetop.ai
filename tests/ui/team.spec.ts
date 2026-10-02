import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test, devNoise } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * «Сотрудники» (TEAM1, план `plans/settings-hub-2026-10-02.md`): команда организации — видимый раздел
 * в группе «Настройки», а не секция в профиле. Таблица людей с ролями, датой входа в организацию и
 * «Был в системе» (`lastLoginAt`); приглашение — панелью из шапки; «Отключить» — только через
 * подтверждение. Права прежние (ADR-107): видят владелец и управляющий, администратору — гейт.
 */
const API = 'http://127.0.0.1:4311';
const SHOTS = 'reports/team-2026-10-02';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

const asRole = (request: APIRequestContext, role: 'OWNER' | 'MANAGER' | 'STAFF') =>
  request.post(`${API}/__test/control`, { data: { role } });

test('владелец: таблица людей с ролями и датами, пункт «Сотрудники» в меню', async ({ page }) => {
  await signIn(page);
  await page.goto('/team');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Сотрудники');
  const rows = main.getByTestId('member-row');
  await expect(rows).toHaveCount(3);
  // вошедший владелец — первым, с отметкой «это вы»
  await expect(rows.nth(0)).toContainText('это вы');
  await expect(rows.nth(1)).toContainText('Марат Тестов');
  await expect(rows.nth(1)).toContainText('управляющий');
  // «Был в системе» — дата последнего входа (формат displayDate); не входил — слова, а не прочерк
  await expect(rows.nth(1)).toContainText('28 сент.');
  await expect(rows.nth(2)).toContainText('ещё не входил');
  // в меню группа «Настройки» ведёт сюда
  await expect(page.locator('.workspace-sidebar a[href="/team"]')).toBeVisible();
});

test('приглашение — панелью из шапки: почта, роль, строка в «Ожидают ответа»', async ({ page }) => {
  await signIn(page);
  await page.goto('/team');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Пригласить сотрудника' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('heading', { name: 'Пригласить сотрудника' })).toBeVisible();
  await drawer.getByLabel('Почта приглашённого').fill('novyj-admin@example.com');
  await drawer.getByLabel('Роль приглашённого', { exact: true }).selectOption('MANAGER');
  await drawer.getByRole('button', { name: 'Отправить приглашение' }).click();
  // панель закрылась, приглашение видно в списке ожидающих
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const invites = main.getByTestId('invite-list');
  await expect(invites).toContainText('novyj-admin@example.com');
  await expect(invites).toContainText('управляющий');
});

test('ошибка приглашения — словами в панели, ввод не стирается', async ({ page }) => {
  await signIn(page);
  await page.goto('/team');
  await page.getByRole('main').getByRole('button', { name: 'Пригласить сотрудника' }).click();
  const drawer = page.getByRole('dialog');
  // этот человек уже в организации — подставной API отвечает отказом словами
  await drawer.getByLabel('Почта приглашённого').fill('urij@example.com');
  await drawer.getByRole('button', { name: 'Отправить приглашение' }).click();
  await expect(drawer.getByRole('alert')).toContainText('уже в организации');
  await expect(drawer.getByLabel('Почта приглашённого')).toHaveValue('urij@example.com');
});

test('«Отключить» — только после подтверждения с последствием', async ({ page }) => {
  await signIn(page);
  await page.goto('/team');
  const main = page.getByRole('main');
  const rows = main.getByTestId('member-row');
  await rows.nth(2).getByRole('button', { name: 'Отключить' }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('потеряет доступ');
  await confirm.getByRole('button', { name: 'Отключить' }).click();
  await expect(rows).toHaveCount(2);
});

test('управляющий: роль не меняет, приглашает только администраторов', async ({ page, request }) => {
  await signIn(page);
  await asRole(request, 'MANAGER');
  await page.goto('/team');
  const main = page.getByRole('main');
  await expect(main.getByTestId('member-row')).toHaveCount(3);
  await expect(main.getByRole('combobox', { name: /^Роль:/ })).toHaveCount(0);
  await main.getByRole('button', { name: 'Пригласить сотрудника' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByTestId('invite-role-fixed')).toContainText('приглашает администраторов');
});

// red — лог соседней сессии …13-16-35Z-e2e-49c1.log: /team уводил на вход и ронял «все пункты меню»
test('без сессии страница не уводит на вход: открыта, команда закрыта словами (ADR-107)', async ({
  page,
}) => {
  await page.goto('/team');
  await expect(page).toHaveURL(/\/team$/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Сотрудники');
  await expect(main).toContainText('владелец и управляющий');
  await expect(main.getByRole('button', { name: 'Пригласить сотрудника' })).toHaveCount(0);
});

test('администратору раздел закрыт: гейт и меню без пункта', async ({ page, request }) => {
  await signIn(page);
  await asRole(request, 'STAFF');
  await page.goto('/team');
  await expect(page.getByRole('main')).toContainText('Нет доступа');
  await expect(page.locator('.workspace-sidebar a[href="/team"]')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки TEAM1 и доступность: ${theme}`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await signIn(page);
    mkdirSync(SHOTS, { recursive: true });
    const main = page.getByRole('main');
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
    await page.goto('/team');
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Сотрудники');
    const audit = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await shot('team');
    await main.getByRole('button', { name: 'Пригласить сотрудника' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const drawerAudit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(drawerAudit.violations).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/invite-${theme}-1440.png` });
    expect(errors).toEqual([]);
  });
}
