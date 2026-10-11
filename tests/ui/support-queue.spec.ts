import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Кабинет техподдержки, S1 (план `plans/support-assistant-v2-2026-09-29.md`): очередь без пустых диалогов, чипы с
 * числами, приоритет и ожидание в строке, переписка рядом со списком, действия оператора по режиму, закрытие
 * обращения, «помощник не отвечает», телефон. Стенд — `scripts/preview/fixture-api.ts`; все, кто пишет, вымышленные.
 */
// Порт стенда можно задать (`UI_FIXTURE_API`): дерево делят несколько сессий, 4311 бывает занят
const API = FIXTURE_API;
const SIGNED = '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const WAITING = '8c3d4e5f-6a7b-4c8d-8e9f-1a2b3c4d5e6f';
const CLOSED = '9d4e5f6a-7b8c-4d9e-9f0a-2b3c4d5e6f7a';
const EMPTY = 'ad5e6f7a-8b9c-4e0f-8a1b-3c4d5e6f7a8b';
/** Диалог вкладки «Проверка» на стенде: в очереди его быть не должно (правка 02.10.2026) */
const SANDBOX = 'cf7a8b9c-0d1e-4a2b-8c3d-5e6f7a8b9c0d';
const SHOTS = 'reports/support-assistant-s1-2026-09-29';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
}

const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

async function shot(page: Page, name: string) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
}

const queue = (page: Page) => page.getByRole('main').getByTestId('support-queue-list');
const categories = (page: Page) =>
  page.getByRole('main').getByRole('navigation', { name: 'Категория обращения' });
const chips = (page: Page) =>
  page.getByRole('main').getByRole('navigation', { name: 'Очередь обращений' });

test('очередь: без пустых диалогов, срочные первыми, последнее сообщение и сколько ждёт', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/platform/support');

  const rows = queue(page).getByRole('listitem');
  // четыре диалога на стенде: один пустой, один закрытый — в открытой очереди их нет
  await expect(rows).toHaveCount(3);
  await expect(queue(page).locator(`[data-id="${EMPTY}"]`)).toHaveCount(0);
  await expect(queue(page).locator(`[data-id="${CLOSED}"]`)).toHaveCount(0);

  // срочно (нужен человек) → ждёт оператора → остальное
  await expect(rows.nth(0)).toHaveAttribute('data-id', SIGNED);
  await expect(rows.nth(0)).toContainText('срочно');
  await expect(rows.nth(0)).toContainText('ИИ: Вижу ошибку в журнале. Позову человека.');
  await expect(rows.nth(1)).toHaveAttribute('data-id', WAITING);
  await expect(rows.nth(1)).toContainText('ждёт оператора');
  await expect(rows.nth(1)).toContainText('ждёт 12 мин');
  await expect(rows.nth(1)).toContainText('Пользователь: Поле не сохраняется');

  const nav = chips(page);
  await expect(nav.getByRole('link', { name: /Все открытые/ })).toContainText('3');
  await expect(nav.getByRole('link', { name: /Ждут ответа/ })).toContainText('1');
  await expect(nav.getByRole('link', { name: /Нужен человек/ })).toContainText('1');
  await expect(nav.getByRole('link', { name: /Ведёт оператор/ })).toContainText('1');
  await expect(nav.getByRole('link', { name: /Ведёт ИИ/ })).toContainText('1');
  await expect(nav.getByRole('link', { name: /Новые/ })).toContainText('2');

  await nav.getByRole('link', { name: /Ждут ответа/ }).click();
  await expect(page).toHaveURL(/queue=waiting/);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toHaveAttribute('data-id', WAITING);
  await shot(page, 'queue-waiting-1440');
});

test('переписка открывается рядом со списком; забрать, ответить, вернуть ИИ', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/platform/support');
  const main = page.getByRole('main');

  await queue(page).locator(`[data-id="${SIGNED}"]`).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`id=${SIGNED}`));
  const card = main.getByTestId('support-dialog-card');
  // список на месте — рядом, а не над карточкой
  await expect(queue(page)).toBeVisible();
  const listBox = await queue(page).boundingBox();
  const cardBox = await card.boundingBox();
  expect(cardBox!.x).toBeGreaterThan(listBox!.x + listBox!.width - 1);
  await expect(queue(page).locator(`[data-id="${SIGNED}"]`)).toHaveAttribute(
    'aria-current',
    'true',
  );

  await expect(card.getByRole('heading', { level: 2 })).toHaveText('dana@example.invalid');
  await expect(card).toContainText('Не сохраняется бронь');
  await shot(page, 'dialog-1440');

  await card.getByRole('button', { name: 'Забрать диалог' }).click();
  await expect(card.getByTestId('dialog-mode-result')).toContainText('Диалог ваш');
  await card.getByLabel('Ответ пользователю').fill('Проверим за десять минут.');
  await card.getByRole('button', { name: 'Ответить' }).click();
  await expect(card.getByTestId('dialog-reply-result')).toHaveText('Ответ отправлен.');
  await page.reload();
  await expect(main.getByTestId('support-dialog-card')).toContainText('Проверим за десять минут.');
  await expect(main.getByTestId('support-dialog-mode')).toHaveText('ведёт оператор');
  await main.getByTestId('support-dialog-card').getByRole('button', { name: 'Вернуть ИИ' }).click();
  await expect(
    main.getByTestId('support-dialog-card').getByTestId('dialog-mode-result'),
  ).toContainText('вернули помощнику');
});

test('закрыть обращение: с подтверждением, уходит в «Закрытые», переписка только для чтения', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto(`/platform/support?id=${WAITING}`);
  const main = page.getByRole('main');
  const card = main.getByTestId('support-dialog-card');

  await card.getByRole('button', { name: 'Закрыть обращение' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Закрыть обращение?');
  await dialog.getByRole('button', { name: 'Закрыть обращение' }).click();
  await expect(card.getByTestId('support-dialog-closed')).toContainText('Обращение закрыто');
  await expect(card.getByLabel('Ответ пользователю')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Вернуть ИИ' })).toHaveCount(0);

  await expect(queue(page).locator(`[data-id="${WAITING}"]`)).toHaveCount(0);
  await chips(page).getByRole('link', { name: 'Закрытые' }).click();
  await expect(queue(page).locator(`[data-id="${WAITING}"]`)).toHaveCount(1);
  await expect(queue(page).locator(`[data-id="${CLOSED}"]`)).toHaveCount(1);

  await chips(page)
    .getByRole('link', { name: /Ждут ответа/ })
    .click();
  await expect(main.getByTestId('support-queue-empty')).toContainText('Никто не ждёт ответа');
});

test('помощник не отвечает — отдельно от «не подключён», с повтором', async ({ page, request }) => {
  await signIn(page);
  await control(request, { platformAdmin: true, supportState: 'unavailable' });
  await page.goto('/platform/support');
  const state = page.getByRole('main').getByTestId('support-unavailable');
  await expect(state).toContainText('ИИ-помощник не отвечает');
  await expect(state.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await expect(page.getByTestId('support-not-configured')).toHaveCount(0);
});

test('телефон: список на весь экран, переписка вместо него и «К списку»', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/platform/support');
  const main = page.getByRole('main');
  await expect(queue(page)).toBeVisible();
  await expect(main.getByTestId('support-dialog-card')).toHaveCount(0);
  await shot(page, 'queue-390');

  await queue(page).locator(`[data-id="${WAITING}"]`).getByRole('link').click();
  const card = main.getByTestId('support-dialog-card');
  await expect(card).toBeVisible();
  await expect(queue(page)).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, 'dialog-390');

  await main.getByRole('link', { name: 'К списку' }).click();
  await expect(queue(page)).toBeVisible();
  await expect(main.getByTestId('support-dialog-card')).toHaveCount(0);
});

test('снимки для владельца: тёмная тема, компьютер и телефон', async ({ page, request }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto(`/platform/support?id=${WAITING}`);
  await expect(page.getByRole('main').getByTestId('support-dialog-card')).toBeVisible();
  await shot(page, 'dialog-1440-dark');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/platform/support');
  await expect(queue(page)).toBeVisible();
  await shot(page, 'queue-390-dark');
});

/**
 * Чистота очереди и категории (план `plans/support-queue-hygiene-2026-10-02.md`). 02.10.2026 все четыре
 * строки очереди на рабочей базе оказались проверками агента из вкладки «Проверка», одна с отметкой
 * «срочно · нужен человек».
 */
test('проверки агента в очередь не попадают; категория второй строкой чипов, статус держится', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.goto('/platform/support');

  const rows = queue(page).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(queue(page).locator(`[data-id="${SANDBOX}"]`)).toHaveCount(0);

  const cat = categories(page);
  await expect(cat.getByRole('link', { name: /^Все/ })).toContainText('3');
  await expect(cat.getByRole('link', { name: /Вопрос по платформе/ })).toContainText('2');
  await expect(cat.getByRole('link', { name: /^Ошибка/ })).toContainText('1');
  // пустую категорию показываем нулём, иначе непонятно, куда делись обращения
  await expect(cat.getByRole('link', { name: /Возврат и оплата/ })).toContainText('0');

  await cat.getByRole('link', { name: /^Ошибка/ }).click();
  await expect(page).toHaveURL(/category=error/);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toHaveAttribute('data-id', SIGNED);
  await shot(page, 'queue-category-error-1440');

  // статус и категория независимы: смена статуса держит категорию
  await chips(page).getByRole('link', { name: /Ждут ответа/ }).click();
  await expect(page).toHaveURL(/queue=waiting/);
  await expect(page).toHaveURL(/category=error/);
  await expect(page.getByRole('main').getByTestId('support-queue-empty')).toContainText(
    'В этой категории обращений нет',
  );

  await cat.getByRole('link', { name: /^Все/ }).click();
  await expect(page).not.toHaveURL(/category=/);
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toHaveAttribute('data-id', WAITING);
});

test('категории на телефоне и в тёмной теме', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await control(request, { platformAdmin: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/platform/support?category=platform');

  await expect(queue(page).getByRole('listitem')).toHaveCount(2);
  await expect(categories(page).getByRole('link', { name: /Вопрос по платформе/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await shot(page, 'queue-category-390-dark');
});
