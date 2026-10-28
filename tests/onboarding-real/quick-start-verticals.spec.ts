import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

/**
 * Быстрый запуск гостиницы и ресторана (владелец 27.10.2026: «во всех вертикалях»): настоящая регистрация, полный
 * API на своей базе, окно с полями, одна кнопка «Создать», итоговый экран вариант А и проверка созданного.
 */
const api = 'http://127.0.0.1:55844';
const SHOTS = process.env.QUICK_SHOTS_DIR ?? 'reports/quick-start-2026-10-27';
/** название объекта в WETOP уникально: у каждого прогона своё */
const RUN = randomUUID().slice(0, 6);

async function registered(page: Page, vertical: string) {
  const email = `onboarding-quick-${randomUUID()}@example.invalid`;
  const response = await page.request.post(`${api}/auth/register`, {
    data: {
      email,
      name: 'Тестовый Владелец',
      businessName: `Бизнес ${randomUUID()}`,
      vertical,
      password: 'Onboarding-Test-2026!a',
      phoneCountry: 'KZ',
      phone: '7000000000',
      privacyAccepted: true,
    },
  });
  expect(response.ok(), `registration HTTP ${response.status()}`).toBe(true);
  const mail = await (await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)).json();
  await page.goto(mail.link);
  await page.waitForURL(/55843\/(?:register\/setup|today|onboarding)/);
  await page.goto('/register/setup');
}
async function pasteInto(page: Page, text: string) {
  await page.evaluate((data) => {
    const dt = new DataTransfer();
    dt.setData('text', data);
    document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, text);
}
async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('быстрый запуск гостиницы: номера, услуги, сотрудники, одна кнопка', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await registered(page, 'HOSPITALITY');
  // кнопку, видимую владельцу: при потоковой отрисовке в DOM бывает скрытая копия
  await page.getByRole('link', { name: 'Запустить за 5 минут', exact: true }).click();
  await expect(page).toHaveURL(/\/register\/setup\/quick$/);
  const board = page.getByTestId('quick-start');
  const go = board.getByRole('button', { name: 'Создать гостиницу', exact: true });

  await board.getByLabel('Название', { exact: true }).fill(`Pearl Hotel ${RUN}`);
  await board.getByLabel('Адрес', { exact: true }).fill('Doha, Pearl, 7');
  await board.getByLabel('Телефон', { exact: true }).fill('+974 5000 0002');

  await board.getByRole('tab', { name: /Номера/ }).click();
  await board.getByLabel('Категория', { exact: true }).first().focus();
  await pasteInto(page, 'Standard\t2\t3\t450\nFamily\t4\t2\t700');
  await expect(board.getByLabel('Категория', { exact: true })).toHaveCount(2);

  await board.getByRole('tab', { name: /Услуги/ }).click();
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByLabel('Услуга', { exact: true }).fill('Breakfast');
  await board.getByLabel('Цена', { exact: true }).fill('45');

  await board.getByRole('tab', { name: /Сотрудники/ }).click();
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByLabel('Имя', { exact: true }).fill('Nora Test');
  await board.getByLabel('Почта', { exact: true }).fill('nora.quick@gmail.ru');
  await board.getByLabel('Оклад', { exact: true }).fill('3000');
  await board.getByLabel('За уборку', { exact: true }).fill('15');
  const issues = board.getByTestId('quick-issues');
  await expect(issues).toContainText('Похоже на опечатку в почте');
  await expect(go).toBeDisabled();
  await issues.getByRole('button', { name: '→ gmail.com', exact: true }).click();
  await expect(board.getByLabel('Почта', { exact: true })).toHaveValue('nora.quick@gmail.com');
  // письма стенд отправляет только на вымышленные адреса
  await board.getByLabel('Почта', { exact: true }).fill('nora-quick@example.invalid');
  await expect(go).toBeEnabled();
  await noSideScroll(page);
  await page.screenshot({ path: `${SHOTS}/quick-hotel-ready-1280.png` });

  await go.click();
  const done = page.getByTestId('quick-done');
  await expect(done).toBeVisible({ timeout: 120_000 });
  await expect(done.getByRole('heading', { name: `Pearl Hotel ${RUN} готова к работе`, exact: true })).toBeVisible();
  await expect(done.getByRole('region', { name: 'Номера' })).toContainText('Family');
  await expect(done.getByRole('region', { name: 'Команда' })).toContainText('Nora Test');
  // почта приглашений в стенде не настроена: создание не отменяется, владелец видит, кому письмо не ушло
  await expect(done.getByRole('region', { name: 'Команда' })).toContainText('не отправлено');
  await expect(done.getByRole('status')).toContainText('nora-quick@example.invalid');
  await expect(done.getByRole('region', { name: 'Услуги и оплата' })).toContainText('Breakfast');
  await noSideScroll(page);
  await page.screenshot({ path: `${SHOTS}/quick-hotel-done-1280.png`, fullPage: true });

  // созданное видно в рабочих экранах: шахматка с номерами, команда с сотрудником
  await page.goto('/chessboard');
  await expect(page.getByRole('button', { name: 'Standard 0/3' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Family 0/2' })).toBeVisible();
  await page.goto('/payroll');
  await expect(page.getByRole('main').getByText('Nora Test', { exact: true }).first()).toBeVisible();
});

test('быстрый запуск ресторана: столы, меню, сотрудники, одна кнопка', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await registered(page, 'FOOD_SERVICE');
  // кнопку, видимую владельцу: при потоковой отрисовке в DOM бывает скрытая копия
  await page.getByRole('link', { name: 'Запустить за 5 минут', exact: true }).click();
  await expect(page).toHaveURL(/\/register\/setup\/quick$/);
  const board = page.getByTestId('quick-start');
  const go = board.getByRole('button', { name: 'Создать ресторан', exact: true });

  await board.getByLabel('Название', { exact: true }).fill(`Sea Grill ${RUN}`);
  await board.getByLabel('Адрес', { exact: true }).fill('Doha, Corniche, 3');

  await board.getByRole('tab', { name: /Столы/ }).click();
  await board.getByLabel('Зал', { exact: true }).first().focus();
  await pasteInto(page, 'Hall\t1\t4\nHall\t2\t2\nTerrace\tT1\t6');
  await expect(board.getByLabel('Стол', { exact: true })).toHaveCount(3);

  await board.getByRole('tab', { name: /Меню/ }).click();
  await board.getByLabel('Раздел', { exact: true }).first().focus();
  await pasteInto(page, 'Kitchen\tGrilled fish\t85\nKitchen\tSoup\t30');
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByLabel('Раздел', { exact: true }).nth(2).fill('Drinks');
  await board.getByLabel('Блюдо', { exact: true }).nth(2).fill('Lemonade');
  await board.getByLabel('Цена', { exact: true }).nth(2).fill('18');
  await board.getByLabel('Готовит', { exact: true }).nth(2).selectOption('BAR');

  await board.getByRole('tab', { name: /Сотрудники/ }).click();
  await board.getByRole('button', { name: '+ Добавить строку', exact: true }).click();
  await board.getByLabel('Имя', { exact: true }).fill('Omar Test');
  await board.getByLabel('Почта', { exact: true }).fill('omar-quick@example.invalid');
  await board.getByLabel('Зарплата', { exact: true }).selectOption('FIXED_PLUS_PERCENT');
  await board.getByLabel('Оклад', { exact: true }).fill('2500');
  await board.getByLabel('Процент', { exact: true }).fill('5');

  await expect(go).toBeEnabled();
  await noSideScroll(page);
  await page.screenshot({ path: `${SHOTS}/quick-food-ready-1280.png` });
  await go.click();
  const done = page.getByTestId('quick-done');
  await expect(done).toBeVisible({ timeout: 120_000 });
  await expect(done.getByRole('heading', { name: `Sea Grill ${RUN} готов к работе`, exact: true })).toBeVisible();
  await expect(done.getByRole('region', { name: 'Меню' })).toContainText('Lemonade');
  await expect(done.getByRole('region', { name: 'Залы и оплата' })).toContainText('Terrace');
  await expect(done.getByRole('region', { name: 'Команда' })).toContainText('2 500');
  await noSideScroll(page);
  await page.screenshot({ path: `${SHOTS}/quick-food-done-1280.png`, fullPage: true });

  // создано в рабочих экранах: меню и сотрудники
  await page.goto('/menu');
  await expect(page.getByRole('main').getByText('Grilled fish', { exact: true }).first()).toBeVisible();
  await page.goto('/employees');
  await expect(page.getByRole('main').getByText('Omar Test', { exact: true }).first()).toBeVisible();
});
