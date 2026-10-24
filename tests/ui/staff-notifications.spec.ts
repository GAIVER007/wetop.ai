import AxeBuilder from '@axe-core/playwright';
import type { APIRequestContext, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Настройки рабочего места → Уведомления» (STAFF-TG-20261020, план plans/staff-telegram-notifications-2026-10-20.md):
 * свой Telegram для сообщений о бронях с сайта. Без токена бота экран говорит «Бот WETOP подключается администратором
 * платформы», кнопка неактивна; с ботом: ссылка t.me с кодом, после /start статус «Подключено: @…», переключатель
 * «Брони с сайта», «Проверить» и «Отключить». Стенд: подставной API, данные вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const SHOTS = 'reports/staff-telegram-2026-10-20';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

async function openNotifications(page: Page) {
  await page.goto('/profile');
  const main = page.getByRole('main');
  await main.getByRole('tab', { name: 'Уведомления' }).click();
  const panel = main.getByTestId('profile-telegram');
  await expect(panel).toBeVisible();
  return panel;
}

test('без токена бота: «подключается администратором платформы», кнопка неактивна', async ({ page }) => {
  await signIn(page);
  const panel = await openNotifications(page);
  await expect(panel.getByTestId('telegram-state')).toHaveText('Не подключено');
  await expect(panel.getByTestId('telegram-bot-pending')).toHaveText('Бот WETOP подключается администратором платформы');
  await expect(panel.getByRole('button', { name: 'Подключить Telegram' })).toBeDisabled();
  await expect(panel).not.toContainText('—');
});

test('с ботом: ссылка t.me с кодом, после /start «Подключено», переключатель, проверка и отключение', async ({
  page,
  request,
}) => {
  await control(request, { staffBot: true });
  await signIn(page);
  const panel = await openNotifications(page);
  await expect(panel.getByTestId('telegram-bot-pending')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Подключить Telegram' }).click();
  const link = panel.getByTestId('telegram-link');
  await expect(link).toContainText('K7QW3MZP');
  await expect(link.getByRole('link', { name: 'Открыть Telegram' })).toHaveAttribute(
    'href',
    'https://t.me/wetop_staff_bot?start=K7QW3MZP',
  );
  // сотрудник нажал «Запустить» в Telegram: бот получил /start K7QW3MZP
  await request.post(`${API}/__test/staff-telegram/link`);
  await link.getByRole('button', { name: 'Я подключил' }).click();
  await expect(panel.getByTestId('telegram-state')).toHaveText('Подключено: @dana_test');
  const toggle = panel.getByRole('switch', { name: /Брони с сайта/ });
  await expect(toggle).toBeChecked();
  await toggle.click({ force: true });
  await expect(panel.getByRole('status')).toHaveText('Брони с сайта больше не приходят');
  await expect(toggle).not.toBeChecked();
  await panel.getByRole('button', { name: 'Проверить' }).click();
  await expect(panel.getByRole('status')).toHaveText('Проверочное сообщение отправлено в Telegram');
  await panel.getByRole('button', { name: 'Отключить' }).click();
  await expect(panel.getByTestId('telegram-state')).toHaveText('Не подключено');
  await expect(panel.getByRole('button', { name: 'Подключить Telegram' })).toBeEnabled();
});

for (const scheme of ['light', 'dark'] as const)
  for (const width of [1440, 390])
    for (const state of ['pending', 'connected'] as const)
      test(`доступность «Уведомлений» (${state}): ${scheme}, ${width}px`, async ({ page, request }) => {
        mkdirSync(SHOTS, { recursive: true });
        if (state === 'connected') await control(request, { staffBot: true });
        await signIn(page);
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width, height: 900 });
        const panel = await openNotifications(page);
        if (state === 'connected') {
          await panel.getByRole('button', { name: 'Подключить Telegram' }).click();
          // код выдан, только потом «нажать Запустить» в Telegram
          await expect(panel.getByTestId('telegram-link')).toContainText('K7QW3MZP');
          await request.post(`${API}/__test/staff-telegram/link`);
          await panel.getByRole('button', { name: 'Я подключил' }).click();
          await expect(panel.getByTestId('telegram-state')).toHaveText('Подключено: @dana_test');
        } else {
          await expect(panel.getByTestId('telegram-bot-pending')).toBeVisible();
        }
        const result = await new AxeBuilder({ page }).include('main').analyze();
        expect(result.violations).toEqual([]);
        const widths = await page.evaluate(() => [
          document.documentElement.scrollWidth,
          document.documentElement.clientWidth,
        ]);
        expect(widths[0]).toBeLessThanOrEqual(widths[1]!);
        await page.screenshot({ path: `${SHOTS}/notifications-${state}-${scheme}-${width}.png`, fullPage: width === 1440 });
      });
