import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test, type Page } from './fixtures';

/**
 * «Подключения → Channex» (`/connections/channex`). Срез INT2 (ADR-121, 28.09.2026) держал здесь отдельную страницу
 * состояния; 01.10.2026 навигация по задачам (`plans/workspace-order-2026-10-01.md`, решение в DECISIONS.md
 * от 01.10) собрала настройку Channex в одно место: страница «Подключение каналов» с прежними серверными данными и
 * командами (`ChannelConnectionSetup`), старый адрес `/channels/connections` ведёт сюда. Роли (кнопки владельцу,
 * управляющему словами, администратору закрыто) держит `channex-screens.spec.ts`; здесь: что страница говорит в
 * каждом состоянии подставного API, что ключей и сырых ответов на ней нет и что карточка на «Подключениях»
 * делает тот же вывод. Последний тест снимает экраны для владельца: обе темы, телефон.
 */
const fixture = FIXTURE_API;
const report = 'reports/unified-sections-2026-10-01/integrations-int2-2026-09-28';

type Mode = 'ok' | 'stale' | 'webhook' | 'foreign' | 'no-key';
const control = (page: Page, data: Record<string, unknown>) =>
  page.request.post(`${fixture}/__test/control`, { data });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

/** Роль и технические детали знает только оболочка вошедшего (ADR-083, ADR-102) */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('работает: соединение, сопоставление и webhook словами, ключей нет, вкладки модуля на месте', async ({
  page,
}) => {
  await control(page, { channex: 'ok' satisfies Mode });
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
  await expect(
    main.getByRole('link', { name: 'Подключения', exact: true }).first(),
  ).toHaveAttribute('href', '/connections');
  // очередь, сопоставление и события остаются экранами «Каналов продаж»: отсюда к ним ссылки
  const tabs = main.getByRole('navigation', { name: 'Настройка каналов' });
  await expect(tabs.getByRole('link')).toHaveText([
    'Статистика продаж',
    'Сопоставление категорий и тарифов',
    'Очередь обмена',
    'События',
  ]);
  const connection = main.getByTestId('channel-connection');
  await expect(connection).toContainText('Соединение установлено');
  await expect(connection).toContainText('Тестовая');
  await expect(connection).toContainText('ui-property');
  await expect(connection).toContainText('категорий 3, тарифов 3');
  await expect(main.getByTestId('webhook-state')).toHaveText('активен, события booking');
  await expect(main.getByTestId('channel-webhook')).toContainText('адрес отвечает');
  await expect(main.getByTestId('webhook-url-mismatch')).toHaveCount(0);
  // ключ хранится только на сервере: на странице его нет, есть только слова об этом
  await expect(main.getByTestId('channel-content-location')).toContainText(
    'Ключ менеджера каналов хранится только на сервере',
  );
  for (const text of ['API key', 'api_key', 'secret', 'ui-task-4f2a'])
    await expect(main).not.toContainText(text);
});

test('webhook не отвечает: причина словами и тот же вывод на карточке «Подключений»', async ({
  page,
}) => {
  await control(page, { channex: 'webhook' satisfies Mode });
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('channel-webhook')).toContainText('адрес не отвечает');
  await expect(main.getByTestId('channel-webhook')).toContainText('брони подберёт опрос ленты');
  await page.goto('/connections');
  await expect(page.getByRole('main').getByTestId('integration-health')).toHaveText(
    'Требует внимания',
  );
  await expect(page.getByRole('main').getByTestId('integration-issues')).toHaveText(
    /Webhook не отвечает/,
  );
});

test('устарело: очередь стоит, карточка «Подключений» зовёт в очередь', async ({ page }) => {
  await control(page, { channex: 'stale' satisfies Mode });
  await page.goto('/connections');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integration-health')).toHaveText('Требует внимания');
  const issues = main.getByTestId('integration-issues');
  await expect(issues).toContainText(/Очередь в каналы стоит \d+ мин/);
  await expect(issues.getByRole('link', { name: 'Открыть очередь' })).toHaveAttribute(
    'href',
    '/channels/sync?queue=PENDING',
  );
});

test('интеграция у другой организации: проверить нельзя, это сказано словами', async ({ page }) => {
  await control(page, { channex: 'foreign' satisfies Mode });
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByRole('alert').first()).toContainText(
    'Не удалось проверить подключение менеджера каналов.',
  );
  await expect(main.getByTestId('channel-connection')).toContainText('Не проверено');
  await expect(main.getByTestId('channel-webhook')).toContainText('Статус webhook не загрузился');
});

test('ключ не задан: так и сказано, кнопки настройки без ключа не работают', async ({ page }) => {
  await control(page, { channex: 'no-key' satisfies Mode });
  await signIn(page);
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('channel-connection')).toContainText(
    'Не задан ключ менеджера каналов',
  );
  await expect(main.getByTestId('channel-setup')).toBeDisabled();
  await expect(main.getByTestId('channel-sync')).toBeDisabled();
});

test('телефон: страница без прокрутки вбок', async ({ page }) => {
  await control(page, { channex: 'stale' satisfies Mode });
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

for (const theme of ['light', 'dark'] as const) {
  test(`снимки страницы настройки Channex для владельца, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(report, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await signIn(page);
    const shot = async (name: string, mode: Mode, extra = {}, full = false) => {
      await control(page, { channex: mode, ...extra });
      await page.goto('/connections/channex');
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
        'Подключение каналов',
      );
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${report}/${theme}-${name}.png`,
        caret: 'initial',
        fullPage: full,
      });
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot('ok-1440', 'ok');
    await shot('stale-1440', 'stale');
    await shot('webhook-1440', 'webhook');
    await shot('not-connected-1440', 'foreign');
    await shot('read-only-1440', 'ok', { orgTrialDays: 'ended' });
    await page.setViewportSize({ width: 390, height: 900 });
    await shot('ok-390', 'ok', {}, true);
    await shot('stale-390', 'stale', {}, true);
  });
}
