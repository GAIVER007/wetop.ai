import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, openProfileMenu, test, type Page } from './fixtures';

/**
 * KK1 (ADR-163, plans/desk-kk-2026-10-23.md): язык стойки у человека. Сохранённый язык `users.locale` приходит
 * через API, каркас (шапка, меню, профиль, «Помощь») переходит на казахский, выбор переживает перезагрузку.
 * Что каждая фраза каркаса переведена, доказывает unit `apps/web/src/i18n/kk.test.ts`.
 */
test.beforeEach(async ({ page, request }) => {
  test.setTimeout(120_000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

async function chooseLocale(page: Page, code: 'ru' | 'kk' | 'en') {
  const token = (await page.context().cookies()).find((cookie) => cookie.name === 'wetop_session')?.value;
  expect(token).toBeTruthy();
  const response = await page.request.post(`${FIXTURE_API}/auth/locale`, {
    headers: { 'x-wetop-session': token! }, data: { locale: code },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

test('по умолчанию русский, меню профиля без выбора языка', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await openProfileMenu(page);
  const dropdown = page.locator('#profile-dropdown');
  await expect(dropdown.locator('.profile-dropdown__locale')).toHaveCount(0);
  await expect(dropdown.getByRole('button', { name: 'Русский' })).toHaveCount(0);
  await expect(dropdown.getByRole('link', { name: 'Помощь' })).toBeVisible();
});

test('сохранённый казахский: шапка, меню и профиль по-казахски, выбор переживает перезагрузку', async ({ page }) => {
  await chooseLocale(page, 'kk');
  await expect(page.getByRole('navigation', { name: 'Басты мәзір' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Қонақты немесе брондауды табу' })).toBeVisible();
  await openProfileMenu(page);
  const dropdown = page.locator('#profile-dropdown');
  await expect(dropdown.getByRole('link', { name: 'Көмек' })).toBeVisible();
  await expect(dropdown.getByRole('button', { name: 'Шығу' })).toBeVisible();
  await expect(dropdown.locator('.profile-dropdown__locale')).toHaveCount(0);
  await expect(page.locator('.profile-caption small')).toHaveText('Иесі');
  // язык лежит на сервере, а не в браузере: без куки языка вошедший всё равно получает его из /auth/me
  await page.context().clearCookies({ name: 'wetop_locale' });
  expect((await page.context().cookies()).some((c) => c.name === 'wetop_locale')).toBe(false);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk');
  await expect(page.getByRole('button', { name: 'Қонақты немесе брондауды табу' })).toBeVisible();
});

test('EN1: сохранённый английский, шапка и профиль по-английски, назад на русский', async ({ page }) => {
  await chooseLocale(page, 'en');
  await expect(page.getByRole('navigation', { name: 'Main menu' })).toBeAttached();
  await expect(page.getByRole('button', { name: 'Find a guest or booking' })).toBeVisible();
  await openProfileMenu(page);
  const dropdown = page.locator('#profile-dropdown');
  await expect(dropdown.getByRole('link', { name: 'Help' })).toBeVisible();
  await expect(dropdown.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(dropdown.locator('.profile-dropdown__locale')).toHaveCount(0);
  await expect(page.locator('.profile-caption small')).toHaveText('Owner');
  await page.keyboard.press('Escape');
  await chooseLocale(page, 'ru');
  await expect(page.getByRole('button', { name: 'Найти гостя или бронь' })).toBeVisible();
});

test('«Помощь» и «Не жаңалық» на казахском, с сохранённым русским языком', async ({ page }) => {
  await chooseLocale(page, 'kk');
  await page.goto('/help');
  await expect(page.getByRole('heading', { level: 1, name: 'Көмек' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Жұмысты бастау' })).toBeVisible();
  await page.goto('/whats-new');
  await expect(page.getByRole('heading', { level: 1, name: 'Не жаңалық' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Қонақтар мен брондаулар бір экранда' })).toBeVisible();
  await chooseLocale(page, 'ru');
  await expect(page.getByRole('heading', { level: 1, name: 'Что нового' })).toBeVisible();
});

test('телефон 390 px: меню навигации по-казахски, без горизонтальной прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseLocale(page, 'kk');
  await page.getByRole('button', { name: 'Мәзірді ашу' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Навигация' }).getByRole('navigation', { name: 'Бөлімдер' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    test(`axe: «Помощь» на казахском, ${scheme}, ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await chooseLocale(page, 'kk');
      await page.goto('/help');
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
    });

for (const role of ['OWNER', 'MANAGER', 'STAFF'] as const) {
  test(`salon setup menu follows the existing ${role} permission`, async ({ page, request }) => {
    const business = '55555555-5555-4555-8555-555555555555';
    const location = '44444444-4444-4444-8444-444444444444';
    expect((await request.post(`${FIXTURE_API}/branches`, { data: {
      id: location, name: 'Салон Пример', newBusinessId: business,
      businessName: 'Салон Пример', vertical: 'BEAUTY',
    } })).ok()).toBe(true);
    await page.context().addCookies([{ name: 'wetop_scope',
      value: encodeURIComponent(`business=${business};location=${location}`),
      domain: '127.0.0.1', path: '/',
    }]);
    await request.post(`${FIXTURE_API}/__test/control`, { data: { role } });
    await page.goto('/calendar');
    await openProfileMenu(page);
    const dropdown = page.locator('#profile-dropdown');
    const setup = dropdown.getByRole('link', { name: 'Настройка салона', exact: true });
    if (role === 'STAFF') await expect(setup).toHaveCount(0);
    else await expect(setup).toHaveAttribute('href', '/register/setup?entry=reopen');
    await expect(dropdown.locator('.profile-dropdown__locale')).toHaveCount(0);
  });
}
