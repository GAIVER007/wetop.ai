import { expect, test, FIXTURE_API, type Page } from './fixtures';
import { kk } from '../../apps/web/src/i18n/kk';
import { en } from '../../apps/web/src/i18n/en';

/**
 * KK3 (план `plans/desk-kk-2026-10-23.md`): экраны гостиницы и общие разделы на казахском и английском. Что в коде не
 * осталось русского текста мимо перевода, доказывает unit `apps/web/src/i18n/kk-screens.test.ts`; здесь браузер: каждый
 * экран открывается на языке человека без сбоя, заголовок стал переводом из словаря, телефон без прокрутки вбок.
 */
const SCREENS = [
  '/today',
  '/chessboard',
  '/reservations',
  '/guests',
  '/inventory',
  '/hotel-settings',
  '/channels',
  '/connections',
  '/journal',
  '/incidents',
  '/finance',
  '/reports',
  '/market',
  '/management/analytics',
  '/marketing',
  '/marketing/site',
  '/ai-agents',
  '/team',
  '/profile',
  '/tasks',
  '/staff-schedule',
  '/payroll',
  '/warehouse',
];
const LANGUAGES = [
  { code: 'kk', name: 'Қазақша', words: kk },
  { code: 'en', name: 'English', words: en },
] as const;

test.use({ extraHTTPHeaders: { 'x-wetop-test-client': '1' } });

test.beforeEach(async ({ page, request }) => {
  test.setTimeout(420_000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today', { waitUntil: 'domcontentloaded' });
});

async function applySavedLocale(page: Page, code: string) {
  const token = (await page.context().cookies()).find((cookie) => cookie.name === 'wetop_session')?.value;
  expect(token).toBeTruthy();
  const response = await page.request.post(`${FIXTURE_API}/auth/locale`, {
    headers: { 'x-wetop-test-client': '1', 'x-wetop-session': token! },
    data: { locale: code },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', code);
}

const heading = (page: Page) => page.getByRole('heading', { level: 1 }).first();

for (const { code, name, words } of LANGUAGES)
  test(`гостиница на ${name}: заголовки экранов из словаря, без сбоя и прокрутки вбок на телефоне`, async ({ page }) => {
    const russian = new Map<string, string>();
    for (const path of SCREENS) {
      await page.goto(path);
      russian.set(path, ((await heading(page).textContent()) ?? '').trim());
    }
    await applySavedLocale(page, code);
    await page.setViewportSize({ width: 390, height: 844 });
    const problems: string[] = [];
    for (const path of SCREENS) {
      const response = await page.goto(path);
      if (!response || response.status() >= 500) problems.push(`${path}: ответ ${response?.status()}`);
      await expect(page.locator('html')).toHaveAttribute('lang', code);
      const ru = russian.get(path)!;
      const shown = ((await heading(page).textContent()) ?? '').trim();
      if (!words[ru]) problems.push(`${path}: заголовка «${ru}» нет в словаре`);
      else if (shown !== words[ru]) problems.push(`${path}: «${shown}», ждали «${words[ru]}»`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${path}: прокрутка вбок ${overflow} px`);
    }
    expect(problems).toEqual([]);
  });
