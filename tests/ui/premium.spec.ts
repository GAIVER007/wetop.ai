import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const fixture = 'http://127.0.0.1:4311';
const screenshotDir = 'reports/premium-ui';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  mkdirSync(screenshotDir, { recursive: true });
});
test('темы: system, мгновенное переключение, сохранение после перезагрузки', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/today');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-light.png` });
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.occupancy-ring').first()).toBeVisible();
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-dark.png` });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Как на устройстве' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('shell: панель, меню профиля, поиск', async ({ page }) => {
  await page.goto('/today');
  await page.getByRole('button', { name: 'Свернуть панель' }).click();
  await expect(page.locator('.workspace')).toHaveClass(/is-collapsed/);
  await page.reload();
  await expect(page.locator('.workspace')).toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: 'Развернуть панель' }).click();
  await page.getByRole('button', { name: 'Меню администратора' }).click();
  await expect(page.getByRole('link', { name: 'Профиль и предпочтения' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'Профиль и предпочтения' })).toBeHidden();
  await page.getByRole('button', { name: 'Найти гостя или бронь' }).click();
  const search = page.getByRole('dialog', { name: 'Быстрый поиск' });
  await expect(search).toBeVisible();
  await search.getByLabel('Запрос').fill('Тест');
  await search.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page).toHaveURL(/guests\?q=/);
});
test('drawer: бронь открывается поверх доски, вкладки доступны клавиатурой, Escape возвращает контекст', async ({
  page,
}) => {
  await page.goto('/chessboard');
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/chessboard-light.png` });
  await page.getByTestId('stay-cell').first().click();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText('Бронь');
  await drawer.getByRole('tab', { name: 'Счета', exact: true }).click();
  await expect(drawer.getByTestId('folio-panel')).toBeVisible();
  await drawer.getByRole('tab', { name: 'Счета', exact: true }).press('ArrowRight');
  await expect(drawer.getByRole('tab', { name: 'Действия', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/booking-drawer.png` });
  await drawer.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await drawer.getByRole('link', { name: 'Принять оплату', exact: true }).click();
  await expect(drawer.getByRole('tab', { name: 'Счета', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await drawer
    .getByTestId('payment-form')
    .getByRole('button', { name: 'Принять оплату', exact: true })
    .click();
  await expect(drawer.getByTestId('folio-balance')).toHaveText('0,00 ₸, оплачено');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/chessboard/);
  await expect(page.getByTestId('chessboard')).toBeVisible();
});
test('новые фильтры шахматки, список броней и карточки номеров используют данные', async ({
  page,
}) => {
  await page.goto('/chessboard');
  // Status filters apply to the first date; seed occupancy is relative to today.
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const last = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86400_000)
    .toISOString()
    .slice(0, 10);
  await page.goto(`/chessboard?from=${today}&to=${last}`);
  await page.getByRole('button', { name: 'Номера', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  await page.getByRole('button', { name: 'Койко-места', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await page.getByRole('button', { name: 'Свободные', exact: true }).click();
  const count = await page.getByTestId('unit-row').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(72);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.goto('/reservations');
  await expect(page.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(8);
  await page
    .locator('.directory-filters')
    .getByRole('link', { name: 'Отменены', exact: true })
    .click();
  await expect(page.getByText('Бронирований не найдено')).toBeVisible();
  await page.goto('/rooms');
  await expect(page.locator('.room-card')).toHaveCount(16);
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/rooms-light.png` });
  // Пока страница догружается, в DOM на миг есть скрытая копия фильтров — ищем в видимом main
  const rooms = page.getByRole('main');
  await rooms.getByLabel('Тип единиц').selectOption('BED');
  await expect(page.locator('.room-card')).toHaveCount(72);
  await rooms.getByLabel('Поиск номеров').fill('M03');
  await expect(page.locator('.room-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Список', exact: true }).click();
  await expect(page.locator('.room-cards')).toHaveClass(/room-cards--list/);
});
test('новые страницы и обе темы: адаптивность и отсутствие ошибок браузера', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const routes = [
    '/today',
    '/chessboard',
    '/reservations',
    '/guests',
    '/rooms',
    '/finance',
    '/profile',
    '/login',
    '/connections',
    '/hotel-settings',
    '/channel-manager',
  ];
  for (const width of [320, 390, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (width === 390 && route === '/today')
        await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-mobile.png` });
      const overflow = await page.evaluate(() => {
        const browser = globalThis as unknown as {
          document: { documentElement: { scrollWidth: number } };
          innerWidth: number;
        };
        return browser.document.documentElement.scrollWidth > browser.innerWidth + 1;
      });
      expect(overflow, `${width} ${route}`).toBe(false);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/today');
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  expect(errors).toEqual([]);
});
test('login не имитирует авторизацию', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('ещё не подключён');
  await expect(page).toHaveURL(/login/);
});
