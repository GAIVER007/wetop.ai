import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/** Раздел «Каналы» (ADR-138): подключённые и все доступные каналы Channex, брони за 30 дней из WETOP */
const fixture = process.env.UI_FIXTURE_API ?? 'http://127.0.0.1:4311';
const headers = { 'x-wetop-test-client': '1' };
const control = (
  request: import('@playwright/test').APIRequestContext,
  data: Record<string, unknown>,
) => request.post(`${fixture}/__test/control`, { data, headers });
test.describe.configure({ mode: 'serial' });
/** Роль читается из `/auth/me`: кнопки окна Channex видит только вошедший владелец */
async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`, { headers });
});

test('вкладка «Каналы»: подключённые с ID, названием, бронями за 30 дней и честным статусом', async ({
  page,
}) => {
  await page.goto('/channels/list');
  const tabs = page.getByRole('navigation', { name: 'Каналы продаж' });
  await expect(tabs.getByRole('link', { name: 'Каналы', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const sub = page.getByRole('navigation', { name: 'Каналы', exact: true });
  await expect(sub.getByRole('link', { name: /Подключённые\s*5/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const rows = page.getByTestId('channel-row');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(1)).toContainText('Booking.com');
  await expect(rows.nth(1)).toContainText('14087887');
  await expect(rows.nth(1)).toContainText('169');
  await expect(rows.nth(1).getByTestId('channel-status')).toHaveText('Работает');
  await expect(rows.filter({ hasText: 'Agoda' }).getByTestId('channel-status')).toHaveText(
    'Ошибки броней',
  );
  await expect(rows.filter({ hasText: 'Hostelworld' }).getByTestId('channel-status')).toHaveText(
    'Включён',
  );
  await expect(rows.filter({ hasText: 'Expedia' }).getByTestId('channel-status')).toHaveText(
    'Удаляется 20.10',
  );
  await expect(page.getByTestId('channel-outside-row').first()).toContainText('OneTwoTrip');
  await expect(page.getByTestId('channel-list-staging')).toBeVisible();
  // приём броней виден целиком: когда пришла последняя и сколько не принято
  await expect(page.getByTestId('channel-inbound')).toContainText('Последняя получена');
  await expect(page.getByTestId('channel-inbound-failed')).toContainText('за 7 дней: 2');
  await expect(
    page.getByTestId('channel-inbound-failed').getByRole('link', { name: 'Разобрать' }),
  ).toHaveAttribute('href', '/channels/events?status=FAILED');
});

test('поиск сужает список; «Все доступные» — каталог Channex с отметкой подключённых', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/channels/list?q=1408');
  await expect(page.getByTestId('channel-row')).toHaveCount(1);
  await page.goto('/channels/list?view=available');
  const rows = page.getByTestId('channel-adapter-row');
  await expect(rows).toHaveCount(7);
  await expect(rows.filter({ hasText: 'Booking.com' })).toContainText('Подключён');
  await expect(
    rows.filter({ hasText: 'Airbnb' }).getByTestId('channel-adapter-connect'),
  ).toBeVisible();
});

test('владелец открывает окно Channex; после «Готово» окно закрывается', async ({ page }) => {
  await signIn(page);
  await page.goto('/channels/list');
  await page.getByTestId('channel-connect').click();
  const dialog = page.getByRole('dialog', { name: 'Менеджер каналов' });
  await expect(dialog.getByTestId('channex-frame')).toBeVisible();
  await dialog.getByRole('button', { name: 'Готово' }).click();
  await expect(dialog).toBeHidden();
});

test('управляющий видит каналы, но не подключает: окно Channex только у владельца', async ({
  page,
  request,
}) => {
  await control(request, { role: 'MANAGER' });
  await signIn(page);
  await page.goto('/channels/list');
  await expect(page.getByTestId('channel-row')).toHaveCount(5);
  await expect(page.getByTestId('channel-connect')).toHaveCount(0);
  await page.goto('/channels/list?view=available');
  await expect(page.getByTestId('channel-adapter-connect')).toHaveCount(0);
});

test('Channex не ответил: причина словами, брони мимо подключений видны', async ({
  page,
  request,
}) => {
  await control(request, { channelCatalog: 'down' });
  await signIn(page);
  await page.goto('/channels/list');
  await expect(page.getByTestId('channel-list-state')).toContainText('не ответил');
  await expect(page.getByTestId('channel-outside-row')).toHaveCount(3);
  await expect(page.getByTestId('channel-connect')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность и снимок: ${theme}, ${width}px`, async ({ page }) => {
      await signIn(page);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/channels/list');
      await expect(page.getByTestId('channel-row')).toHaveCount(5);
      await page.screenshot({
        path: `reports/channels-catalog-2026-10-03/connected-${theme}-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(
        axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });

test('снимок «Все доступные» и окна Channex', async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/channels/list?view=available');
  await page.screenshot({
    path: 'reports/channels-catalog-2026-10-03/available-light-1440.png',
    fullPage: true,
  });
  await page.goto('/channels/list');
  await page.getByTestId('channel-connect').click();
  await expect(page.getByTestId('channex-frame')).toBeVisible();
  await page.screenshot({ path: 'reports/channels-catalog-2026-10-03/window-light-1440.png' });
});
