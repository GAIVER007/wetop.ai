import { expect, test, type Page, FIXTURE_API } from './fixtures';

/**
 * «Подключения → Подключение каналов» (`/connections/channex`). Страница INT2 (ADR-121: бейдж состояния, причины,
 * технические детали, «Проверить соединение») заменена 01.10.2026 единой настройкой подключения
 * `ChannelConnectionSetup` (DECISIONS.md, «Меню по рабочим задачам», план `plans/workspace-order-2026-10-01.md`);
 * спек переписан 03.10 под неё. Состояния «устарело», «webhook не отвечает», «не подключено» проверяет карточка на
 * `/connections` (`integrations.spec.ts`); кнопки настройки по ролям — `channex-screens.spec.ts`.
 */
const fixture = FIXTURE_API;
const control = (page: Page, data: Record<string, unknown>) =>
  page.request.post(`${fixture}/__test/control`, { data });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('из «Подключений»: соединение, webhook и вкладки настройки, без ключа', async ({ page }) => {
  await control(page, { channex: 'ok' });
  await signIn(page);
  await page.goto('/connections');
  await page
    .getByRole('main')
    .getByTestId('integration-channex')
    .getByRole('link', { name: 'Настройки' })
    .click();
  await expect(page).toHaveURL(/\/connections\/channex$/);
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
  ])
    await expect(tabs.getByRole('link', { name })).toHaveAttribute('href', href);
  const connection = main.getByTestId('channel-connection');
  await expect(connection).toContainText('Соединение установлено');
  await expect(connection).toContainText('ui-property');
  await expect(connection).toContainText('категорий 3, тарифов 3');
  await expect(main.getByTestId('channel-webhook')).toBeVisible();
  await expect(main.getByTestId('channel-setup')).toBeVisible();
  for (const text of ['API key', 'apiKey', 'secret']) await expect(main).not.toContainText(text);
});

test('ключ не задан: причина словами', async ({ page }) => {
  await control(page, { channex: 'no-key' });
  await page.goto('/connections/channex');
  await expect(page.getByTestId('channel-connection')).toContainText(
    'Не задан ключ менеджера каналов',
  );
});

// 03.10.2026: экраны ожидания остались с прежними названиями («Интеграции», «Менеджер каналов»), и заголовок
// менялся на глазах, когда приходила страница
for (const [route, loading, title] of [
  ['/connections', 'connections-loading', 'Подключения'],
  ['/connections/channex', 'channex-loading', 'Подключение каналов'],
] as const)
  test(`${route}: пока соединение проверяется, заголовок тот же, что у страницы`, async ({
    page,
  }) => {
    await control(page, { delayPath: '/channels/channex/connection', delayMs: 8000 });
    await page.goto(route, { waitUntil: 'commit' });
    await expect(page.getByTestId(loading)).toBeVisible({ timeout: 30_000 });
    // заголовок ищем в той же разметке, что и экран ожидания: настоящая страница его не подменит
    const waiting = page.getByRole('main').filter({ has: page.getByTestId(loading) });
    await expect(waiting.getByRole('heading', { level: 1 })).toHaveText(title, { timeout: 2000 });
  });

test('телефон: страница без прокрутки вбок', async ({ page }) => {
  await control(page, { channex: 'ok' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections/channex');
  await expect(page.getByTestId('channel-connection')).toBeVisible();
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'экран шире телефона').toBeLessThanOrEqual(layout.viewport + 1);
});
