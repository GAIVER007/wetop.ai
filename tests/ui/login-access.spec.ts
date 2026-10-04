import { FIXTURE_API, expect, test, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

const SITE = 'http://127.0.0.1:3002';
const APP = 'http://127.0.0.1:3100';
const API = FIXTURE_API;
// ADR-131: прежние проверки формы перенесены на реальную главную, не на заменитель /login.
test.beforeEach(async ({ request }) => {
  await request.post(API + '/__test/reset');
});
const dialog = (page: Page) => page.getByRole('dialog');
async function fillLogin(page: Page, password = 'ui-test-parol') {
  await dialog(page).getByLabel('Почта').fill('admin@wetop.test');
  await dialog(page).getByLabel('Пароль', { exact: true }).fill(password);
}
async function fillRegister(page: Page, email = 'new@example.invalid') {
  const form = dialog(page);
  await form.getByLabel('Почта').fill(email);
  await form.getByLabel('Имя', { exact: true }).fill('Тестовый Пользователь');
  await form.getByLabel('Название бизнеса').fill('Тестовый объект');
  await form.getByLabel('Код страны').selectOption('KZ');
  await form.getByLabel('Телефон', { exact: true }).fill('7015554433');
  await form.getByLabel('Пароль', { exact: true }).fill('synthetic-password');
  await form.getByRole('checkbox').check();
  await expect(form.getByLabel('Почта')).toHaveValue(email);
  await expect(form.getByLabel('Имя', { exact: true })).toHaveValue('Тестовый Пользователь');
  await expect(form.getByLabel('Название бизнеса')).toHaveValue('Тестовый объект');
  await expect(form.getByLabel('Телефон', { exact: true })).toHaveValue('7015554433');
  await expect(form.getByLabel('Пароль', { exact: true })).toHaveValue('synthetic-password');
}
test('главная просит почту и пароль, без второго рекламного экрана', async ({ page }) => {
  await page.goto('/login');
  await expect(dialog(page).getByRole('heading', { name: 'Вход в WETOP' })).toBeVisible();
  await expect(dialog(page).getByLabel('Пароль', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await expect(dialog(page).getByLabel('Почта')).toHaveAttribute('autocomplete', 'username');
  await expect(page.locator('.login-story')).toHaveCount(0);
});
test('верный пароль открывает рабочее место, выход возвращает форму главной', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page);
  await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(APP + '/today');
  // клик до гидратации шапки теряется (меню не открывается): повторяем, пока меню не раскрыто
  const profile = page.getByRole('button', { name: 'Меню администратора' });
  await expect(async () => {
    if ((await profile.getAttribute('aria-expanded')) !== 'true') await profile.click();
    await expect(profile).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
  await page.locator('#profile-dropdown').getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(SITE + '/?next=%2Ftoday#login');
});
test('неверный пароль остаётся в форме без раскрытия существования аккаунта', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page, 'wrong-password');
  await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toHaveText('Неверная почта или пароль');
  await expect(dialog(page).getByLabel('Почта')).toHaveValue('admin@wetop.test');
});
test('сбой API сохраняет поля, повтор после восстановления работает', async ({ page, request }) => {
  await page.goto('/login');
  await fillLogin(page);
  await request.post(API + '/__test/control', { data: { failPath: '/auth/login' } });
  await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog(page).getByRole('alert')).toBeVisible();
  await expect(dialog(page).getByLabel('Почта')).toHaveValue('admin@wetop.test');
  await request.post(API + '/__test/control', { data: { failPath: '' } });
  await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(APP + '/today');
});
test('клавиатура, показ пароля и блокировка повторной отправки', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page);
  const password = dialog(page).getByLabel('Пароль', { exact: true });
  await dialog(page).getByLabel('Почта').press('Tab');
  await expect(password).toBeFocused();
  await password.press('Tab');
  await expect(dialog(page).getByRole('button', { name: 'Показать пароль' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await dialog(page).getByRole('button', { name: 'Скрыть пароль' }).click();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submits = 0;
  await page.route(APP + '/api/site-auth/login', async (route) => {
    if (route.request().method() === 'POST') {
      submits++;
      await wait;
    }
    await route.continue();
  });
  try {
    await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(dialog(page).getByRole('button', { name: /Входим/ })).toBeDisabled();
    await password.press('Enter');
    expect(submits).toBe(1);
  } finally {
    release();
  }
  await expect(page).toHaveURL(APP + '/today');
});
for (const theme of ['light', 'dark'] as const) {
  test('доступность формы и адаптивность — ' + theme, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/login');
      await expect(dialog(page)).toBeVisible();
      expect(
        await page.evaluate('document.documentElement.scrollWidth - innerWidth'),
      ).toBeLessThanOrEqual(1);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(result.violations.map((v) => v.id)).toEqual([]);
    }
  });
}
test('заголовок прежнего Cloudflare Access не подставляет почту и не авторизует', async ({
  page,
  context,
}) => {
  await page.setExtraHTTPHeaders({
    'cf-access-authenticated-user-email': 'synthetic@example.invalid',
  });
  await page.goto('/login');
  await expect(dialog(page).getByLabel('Почта')).toHaveValue('');
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
});
test('сеансы открываются в профиле, команда в «Сотрудниках», не на входе', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page);
  await dialog(page).getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(APP + '/today');
  await page.goto('/profile/access');
  await expect(
    page.getByRole('heading', { name: 'Управление доступом', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('session-list')).toBeVisible();
  // команда с 02.10.2026 в разделе «Сотрудники» (TEAM1), в профиле только личные сеансы
  await expect(page.getByTestId('team')).toHaveCount(0);
  await page.goto('/team');
  await expect(page.getByTestId('member-row').first()).toBeVisible();
});
test('вкладки входа и регистрации переключаются без перехода в приложение', async ({ page }) => {
  await page.goto('/login');
  await dialog(page).getByRole('tab', { name: 'Получить доступ' }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Новый аккаунт' })).toBeVisible();
  await expect(
    dialog(page).getByRole('link', { name: 'политикой конфиденциальности' }),
  ).toHaveAttribute('href', '/privacy/');
  await dialog(page).getByRole('tab', { name: 'Вход', exact: true }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Вход в WETOP' })).toBeVisible();
});
test('старая ссылка mode=register открывает регистрацию на главной', async ({ page }) => {
  await page.goto('/login?mode=register');
  await expect(dialog(page).getByRole('heading', { name: 'Новый аккаунт' })).toBeVisible();
  await expect(page).toHaveURL(SITE + '/?next=%2Ftoday#register');
});
test('до подтверждения письма сессии нет; ссылка подтверждает и создаёт HttpOnly cookie', async ({
  page,
  context,
}) => {
  await page.goto('/register');
  await fillRegister(page);
  await dialog(page).getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(dialog(page).getByRole('heading', { name: 'Проверьте почту' })).toBeVisible();
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
  await page.goto('/login/verify?token=ui-verify-1');
  await expect(page).toHaveURL(APP + '/today');
  expect((await context.cookies(APP)).find((c) => c.name === 'wetop_session')?.httpOnly).toBe(true);
});
test('негодная ссылка подтверждения показывает отказ и возможность повтора', async ({ page }) => {
  await page.goto('/login/verify?token=invalid-synthetic');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Ссылка не годится');
  await expect(page.getByRole('button', { name: 'Подтвердить ещё раз' })).toBeVisible();
});
test('без согласия регистрация не отправляется, неверный телефон отклоняется', async ({ page }) => {
  await page.goto('/register');
  await fillRegister(page);
  await dialog(page).getByRole('checkbox').uncheck();
  await dialog(page).getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('согласие');
  await dialog(page).getByRole('checkbox').check();
  await dialog(page).getByLabel('Телефон').fill('70155');
  await dialog(page).getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('Проверьте телефон');
});
test('занятая почта и короткий пароль не создают сессию', async ({ page, context }) => {
  await page.goto('/register');
  await fillRegister(page, 'admin@wetop.test');
  await dialog(page).getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('уже зарегистрирован');
  await dialog(page).getByLabel('Почта').fill('new@example.invalid');
  await dialog(page).getByLabel('Пароль', { exact: true }).fill('short');
  await dialog(page).getByRole('button', { name: 'Создать аккаунт' }).click();
  await expect(dialog(page).getByRole('alert')).toContainText('короче 10');
  expect((await context.cookies(APP)).some((c) => c.name === 'wetop_session')).toBe(false);
});
