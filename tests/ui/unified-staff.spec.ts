import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Общий экран «Сотрудники» салона (plans/unified-team-screen-2026-10-25.md, U2, решение владельца 25.10.2026, В1–В7
 * вариант А): карточка и вход одного человека одной строкой по `employees.user_id`, вход без карточки своей строкой,
 * приглашения строками, владелец первым; администратор видит только карточки; `/team` ведёт сюда.
 */
const SNAPSHOTS = 'reports/unified-team-2026-10-25';
const TEST_CLIENT = { 'x-wetop-test-client': '1' };
test.describe.configure({ timeout: 180_000 });

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия Айна');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Студия Айна', exact: true }).click();
  await page.waitForURL('**/today');
}

/** Юрий: карточка мастера и вход администратора (`ui-admin` стенда); Алия: карточка без входа */
async function seedPeople(request: APIRequestContext) {
  for (const data of [
    { name: 'Юрий Мастер', active: true, personnelKind: 'SPECIALIST', userId: 'ui-admin' },
    { name: 'Алия Без входа', active: true, personnelKind: 'SPECIALIST', email: 'aliya@example.invalid' },
  ]) {
    const response = await request.post(`${FIXTURE_API}/beauty/employees`, { headers: TEST_CLIENT, data });
    expect(response.ok()).toBe(true);
  }
}

const tablist = (page: Page) => page.getByRole('main').getByRole('tablist', { name: 'Назначение в персонале' });
const panel = (page: Page) => page.getByRole('main').getByRole('tabpanel');
const row = (page: Page, text: string) => panel(page).getByTestId('staff-row').filter({ hasText: text });

test('владелец: одна строка на человека, вход без карточки и приглашения строками', async ({ page, request }) => {
  await openSalon(page, request);
  await seedPeople(request);
  await page.goto('/employees');
  // 2 карточки (Юрий со входом), владелец, управляющий без карточки, два приглашения стенда
  await expect(tablist(page).getByRole('tab')).toHaveText([
    'Все6',
    'Специалисты2',
    'Другие сотрудники0',
    'С доступом3',
    'Ждут приглашения2',
  ]);
  const rows = panel(page).getByTestId('staff-row');
  await expect(rows).toHaveCount(6);
  // В4: владелец первой строкой
  await expect(rows.first().getByTestId('person-access')).toContainText('Владелец');
  // карточка и вход вместе: строки входа «Юрий Тестов» нет, должность меняется в строке карточки
  await expect(row(page, 'urij@example.com')).toHaveCount(0);
  await expect(row(page, 'Юрий Мастер').getByLabel('Должность: Юрий Тестов')).toHaveValue('STAFF');
  // В3: вход без карточки своей строкой
  await expect(row(page, 'Марат Тестов').getByLabel('Должность: Марат Тестов')).toHaveValue('MANAGER');
  await expect(row(page, 'Марат Тестов')).toContainText('Управляющий');
  // приглашение без карточки: строка с действиями приглашения
  const invited = row(page, 'zhdet@example.com');
  await expect(invited.getByTestId('person-access')).toHaveText('Ждёт ответа');
  // действия приглашения в «⋯» строки (27.10.2026: строка не шире экрана)
  await invited.getByRole('button', { name: 'Ещё: zhdet@example.com' }).click();
  await expect(page.getByRole('menuitem', { name: 'Отозвать' })).toBeVisible();
  await page.keyboard.press('Escape');
  // карточка без входа: «Без входа» и «Дать доступ»
  const aliya = row(page, 'Алия Без входа');
  await expect(aliya.getByTestId('person-access')).toHaveText('Без входа');
  await page.screenshot({ path: `${SNAPSHOTS}/employees-owner-1440-light.png`, fullPage: true });
  // один экран с компьютера (владелец 27.10.2026): таблица без прокрутки вбок на 1280
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const scroller of await page.getByRole('main').locator('.table-scroll').all())
    expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  if (process.env.STAFF_SHOTS) await page.screenshot({ path: `${process.env.STAFF_SHOTS}/employees-1280.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await aliya.getByRole('button', { name: 'Ещё: Алия Без входа' }).click();
  await page.getByRole('menuitem', { name: 'Дать доступ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Доступ в WETOP: Алия Без входа' });
  await expect(dialog.getByLabel('Почта')).toHaveValue('aliya@example.invalid');
  await expect(dialog.getByRole('radio', { name: /^Без входа/ })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Отправить приглашение', exact: true }).click();
  await expect(dialog).toBeHidden();
  // приглашение с карточкой ждёт на строке карточки, а не отдельной строкой
  await expect(row(page, 'Алия Без входа').getByTestId('person-access')).toHaveText('Ждёт ответа');
  await expect(row(page, 'aliya@example.invalid')).toHaveCount(0);
  await expect(tablist(page).getByRole('tab', { name: /^Ждут приглашения/ })).toHaveText('Ждут приглашения3');
});

test('«Сотрудники» салона: /team ведёт на общий экран, вкладка «Роли и права» рядом', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/team');
  await expect(page).toHaveURL(/\/employees$/);
  const tabs = page.getByRole('navigation', { name: 'Сотрудники и контроль' });
  await expect(tabs.getByRole('link', { name: 'Сотрудники' })).toHaveAttribute('aria-current', 'page');
  await expect(tabs.getByRole('link', { name: 'Роли и права' })).toHaveAttribute('href', '/team/roles');
  await expect(page.getByRole('main').getByTestId('team-invite').or(page.getByTestId('team-invite'))).toBeVisible();
});

test('администратор: только карточки, без колонки доступа и приглашений (В2)', async ({ page, request }) => {
  await openSalon(page, request);
  await seedPeople(request);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/employees');
  await expect(panel(page).getByTestId('staff-row')).toHaveCount(2);
  await expect(page.getByRole('main').getByRole('columnheader', { name: 'Доступ в WETOP' })).toHaveCount(0);
  await expect(page.getByTestId('team-invite')).toHaveCount(0);
  await expect(page.getByRole('main').getByText('Марат Тестов')).toHaveCount(0);
});

for (const [width, scheme] of [
  [1440, 'dark'],
  [390, 'light'],
] as const) {
  test(`axe и вид: ${width} px, тема ${scheme}`, async ({ page, request }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: scheme });
    await openSalon(page, request);
    await seedPeople(request);
    await page.goto('/employees');
    await expect(panel(page).getByTestId('staff-row')).toHaveCount(6);
    const result = await new AxeBuilder({ page }).include('main').analyze();
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(scroll).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SNAPSHOTS}/employees-owner-${width}-${scheme}.png`, fullPage: true });
  });
}
