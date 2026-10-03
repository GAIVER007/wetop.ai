import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';

/**
 * «Подключения → Подключение каналов» (`/connections/channex`). С 01.10 (89b2474) страница — настройка
 * соединения с менеджером каналов (`channels/connection-setup.tsx`) вместо экрана состояний INT2 (ADR-121):
 * соединение и сопоставление фактами, webhook словом, опасные команды настройки — только владельцу (ADR-112),
 * ключей и сырых ответов на странице нет. Вкладки ведут в модуль «Каналы продаж».
 */
const fixture = 'http://127.0.0.1:4311';

type Mode = 'ok' | 'webhook' | 'no-key';
const control = (page: Page, data: Record<string, unknown>) =>
  page.request.post(`${fixture}/__test/control`, { data, headers: { 'x-wetop-test-client': '1' } });

test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

/** Роль знает только оболочка вошедшего (ADR-083): без входа кнопки владельца не рисуются */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('владелец: соединение фактами, вкладки в «Каналы продаж», команды настройки, без ключей', async ({
  page,
}) => {
  await control(page, { channex: 'ok' satisfies Mode });
  await signIn(page);
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Подключение каналов');
  await expect(main.getByRole('link', { name: 'Подключения', exact: true })).toHaveAttribute(
    'href',
    '/connections',
  );
  const tabs = main.getByRole('navigation', { name: 'Настройка каналов' });
  for (const [name, href] of [
    ['Статистика продаж', '/channels'],
    ['Сопоставление категорий и тарифов', '/channels/mapping'],
    ['Очередь обмена', '/channels/sync'],
    ['События', '/channels/events'],
  ] as const)
    await expect(tabs.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  const connection = main.getByTestId('channel-connection');
  await expect(connection).toContainText('Соединение установлено');
  await expect(connection).toContainText('категорий 3, тарифов 3');
  await expect(connection).toContainText('Тестовая');
  for (const id of ['channel-setup', 'channel-webhook-register', 'channel-webhook-test'])
    await expect(main.getByTestId(id)).toBeVisible();
  await expect(main.getByTestId('channel-content-location')).toContainText(
    'Ключ менеджера каналов хранится только на сервере',
  );
  // ни ключей, ни сырых ответов API
  await expect(main).not.toContainText(/user-api-key|api_key|"errors"/i);
});

test('ключ не задан: соединение названо словами, а не «работает»', async ({ page }) => {
  await control(page, { channex: 'no-key' satisfies Mode });
  await signIn(page);
  await page.goto('/connections/channex');
  const connection = page.getByRole('main').getByTestId('channel-connection');
  await expect(connection).toContainText('Не задан ключ менеджера каналов');
  await expect(connection).not.toContainText('Соединение установлено');
});

test('webhook без постоянного адреса назван словами', async ({ page }) => {
  await signIn(page);
  await page.goto('/connections/channex');
  await expect(page.getByRole('main').getByTestId('webhook-state')).toHaveText('нет PUBLIC_API_URL');
});

test('управляющий видит состояние без команд настройки; сотруднику раздел закрыт', async ({
  page,
}) => {
  await control(page, { channex: 'ok' satisfies Mode, role: 'MANAGER' });
  await signIn(page);
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('channel-connection')).toContainText('Соединение установлено');
  await expect(main.getByTestId('channel-setup-owner-only')).toHaveText(
    'Настройку подключения меняет владелец организации.',
  );
  await expect(main.getByTestId('channel-setup')).toHaveCount(0);
  await control(page, { channex: 'ok' satisfies Mode, role: 'STAFF' });
  await page.goto('/connections/channex');
  await expect(main.getByTestId('no-access')).toBeVisible();
  await expect(main.getByTestId('channel-connection')).toHaveCount(0);
});

for (const theme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`доступность и ширина: ${theme}, ${width}px`, async ({ page }) => {
      await control(page, { channex: 'ok' satisfies Mode });
      await signIn(page);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/connections/channex');
      await expect(page.getByRole('main').getByTestId('channel-connection')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'страница шире экрана',
      ).toBe(true);
      const axe = await new AxeBuilder({ page }).include('main').analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
