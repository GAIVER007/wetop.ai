import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

/**
 * «Интеграции → Channex», срез INT2 (ADR-121, план `plans/integrations-int2-2026-09-28.md`): подключено ли
 * соединение и как им управлять. Проверяет, что страница не дублирует «Каналы продаж», не показывает ключей и сырых
 * ответов, считает состояние теми же правилами, что карточка, и не рисует кнопок, которых API не умеет. Последний
 * тест снимает стоп-гейт для владельца: светлая и тёмная темы, телефон, работает, устарело, webhook не отвечает,
 * не подключено, только чтение.
 */
const fixture = 'http://127.0.0.1:4311';
const report = 'reports/integrations-int2-2026-09-28';

type Mode = 'ok' | 'stale' | 'webhook' | 'foreign' | 'no-key';
const control = (page: Page, data: Record<string, unknown>) =>
  page.request.post(`${fixture}/__test/control`, { data });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

/** Роль, «только чтение» и технические детали знает только оболочка вошедшего (ADR-083, ADR-102) */
async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('работает: соединение и состояние без очереди, событий, ключей и лишних кнопок', async ({
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
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Менеджер каналов');
  await expect(main.getByRole('link', { name: 'Интеграции' })).toHaveAttribute(
    'href',
    '/connections',
  );
  await expect(main.getByTestId('integration-health')).toHaveText('Работает');
  await expect(main.getByTestId('integration-issues')).toHaveCount(0);
  await expect(main.getByTestId('channex-connection')).toContainText('Luxx Aparts');
  await expect(main.getByTestId('channex-connection')).toContainText(
    'задан, хранится на сервере WETOP',
  );
  await expect(main.getByTestId('channex-check')).toHaveText(/^прошла в \d{2}:\d{2}$/);
  await expect(main.getByTestId('channex-webhook')).toHaveText('включён и отвечает');
  await expect(main.getByTestId('channex-categories')).toHaveText('3 из 3');
  await expect(main.getByTestId('integration-last-exchange')).toHaveText(/^[12] мин назад$/);
  // действия — только те, что API умеет: проверка (чтение) и переход в «Каналы продаж»
  await expect(main.getByRole('button', { name: 'Проверить соединение' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Каналы продаж' })).toHaveAttribute(
    'href',
    '/channels',
  );
  for (const name of [
    /Переподключить/,
    /Отключить/,
    /Подключить/,
    /Полная выгрузка/,
    /Зарегистрировать/,
  ])
    await expect(main.getByRole('button', { name })).toHaveCount(0);
  await expect(main.getByTestId('channex-manage')).toContainText('поддержка WETOP');
  // очередь, события и сырые данные остаются в «Каналах продаж»; ключей и адреса webhook нет
  for (const text of [
    'Очередь в каналы',
    'ui-task-4f2a',
    'https://api.example.invalid',
    'API key',
    'secret',
  ])
    await expect(main).not.toContainText(text);
  // среда и ID объекта — только в свёрнутых технических деталях
  const tech = main.getByTestId('integration-tech');
  await expect(tech.getByText('Тестовая')).toBeHidden();
  await tech.getByText('Технические детали').click();
  await expect(tech).toContainText('ui-property');
  // «Проверить соединение» только читает: команд в API нет
  await main.getByRole('button', { name: 'Проверить соединение' }).click();
  await expect(main.getByTestId('integration-health')).toHaveText('Работает');
  expect(await (await page.request.get(`${fixture}/__test/commands`)).json()).toEqual([]);
});

test('устарело: очередь стоит — внимание, ссылка в очередь, обмен часами назад', async ({
  page,
}) => {
  await control(page, { channex: 'stale' satisfies Mode });
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integration-health')).toHaveText('Требует внимания');
  const issues = main.getByTestId('integration-issues');
  await expect(issues).toContainText(/Очередь в каналы стоит \d+ мин/);
  await expect(issues.getByRole('link', { name: 'Открыть очередь' })).toHaveAttribute(
    'href',
    '/channels/sync?queue=PENDING',
  );
  await expect(main.getByTestId('channex-webhook')).toHaveText('включён и отвечает');
  await expect(main.getByTestId('integration-last-exchange')).toHaveText(
    /^(сегодня|вчера), \d{2}:\d{2}$/,
  );
  // карточка на «Интеграциях» говорит то же самое
  await page.goto('/connections');
  await expect(page.getByRole('main').getByTestId('integration-health')).toHaveText(
    'Требует внимания',
  );
});

test('webhook не отвечает: причина словами и тот же вывод на карточке', async ({ page }) => {
  await control(page, { channex: 'webhook' satisfies Mode });
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integration-health')).toHaveText('Требует внимания');
  await expect(main.getByTestId('integration-issues')).toHaveText(/Webhook не отвечает/);
  await expect(main.getByTestId('channex-webhook')).toHaveText('не отвечает');
});

test('не подключено: как подключить, без ссылки в «Каналы продаж» и без состояния', async ({
  page,
}) => {
  await control(page, { channex: 'foreign' satisfies Mode });
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integration-health')).toHaveText('Не подключено');
  await expect(main.getByTestId('integration-connect')).toContainText('Подключает поддержка WETOP');
  await expect(main.getByTestId('channex-settings')).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Каналы продаж' })).toHaveCount(0);
  await expect(main.getByRole('button')).toHaveCount(0);
});

test('ключ не задан — тоже «не подключено»', async ({ page }) => {
  await control(page, { channex: 'no-key' satisfies Mode });
  await page.goto('/connections/channex');
  await expect(page.getByRole('main').getByTestId('integration-health')).toHaveText(
    'Не подключено',
  );
});

test('только чтение: состояние и проверка доступны, изменения — после оплаты', async ({ page }) => {
  await control(page, { channex: 'ok' satisfies Mode, orgTrialDays: 'ended' });
  await signIn(page);
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main.getByTestId('integration-health')).toHaveText('Работает');
  await expect(main.getByRole('button', { name: 'Проверить соединение' })).toBeEnabled();
  await expect(main.getByTestId('channex-read-only')).toContainText('после оплаты подписки');
  await expect(main.getByTestId('channex-manage')).not.toContainText('владелец настраивает');
});

test('управляющий: без технических деталей и без ссылки на настройку владельца; сотруднику закрыто', async ({
  page,
}) => {
  await control(page, { channex: 'ok' satisfies Mode, role: 'MANAGER' });
  await signIn(page);
  await page.goto('/connections/channex');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integration-health')).toHaveText('Работает');
  await expect(main.getByTestId('integration-tech')).toHaveCount(0);
  await expect(main).not.toContainText('ui-property');
  await expect(main.getByTestId('channex-manage')).not.toContainText('владелец настраивает');
  // раздел «Интеграции» — владельцу и управляющему (ADR-107); страница Channex под тем же правилом
  await control(page, { channex: 'ok' satisfies Mode, role: 'STAFF' });
  await page.goto('/connections/channex');
  await expect(main.getByTestId('no-access')).toBeVisible();
  await expect(main.getByTestId('channex-settings')).toHaveCount(0);
});

test('телефон: страница без прокрутки вбок', async ({ page }) => {
  await control(page, { channex: 'stale' satisfies Mode });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections/channex');
  await expect(page.getByTestId('integration-health')).toBeVisible();
  const layout = await page.evaluate(() => {
    const w = globalThis as unknown as {
      innerWidth: number;
      document: { documentElement: { scrollWidth: number } };
    };
    return { viewport: w.innerWidth, content: w.document.documentElement.scrollWidth };
  });
  expect(layout.content, 'экран шире телефона').toBeLessThanOrEqual(layout.viewport + 1);
});

for (const theme of ['light', 'dark'] as const) {
  test(`INT2, стоп-гейт: снимки для владельца, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(report, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await signIn(page);
    const shot = async (name: string, mode: Mode, extra = {}, full = false) => {
      await control(page, { channex: mode, ...extra });
      await page.goto('/connections/channex');
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
        'Менеджер каналов',
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
