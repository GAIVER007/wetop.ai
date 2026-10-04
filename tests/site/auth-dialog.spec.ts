import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Окно входа и создания аккаунта на главной (plans/site-auth-dialog-tour-2026-09-27.md, ADR-100). Владелец 27.09.2026:
 * «Войти» не должно уводить на app.wetop.ai/login, «Оставить заявку» — открывать регистрацию, а не раздел «Как начать».
 *
 * Стойки в этом наборе нет: ответы `app.wetop.ai/api/site-auth/*` подменяются. Что стойка делает с запросом (источник,
 * кука, тексты API), проверяет `apps/web/src/lib/site-auth.test.ts`.
 */
const APP = 'https://app.wetop.ai';
const SITE_ORIGIN = 'http://127.0.0.1:4320';

type Calls = { path: string; body: unknown; credentials: boolean }[];

async function mockDesk(
  page: Page,
  handlers: Partial<
    Record<
      'options' | 'login' | 'register' | 'resend' | 'session',
      (body: unknown) => { status: number; body: unknown }
    >
  >,
): Promise<Calls> {
  const calls: Calls = [];
  await page.route(`${APP}/api/site-auth/*`, async (route: Route) => {
    const request = route.request();
    const action = new URL(request.url()).pathname.split('/').pop() as keyof typeof handlers;
    const cors = {
      'access-control-allow-origin': SITE_ORIGIN,
      'access-control-allow-credentials': 'true',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = request.postDataJSON?.() ?? null;
    calls.push({ path: action, body, credentials: true });
    const handler = handlers[action];
    const result = handler ? handler(body) : { status: 404, body: { message: 'Не найдено' } };
    return route.fulfill({ status: result.status, headers: cors, json: result.body });
  });
  // Переход в стойку после входа — страница-заглушка вместо настоящей стойки
  await page.route(`${APP}/today`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<h1>Стойка: Главная</h1>',
    }),
  );
  return calls;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
});

test('несохранённая сессия не запускает круг переходов', async ({ page }) => {
  await mockDesk(page, {
    options: () => ({ status: 200, body: { registrationEnabled: true } }),
    login: () => ({ status: 200, body: { next: '/today' } }),
    session: () => ({ status: 200, body: { authenticated: false } }),
  });
  await page.goto('/#login');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('test@example.invalid');
  await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Браузер не сохранил сессию');
  await expect(page).toHaveURL(`${SITE_ORIGIN}/#login`);
});

test('«Войти» открывает окно на главной, вход ведёт прямо в стойку', async ({ page }) => {
  const calls = await mockDesk(page, {
    options: () => ({ status: 200, body: { registrationEnabled: true } }),
    login: () => ({ status: 200, body: { next: '/today' } }),
    session: () => ({ status: 200, body: { authenticated: true } }),
  });
  await page.goto('/');
  await page.locator('.site-header').getByRole('link', { name: 'Войти', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Вход и регистрация в WETOP' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(`${SITE_ORIGIN}/`); // остались на главной
  await expect(dialog.getByRole('heading', { name: 'Вход в WETOP' })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Вход' })).toHaveAttribute('aria-selected', 'true');
  await page.waitForTimeout(300); // окно появляется за 180 мс
  await page.screenshot({ path: 'test-results/site-auth-1-login.png' });

  await dialog.getByLabel('Почта').fill('dana@example.invalid');
  await dialog.getByLabel('Пароль', { exact: true }).fill('parol-dlya-testa');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();

  await page.waitForURL(`${APP}/today`);
  await expect(page.getByRole('heading', { name: 'Стойка: Главная' })).toBeVisible();
  expect(calls.find((c) => c.path === 'login')?.body).toEqual({
    email: 'dana@example.invalid',
    password: 'parol-dlya-testa',
    next: '/today',
  });
});

test('неверный пароль — текст стойки в окне, человек остаётся на главной', async ({ page }) => {
  await mockDesk(page, {
    options: () => ({ status: 200, body: { registrationEnabled: true } }),
    login: () => ({ status: 401, body: { message: 'Неверная почта или пароль' } }),
  });
  await page.goto('/');
  await page.locator('.site-header').getByRole('link', { name: 'Войти', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('dana@example.invalid');
  await dialog.getByLabel('Пароль', { exact: true }).fill('ne-tot');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Неверная почта или пароль');
  await expect(page).toHaveURL(`${SITE_ORIGIN}/`);
});

test('стойка недоступна — окно говорит об этом и даёт ссылку на отдельную страницу', async ({
  page,
}) => {
  await page.route(`${APP}/api/site-auth/*`, (route) => route.abort('connectionrefused'));
  await page.goto('/');
  await page.locator('.site-header').getByRole('link', { name: 'Войти', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('dana@example.invalid');
  await dialog.getByLabel('Пароль', { exact: true }).fill('parol-dlya-testa');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  const alert = dialog.getByRole('alert');
  await expect(alert).toContainText('Нет связи с сервером');
  await expect(alert.getByRole('link', { name: 'Открыть на отдельной странице' })).toHaveAttribute(
    'href',
    `${APP}/auth/fallback`,
  );
});

test('«Получить доступ» при открытой регистрации открывает форму, после отправки — «Проверьте почту» и повтор письма', async ({
  page,
}) => {
  const calls = await mockDesk(page, {
    options: () => ({ status: 200, body: { registrationEnabled: true } }),
    register: (body) => ({
      status: 200,
      body: { email: (body as { email: string }).email, sent: true },
    }),
    resend: () => ({ status: 200, body: { ok: true } }),
  });
  await page.goto('/');
  await page
    .locator('.hero')
    .getByRole('link', { name: /Получить доступ/ })
    .click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Новый аккаунт' })).toBeVisible();
  await expect(dialog).not.toContainText(/14\sдней\sбесплатно|карта\sне\sнужна|пробн/i);
  await expect(page).toHaveURL(`${SITE_ORIGIN}/`); // не раздел «Как начать»
  await page.waitForTimeout(300); // окно появляется за 180 мс
  await page.screenshot({ path: 'test-results/site-auth-2-register.png' });

  await dialog.getByLabel('Имя').fill('Дана Тестова');
  await dialog.getByLabel('Название бизнеса').fill('Тестовый бизнес');
  // страна кода — явно: иначе она зависит от пояса и языка браузера, на котором гоняют тест
  await dialog.getByLabel('Код страны').selectOption('KZ');
  await dialog.getByLabel('Телефон').fill('701 555 44 33');
  await dialog.getByLabel('Почта').fill('dana@example.invalid');
  await dialog.getByLabel('Пароль', { exact: true }).fill('parol-dlya-testa');
  await expect(dialog.getByRole('link', { name: 'политикой конфиденциальности' })).toHaveAttribute(
    'href',
    '/privacy/',
  );
  // без согласия с политикой форма не уходит и говорит, что отметить
  await dialog.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('согласие с политикой конфиденциальности');
  expect(calls.find((c) => c.path === 'register')).toBeUndefined();
  await dialog.getByRole('checkbox', { name: /политикой конфиденциальности/ }).check();
  await dialog.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();

  await expect(dialog.getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
  await expect(dialog).toContainText('dana@example.invalid');
  await expect(dialog).toContainText('настройка бизнеса');
  expect(calls.find((c) => c.path === 'register')?.body).toEqual({
    email: 'dana@example.invalid',
    name: 'Дана Тестова',
    businessName: 'Тестовый бизнес',
    vertical: 'HOSPITALITY',
    password: 'parol-dlya-testa',
    phoneCountry: 'KZ',
    phone: '701 555 44 33',
    privacyAccepted: true,
  });
  // повтор письма — не чаще раза в минуту: сразу после отправки кнопка ждёт
  const resend = dialog.getByRole('button', { name: /Ещё раз — через \d+ с/ });
  await expect(resend).toBeDisabled();
  await page.waitForTimeout(300); // окно появляется за 180 мс
  await page.screenshot({ path: 'test-results/site-auth-3-sent.png' });
});

test('регистрация закрыта (до RLS, ADR-102) — окно зовёт написать, форму не показывает', async ({
  page,
}) => {
  await mockDesk(page, { options: () => ({ status: 200, body: { registrationEnabled: false } }) });
  await page.goto('/#register');
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Регистрация временно недоступна' }),
  ).toBeVisible();
  await expect(dialog).not.toContainText(/14\sдней|заведём аккаунт/i);
  await expect(dialog.getByLabel('Пароль', { exact: true })).toHaveCount(0);
});

test('#login в адресе открывает окно; Escape закрывает и убирает метку из адреса', async ({
  page,
}) => {
  await mockDesk(page, { options: () => ({ status: 200, body: { registrationEnabled: true } }) });
  await page.goto('/#login');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Вход в WETOP' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(`${SITE_ORIGIN}/`);
});

test('на телефоне окно открывается из меню и не шире экрана', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDesk(page, { options: () => ({ status: 200, body: { registrationEnabled: true } }) });
  await page.goto('/');
  await page.getByRole('button', { name: 'Меню' }).click();
  await page.locator('#mobile-menu-panel').getByRole('link', { name: 'Получить доступ' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Новый аккаунт' })).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  const overflow = await page.evaluate('document.documentElement.scrollWidth - window.innerWidth');
  expect(overflow).toBeLessThanOrEqual(1);
  await page.waitForTimeout(300); // окно появляется за 180 мс
  await page.screenshot({ path: 'test-results/site-auth-4-mobile.png' });
});

/** Снимки окна регистрации 29.09.2026 для визуального «да» владельца — `reports/registration-v2-2026-09-29/` */
test('снимки окна регистрации: светлая и тёмная, 1440 и 390', async ({ page }) => {
  await mockDesk(page, { options: () => ({ status: 200, body: { registrationEnabled: true } }) });
  const report = 'reports/mv2-registration-2026-10-04/screenshots';
  mkdirSync(report, { recursive: true });
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto('/#register');
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'Новый аккаунт' })).toBeVisible();
      await dialog.getByLabel('Имя').fill('Дана Тестова');
      await dialog.getByLabel('Название бизнеса').fill('Тестовый бизнес');
      await dialog.getByLabel('Код страны').selectOption('KZ');
      await dialog.getByLabel('Телефон').fill('701 555 44 33');
      await page.waitForTimeout(300);
      const axe = await new AxeBuilder({ page }).include('.auth-dialog').analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      const radio = page.locator('input[name="vertical"][value="HOSPITALITY"]');
      await radio.focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('input[name="vertical"][value="BEAUTY"]')).toBeChecked();
      await page.reload();
      await expect(page.locator('input[name="vertical"][value="BEAUTY"]')).toBeChecked();
      await page.screenshot({
        path: `${report}/site-register-${theme}-${width}.png`,
        caret: 'initial',
      });
    }
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/privacy/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Политика конфиденциальности' }),
  ).toBeVisible();
  // Разделы, которых требует закон РК «О персональных данных и их защите»: кто оператор, где хранятся данные и
  // трансграничная передача, данные гостей по поручению гостиницы, права субъекта и куда жаловаться, cookie.
  for (const section of [
    'Кто обрабатывает данные',
    'Трансграничная передача',
    'Данные гостей гостиницы',
    'Как мы защищаем данные',
    'Ваши права',
    'Cookie',
  ])
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(section) })).toBeVisible();
  await expect(page.getByRole('link', { name: 'zapoinov@bk.ru' }).first()).toBeVisible();
  await page.screenshot({
    path: `${report}/site-privacy-light-1440.png`,
    fullPage: true,
    caret: 'initial',
  });
});

for (const vertical of ['BEAUTY', 'FOOD_SERVICE']) {
  test(`MV2 selector preselects ${vertical} without granting pilot access`, async ({ page }) => {
    const calls = await mockDesk(page, {
      options: () => ({ status: 200, body: { registrationEnabled: true } }),
      register: () => ({
        status: 403,
        body: { message: 'Направление пока доступно только участникам пилота' },
      }),
    });
    await page.goto(`/?vertical=${vertical}#register`);
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator(`input[name="vertical"][value="${vertical}"]`)).toBeChecked();
    await expect(dialog.getByText('Подключение по приглашению', { exact: true })).toBeVisible();
    await dialog.getByLabel('Имя', { exact: true }).fill('Мария Тестова');
    await dialog.getByLabel('Название бизнеса').fill('Тестовый пилот');
    await dialog.getByLabel('Почта', { exact: true }).fill('pilot@example.invalid');
    await dialog.getByLabel('Пароль', { exact: true }).fill('synthetic-password-2026');
    await dialog.getByLabel('Телефон').fill('7015554433');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('только участникам пилота');
    expect(calls.find((call) => call.path === 'register')?.body).toMatchObject({
      vertical,
      businessName: 'Тестовый пилот',
    });
  });
}
