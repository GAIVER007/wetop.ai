import { expect, test, FIXTURE_API } from './fixtures';

/**
 * Стекло «A» (владелец 01.11.2026): одно оформление кнопок, вкладок и полос на всех экранах. Обход ключевых экранов
 * стойки и кабинетов: главная кнопка «таблеткой» с бликом, страница без прокрутки вбок, светлая и тёмная тема.
 */
test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });

const SCREENS = [
  '/today',
  '/reservations',
  '/guests',
  '/finance',
  '/analytics',
  '/settings',
  '/learn',
  '/platform/cabinet',
  '/platform/cabinet/clients',
  '/platform/cabinet/team',
  '/platform/cabinet/rnp',
] as const;

test('стекло «A»: кнопки таблеткой с бликом, без прокрутки вбок, светлая и тёмная тема', async ({ page, request }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect((await request.post(`${FIXTURE_API}/__test/reset`)).ok()).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'));
  for (const path of SCREENS) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const btn = page.locator('.btn:visible').first();
    if (await btn.count()) {
      const look = await btn.evaluate((e) => {
        const s = getComputedStyle(e);
        return { radius: parseFloat(s.borderTopLeftRadius), height: e.getBoundingClientRect().height, shadow: s.boxShadow };
      });
      expect(look.radius, `${path}: кнопка таблеткой`).toBeGreaterThanOrEqual(look.height / 2 - 1);
      expect(look.shadow, `${path}: блик стекла`).toContain('inset');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path}: без прокрутки вбок`).toBe(true);
    const name = path.replace(/\//g, '_').replace(/^_/, '') || 'root';
    if (process.env.GLASS_SHOTS) {
      await page.screenshot({ path: `${process.env.GLASS_SHOTS}/${name}-light.png` });
      await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
      // стекло меняет цвет плавно (0,3 с): снимок после перехода, иначе кнопки «полусветлые»
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${process.env.GLASS_SHOTS}/${name}-dark.png` });
      await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
      await page.waitForTimeout(600);
    }
  }
});
