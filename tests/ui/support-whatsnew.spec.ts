import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, openProfileMenu, test } from './fixtures';

/**
 * SUP1 (plans/support-whatsnew-2026-10-18.md): «Связаться с поддержкой» на «Помощи» и в меню профиля, страница
 * «Что нового» с точкой в меню. Контакты стенда вымышленные (tests/ui/playwright.config.ts); что без контактов
 * блока нет, доказывает unit `apps/web/src/lib/support-contacts.test.ts`.
 */
test.beforeEach(async ({ page, request }) => {
  // вход и холодная сборка страницы под нагрузкой машины не укладываются в 45 с (как в соседних спеках)
  test.setTimeout(120_000);
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
});

test('«Помощь»: блок поддержки с WhatsApp и Telegram, сообщение с названием объекта', async ({ page }) => {
  await page.goto('/help');
  const block = page.locator('#support');
  await expect(block.getByRole('heading', { name: 'Связаться с поддержкой' })).toBeVisible();
  await expect(block).toContainText('Ежедневно 9:00–21:00 по Алматы');
  const wa = new URL((await block.getByRole('link', { name: 'Написать в WhatsApp' }).getAttribute('href'))!);
  expect(wa.origin + wa.pathname).toBe('https://wa.me/77000000000');
  expect(wa.searchParams.get('text')).toMatch(/^Здравствуйте! Пишу из WETOP, филиал «.+»\. Вопрос: $/);
  await expect(block.getByRole('link', { name: 'Написать в Telegram' })).toHaveAttribute(
    'href',
    'https://t.me/wetop_support_test',
  );
});

test('меню профиля ведёт к поддержке и к «Что нового»; точка гаснет после открытия', async ({ page }) => {
  await page.goto('/chessboard');
  await openProfileMenu(page);
  const dropdown = page.locator('#profile-dropdown');
  await expect(dropdown.getByRole('link', { name: 'Связаться с поддержкой' })).toHaveAttribute('href', '/help#support');
  await expect(dropdown.getByTestId('whats-new-dot')).toBeVisible();
  await dropdown.getByRole('link', { name: /Что нового/ }).click();
  await page.waitForURL('**/whats-new');
  await expect(page.getByRole('heading', { level: 1, name: 'Что нового' })).toBeVisible();
  // гостиница видит свою запись и общую, а записей салона и ресторана нет
  await expect(page.getByRole('heading', { name: 'Гости и бронирования на одном экране' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Связь с поддержкой и «Что нового»' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Склад списывается по техкартам' })).toHaveCount(0);
  await page.reload();
  await openProfileMenu(page);
  await expect(page.locator('#profile-dropdown').getByTestId('whats-new-dot')).toHaveCount(0);
});

for (const path of ['/help', '/whats-new'])
  for (const scheme of ['light', 'dark'] as const)
    for (const width of [1440, 390])
      test(`axe: ${path}, ${scheme}, ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        const result = await new AxeBuilder({ page }).include('main').analyze();
        expect(result.violations).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, 'горизонтальная прокрутка').toBeLessThanOrEqual(0);
      });
