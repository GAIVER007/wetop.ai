import { mkdirSync } from 'node:fs';
import { expect, test, type Page, FIXTURE_API } from './fixtures';

/**
 * «Интеграции» v2, срез INT1 (ADR-116, план `plans/integrations-int1-2026-09-27.md`): внешние подключения объекта,
 * состояние по настоящим сигналам, вкладки «Подключённые / Доступные», без внутренней диагностики и без глобальной
 * «Проверить соединение». Последний тест снимает стоп-гейт для владельца: обе темы, телефон, «работает», «требует
 * внимания», «не подключено», «только чтение».
 */
const fixture = FIXTURE_API;
const report = 'reports/unified-sections-2026-10-01/integrations-int1-2026-09-27';

type Mode = 'ok' | 'attention' | 'foreign' | 'no-key';
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

test('работает: одна карточка Channex, без базы, сайта и списка зелёных плашек', async ({
  page,
}) => {
  await control(page, { channex: 'ok' satisfies Mode });
  await signIn(page);
  await page.goto('/connections');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Интеграции');
  await expect(main).toContainText('Подключения внешних сервисов для Luxx Aparts.');
  const card = main.getByTestId('integration-channex');
  await expect(card.getByTestId('integration-health')).toHaveText('Работает');
  await expect(card.getByTestId('integration-issues')).toHaveCount(0);
  await expect(card.getByTestId('integration-last-exchange')).toHaveText(/^[12] мин назад$/);
  await expect(card).toContainText('3 категории, 3 тарифа');
  await expect(card.getByRole('link', { name: 'Каналы продаж' })).toHaveAttribute(
    'href',
    '/channels',
  );
  await expect(card.getByRole('link', { name: 'Настройки' })).toHaveAttribute(
    'href',
    '/connections/channex',
  );
  // внутреннее и чужие модули сюда не попадают (§2, §13, §26 ТЗ)
  for (const text of [
    'Данные проекта',
    'Supabase',
    'База проекта',
    'Сайт и бронирования',
    'Бронирования',
  ])
    await expect(main).not.toContainText(text);
  // проверка — у карточки, а не в шапке страницы (§9)
  await expect(
    page.locator('.page__head').getByRole('button', { name: 'Проверить соединение' }),
  ).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Проверить соединение' })).toBeVisible();
  // «Среда: Тестовая» и ID объекта — не основной текст карточки, а спрятанные технические детали
  const tech = card.getByTestId('integration-tech');
  await expect(tech.getByText('Тестовая')).toBeHidden();
  await tech.getByText('Технические детали').click();
  await expect(tech.getByText('Тестовая')).toBeVisible();
  await expect(tech).toContainText('ui-property');
  await expect(main.getByRole('link', { name: /Доступные/ })).toContainText('0');
});

test('требует внимания: причины словами и ссылки прямо к месту исправления', async ({ page }) => {
  await control(page, { channex: 'attention' satisfies Mode });
  await page.goto('/connections');
  const card = page.getByRole('main').getByTestId('integration-channex');
  await expect(card.getByTestId('integration-health')).toHaveText('Требует внимания');
  const issues = card.getByTestId('integration-issues');
  await expect(issues).toContainText('Webhook не отвечает');
  await expect(issues).toContainText('Ошибок отправки в каналы: 2');
  await expect(issues.getByRole('link', { name: 'Открыть очередь' })).toHaveAttribute(
    'href',
    '/channels/sync?queue=FAILED',
  );
  // обмен два часа назад — словом дня и временем объекта, не минутами
  await expect(card.getByTestId('integration-last-exchange')).toHaveText(
    /^(сегодня|вчера), \d{2}:\d{2}$/,
  );
});

test('интеграция у другой организации: «Подключённые» пусты, Channex — в «Доступных» без ложной кнопки', async ({
  page,
}) => {
  await control(page, { channex: 'foreign' satisfies Mode });
  await page.goto('/connections');
  const main = page.getByRole('main');
  await expect(main.getByTestId('integrations-empty')).toContainText(
    'Интеграции ещё не подключены',
  );
  await main.getByRole('link', { name: 'Посмотреть доступные' }).click();
  await expect(page).toHaveURL(/\/connections\?tab=available$/);
  const card = main.getByTestId('integration-channex');
  await expect(card.getByTestId('integration-health')).toHaveText('Не подключено');
  await expect(card.getByTestId('integration-connect')).toContainText('Подключает поддержка WETOP');
  await expect(card.getByRole('button')).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Доступные/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('ключ Channex не задан — не подключено, а не «работает»', async ({ page }) => {
  await control(page, { channex: 'no-key' satisfies Mode });
  await page.goto('/connections?tab=available');
  await expect(page.getByRole('main').getByTestId('integration-health')).toHaveText(
    'Не подключено',
  );
});

test('только чтение: список и состояние видны, подключение — после оплаты', async ({ page }) => {
  await control(page, { channex: 'foreign' satisfies Mode, orgTrialDays: 'ended' });
  await signIn(page);
  await page.goto('/connections?tab=available');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(page.getByRole('main').getByTestId('integration-connect')).toContainText(
    'Подключение — после оплаты подписки',
  );
});

test('не владелец технических деталей не видит; администратору раздел закрыт', async ({ page }) => {
  // Роли (ADR-107): «Интеграции» — право `settings`, у управляющего оно есть, технические детали — только владельцу
  await control(page, { channex: 'ok' satisfies Mode, role: 'MANAGER' });
  await signIn(page);
  await page.goto('/connections');
  const card = page.getByRole('main').getByTestId('integration-channex');
  await expect(card.getByTestId('integration-health')).toHaveText('Работает');
  await expect(card.getByTestId('integration-tech')).toHaveCount(0);
  await expect(card).not.toContainText('ui-property');
  await control(page, { channex: 'ok' satisfies Mode, role: 'STAFF' });
  await page.goto('/connections');
  await expect(page.getByRole('main').getByTestId('no-access')).toBeVisible();
  await expect(page.getByRole('main').getByTestId('integration-channex')).toHaveCount(0);
});

test('телефон: карточка без прокрутки вбок', async ({ page }) => {
  await control(page, { channex: 'attention' satisfies Mode });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/connections');
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
  test(`INT1, стоп-гейт: снимки для владельца, ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(report, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await signIn(page);
    const shot = async (name: string, mode: Mode, path = '/connections', extra = {}) => {
      await control(page, { channex: mode, ...extra });
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText(
        'Интеграции',
      );
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${report}/${theme}-${name}.png`, caret: 'initial' });
    };
    await page.setViewportSize({ width: 1440, height: 1000 });
    await shot('ok-1440', 'ok');
    await shot('attention-1440', 'attention');
    await shot('not-connected-1440', 'foreign');
    await shot('available-1440', 'foreign', '/connections?tab=available');
    await shot('read-only-1440', 'foreign', '/connections?tab=available', {
      orgTrialDays: 'ended',
    });
    await page.setViewportSize({ width: 390, height: 1000 });
    await shot('ok-390', 'ok');
    await shot('attention-390', 'attention');
  });
}
