import { expect, test, type Page } from './fixtures';

/**
 * Чат ИИ-помощника в стойке (ТЗ ред. 1, П2; docs/assistant/README.md §1), браузер → `next dev` → синтетический
 * API и подставной помощник (`tests/ui/fake-assistant.ts`). Стенд — `tests/ui/playwright.assistant.config.ts`.
 *
 * Сотрудник и пароль — вымышленные, из фикстуры интерфейса (ADR-010).
 */
const API = 'http://127.0.0.1:4314';
const WIDGET_SRC = 'http://127.0.0.1:4316/widget/widget.js?v=20260930-support';
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

/** С какой подписью загрузился виджет на этой странице: подставной помощник кладёт её в window */
async function widgetIdentity(page: Page): Promise<string> {
  await page.waitForFunction('window.__assistantWidget !== undefined');
  return page.evaluate('window.__assistantWidget.identity') as Promise<string>;
}

/** Поля подписи — как их разбирает бот: base64url → строка через «|» */
function fields(token: string): string[] {
  return Buffer.from(token.split('.')[0]!, 'base64url').toString('utf8').split('|');
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
}

test('на публичном экране входа виджет не загружается', async ({ page }) => {
  await page.goto('/auth/fallback');
  await expect(page.locator(`script[src="${WIDGET_SRC}"]`)).toHaveCount(0);
  await expect(page.locator('.pmsw')).toHaveCount(0);
});

test('после входа виджет загружен с подписью вошедшего; переходы по стойке его не перезагружают', async ({
  page,
}) => {
  await signIn(page);
  // вход — мягкий переход: сторож смены вошедшего перезагружает страницу один раз, и виджет встаёт с подписью
  await expect.poll(() => widgetIdentity(page)).not.toBe('');
  const identity = await widgetIdentity(page);
  const [userId, email, organizationId, role, issuedAt] = fields(identity);
  expect({ userId, email, organizationId, role }).toEqual({
    userId: 'ui-user',
    email: EMAIL,
    organizationId: 'ui-org',
    // роль в организации (ADR-083): вошедший стенда — владелец
    role: 'owner',
  });
  expect(Math.abs(Number(issuedAt) - Date.now() / 1000)).toBeLessThan(600);
  // подпись — в атрибуте тега, а не в адресе: адреса оседают в журналах (ТЗ §6)
  const tag = page.locator(`script[src="${WIDGET_SRC}"]`);
  await expect(tag).toHaveAttribute('data-identity', identity);

  await page.evaluate('window.__samePage = true');
  await page.getByRole('link', { name: 'Календарь' }).first().click();
  await expect(page).toHaveURL(/\/chessboard/);
  expect(await page.evaluate('window.__samePage === true')).toBe(true);
  expect(await page.evaluate('window.__assistantWidget.loads')).toBe(1);
});

test('после «Выйти» виджет прежнего человека на странице не остаётся', async ({ page }) => {
  await signIn(page);
  await expect.poll(() => widgetIdentity(page)).not.toBe('');

  await page.getByRole('button', { name: 'Меню администратора' }).click();
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/?next=%2Ftoday#login');
  await expect(page.locator('.pmsw')).toHaveCount(0);
  await expect(page.locator(`script[src="${WIDGET_SRC}"]`)).toHaveCount(0);
  await expect.poll(() => page.evaluate('typeof window.__assistantWidget')).toBe('undefined');
});

test('на телефоне пузырь чата стоит над нижней навигацией, а не на ней', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  const bubble = page.locator('.pmsw-b');
  const nav = page.locator('.bottom-navigation');
  await expect(bubble).toBeVisible();
  await expect(nav).toBeVisible();
  const b = (await bubble.boundingBox())!;
  const n = (await nav.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(n.y);
});
