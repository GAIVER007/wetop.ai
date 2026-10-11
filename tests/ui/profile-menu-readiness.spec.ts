import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Меню профиля на холодной загрузке стойки. Шапку рисует сервер, а обработчик кнопки навешивает React после
 * загрузки скриптов стойки; на медленной сети или раннере между этими моментами проходят секунды
 * (release-checks #7, `login-access.spec.ts`). Пока обработчика нет, кнопка не должна выглядеть рабочей:
 * `top-nav.tsx` держит её недоступной (`disabled`, `aria-busy`, курсор «ожидание», приглушённый цвет) до первого
 * рендера на клиенте.
 *
 * Три проверки, каждая своим тестом на своей холодной загрузке:
 *  1. до готовности кнопка недоступна и выглядит недоступной, нажатие по ней меню не открывает;
 *  2. после готовности меню открывается обычным кликом;
 *  3. после готовности меню открывается с клавиатуры (Enter, затем Пробел после Escape).
 *
 * Чего спек НЕ утверждает. Ранний клик человека он не сохраняет: пока кнопка недоступна, браузер клик не
 * принимает, и это видно. Автоожидание Playwright (`click` ждёт `enabled`) за такую проверку не выдаётся, а
 * готовность здесь означает состояние самой кнопки, поэтому служебные свойства React не читаются и
 * `openProfileMenu` из fixtures не используется.
 *
 * Скрипты стойки (`/_next/static/**.js`) держат ворота: HTML и стили приходят сразу, скрипты ждут команды
 * теста. Окно «до готовности» длится ровно столько, сколько нужно проверкам, без фиксированной задержки.
 */
let openGate: () => void = () => {};

const isDeskScript = (url: URL) =>
  url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js');

test.beforeEach(async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  // следующий экран грузится «холодно»: HTML сразу, скрипты стойки только после команды
  const gate = new Promise<void>((resolve) => {
    openGate = resolve;
  });
  await page.route(isDeskScript, async (route) => {
    await gate;
    await route.continue();
  });
});

test.afterEach(async ({ page }) => {
  // красный тест не оставляет запросы висеть на закрытых воротах
  openGate();
  await page.unrouteAll({ behavior: 'wait' });
});

test('до готовности кнопка недоступна и выглядит недоступной, нажатие по ней меню не открывает', async ({
  page,
}) => {
  await page.goto('/chessboard', { waitUntil: 'commit' });
  const menu = page.getByRole('button', { name: 'Меню администратора' });
  // шапка нарисована сервером, скрипты стойки ещё за воротами
  await expect(menu).toBeVisible();
  await expect(menu).toBeDisabled();
  await expect(menu).toHaveAttribute('aria-busy', 'true');
  await expect(menu).toHaveCSS('cursor', 'progress');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  // нажатие рукой, без ожидания доступности (`force`): недоступной кнопке браузер клик не отдаёт
  await menu.click({ force: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.profile-dropdown')).toBeHidden();
});

test('после готовности меню открывается обычным кликом', async ({ page }) => {
  await page.goto('/chessboard', { waitUntil: 'commit' });
  const menu = page.getByRole('button', { name: 'Меню администратора' });
  // исходное состояние: до готовности, иначе проверка не о том
  await expect(menu).toBeDisabled();
  openGate();
  await expect(menu).toBeEnabled();
  await expect(menu).toHaveAttribute('aria-busy', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.profile-dropdown')).toBeVisible();
});

test('после готовности меню открывается с клавиатуры: Enter, Escape закрывает, Пробел открывает снова', async ({
  page,
}) => {
  await page.goto('/chessboard', { waitUntil: 'commit' });
  const menu = page.getByRole('button', { name: 'Меню администратора' });
  await expect(menu).toBeDisabled();
  openGate();
  await expect(menu).toBeEnabled();
  await menu.focus();
  await expect(menu).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.profile-dropdown')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await page.keyboard.press('Space');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.profile-dropdown')).toBeVisible();
});
