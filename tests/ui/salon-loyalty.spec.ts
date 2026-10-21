import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Напоминания клиентам, бонусы и подарочные сертификаты салона (docs/decisions/2026-10-21-salon-reminders-loyalty.md):
 * сохранение настроек, «Напомнить сегодня» с WhatsApp-ссылкой, продажа и проверка сертификата, бонусы в карточке.
 * Данные вымышленные (AGENTS.md §8). Снимки в reports/salon-loyalty-2026-10-21/.
 */
const SHOTS = 'reports/salon-loyalty-2026-10-21';
test.describe.configure({ timeout: 180_000 });

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today', { timeout: 120_000 });
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия Лён');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Студия Лён', exact: true }).click();
  await page.waitForURL('**/today', { timeout: 120_000 });
  mkdirSync(SHOTS, { recursive: true });
}

test('настройки: напоминания с предпросмотром и бонусы сохраняются', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/beauty-settings');
  const reminders = page.getByTestId('reminder-settings');
  await expect(reminders.getByRole('heading', { name: 'Напоминания клиентам' })).toBeVisible({ timeout: 60_000 });
  await reminders.getByLabel('За сколько часов до записи').fill('24, 3');
  await reminders.getByLabel('Текст напоминания').fill('Здравствуйте, {имя}! Ждём вас {дата} в {время}.');
  await expect(reminders.getByTestId('reminder-preview')).toHaveText('Здравствуйте, Айгуль! Ждём вас 23 октября в 10:30.');
  await reminders.getByRole('button', { name: 'Сохранить напоминания' }).click();
  await expect(reminders.getByText('Напоминания сохранены')).toBeVisible();
  const bonuses = page.getByTestId('bonus-settings');
  await bonuses.getByLabel('Начислять и принимать бонусы').check();
  await bonuses.getByLabel('Начислять, % от оплаты').fill('7');
  await bonuses.getByRole('button', { name: 'Сохранить бонусы' }).click();
  await expect(bonuses.getByText('Бонусы сохранены.')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/settings.png`, fullPage: true });
  const saved = await (await request.get(`${FIXTURE_API}/beauty/bonus-program`, { headers: { 'x-wetop-test-client': '1' } })).json();
  expect(saved).toMatchObject({ enabled: true, accrualPercent: 7 });
});

test('журнал: «Напомнить сегодня» со ссылкой WhatsApp и отметкой «Напомнил»', async ({ page, request }) => {
  await openSalon(page, request);
  const inTwoHours = new Date(Date.now() + 2 * 3_600_000).toISOString();
  await request.post(`${FIXTURE_API}/__test/salon-loyalty`, {
    data: { reminders: [{ customerName: 'Айгуль', customerPhone: '+7 701 000 00 00', startsAt: inTwoHours }, { customerName: 'Сауле', customerPhone: null, startsAt: inTwoHours }] },
  });
  await page.goto('/calendar');
  const block = page.getByTestId('reminders-today');
  await expect(block.getByRole('heading', { name: 'Напомнить сегодня (2)' })).toBeVisible({ timeout: 60_000 });
  const aigul = block.getByTestId('reminder-row').filter({ hasText: 'Айгуль' });
  const link = aigul.getByRole('link', { name: 'Написать в WhatsApp' });
  await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/77010000000\?text=/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(block.getByTestId('reminder-row').filter({ hasText: 'Сауле' })).toContainText('Нет телефона');
  await page.screenshot({ path: `${SHOTS}/journal-reminders.png` });
  await aigul.getByRole('button', { name: 'Напомнил' }).click();
  await expect(block.getByRole('heading', { name: 'Напомнить сегодня (1)' })).toBeVisible();
});

test('финансы: продажа сертификата в окне по центру и проверка остатка по коду', async ({ page, request }) => {
  await openSalon(page, request);
  await page.goto('/finance/certificates');
  const main = page.getByRole('main');
  await expect(main.getByText('Сертификатов пока нет')).toBeVisible({ timeout: 60_000 });
  await main.getByRole('button', { name: 'Продать сертификат' }).click();
  const dialog = page.getByRole('dialog', { name: 'Продать сертификат' });
  await dialog.getByLabel(/Номинал/).fill('15000');
  await dialog.getByLabel('Оплата').selectOption({ label: 'Kaspi' });
  await dialog.getByRole('button', { name: 'Продать', exact: true }).click();
  const sold = dialog.getByTestId('certificate-sold');
  await expect(sold).toContainText('Сертификат продан');
  const code = (await sold.locator('strong').textContent())!.trim();
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  // окно по центру экрана, не боковая панель
  const box = (await page.locator('dialog[open]').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(40);
  await page.screenshot({ path: `${SHOTS}/certificate-sold.png` });
  await dialog.getByRole('button', { name: 'Готово' }).click();
  await expect(main.getByTestId('certificate-row')).toHaveCount(1);
  await main.getByLabel('Проверить по коду').fill(code.toLowerCase());
  await main.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(main.getByTestId('certificate-lookup-result')).toContainText(`${code}: действует, остаток 15 000 ₸`);
  await page.screenshot({ path: `${SHOTS}/certificates.png`, fullPage: true });
});

test('карточка клиента: баланс и история бонусов', async ({ page, request }) => {
  await openSalon(page, request);
  const id = '00000000-0000-4000-8000-00000000a001';
  await request.post(`${FIXTURE_API}/__test/salon-loyalty`, {
    data: {
      bonusEnabled: true,
      customer: { id, firstName: 'Айгуль', phone: '+7 701 000 00 00' },
      bonusEntries: [
        { kind: 'ACCRUAL', amountMinor: 40000 },
        { kind: 'REDEEM', amountMinor: -10000 },
        { kind: 'ADJUSTMENT', amountMinor: 5000, reason: 'Подарок на день рождения' },
      ],
    },
  });
  await page.goto(`/customers/${id}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('customer-bonus-head')).toHaveText('350 ₸', { timeout: 60_000 });
  await main.getByRole('tab', { name: /Бонусы/ }).click();
  await expect(main.getByTestId('customer-bonus-balance')).toContainText('350 ₸');
  await expect(main.getByRole('row').filter({ hasText: 'Подарок на день рождения' })).toContainText('+50 ₸');
  await expect(main.getByRole('row').filter({ hasText: 'Оплата бонусами' })).toContainText('−100 ₸');
  await page.screenshot({ path: `${SHOTS}/customer-bonuses.png`, fullPage: true });
});
