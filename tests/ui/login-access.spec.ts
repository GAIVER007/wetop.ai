import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
});

/**
 * Экран входа. Замок один — своя сессия: Cloudflare Access снят 20.09.2026 (ADR-053, ADR-045 отменён).
 * Способ входа выбран владельцем — почта и пароль (Q-146 закрыт). Рядом регистрация: почта, имя,
 * пароль, без письма. Входа по коду на экране больше нет; сам код остался только на пути приглашения
 * (tests/ui/invites.spec.ts). Почта из заголовка Access, если он вдруг придёт, никуда не пускает —
 * она только подставляется в поле.
 *
 * Синтетический API (`scripts/preview/fixture-api.ts`): сотрудник, пароль и код (123456) — вымышленные
 * (ADR-010). Это проверка экрана и серверных действий стойки, а не правил API: те закрыты тестами
 * контроллеров.
 */
const EMAIL = 'admin@wetop.test';
const PASSWORD = 'ui-test-parol';

test('форма входа просит почту и пароль', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
  await expect(page.getByRole('main')).toContainText(
    'Используйте почту и пароль вашей учётной записи',
  );
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('верный пароль пускает на рабочее место, «Выйти» возвращает на экран входа', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page).toHaveURL(/\/today/);

  // кто на смене — видно в меню профиля, и оттуда же выход
  await page.getByRole('button', { name: 'Меню администратора' }).click();
  const menu = page.locator('#profile-dropdown');
  await expect(menu).toContainText('Дана Тестова');
  await expect(menu).toContainText(EMAIL);
  await menu.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('неверный пароль не пускает и не говорит, что именно не так', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill('не тот пароль');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Неверная почта или пароль',
  );
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(EMAIL);
});

test('форма первой на телефоне: вход и помощь доступны без прокрутки', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await expect(page.getByRole('link', { name: 'Забыли пароль?' })).toBeInViewport({ ratio: 1 });
  const email = await page.getByLabel('Email', { exact: true }).boundingBox();
  const story = await page.locator('.login-message').boundingBox();
  expect(email!.y).toBeLessThan(story!.y);
});

test('сбой API сохраняет почту, повторный вход после восстановления работает', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await request.post('http://127.0.0.1:4311/__test/control', { data: { failPath: '/auth/login' } });
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(EMAIL);
  await request.post('http://127.0.0.1:4311/__test/control', { data: { failPath: '' } });
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
});

test('клавиатура, видимость пароля и ожидание без повторной отправки', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Пароль', { exact: true });
  await expect(email).toHaveAttribute('autocomplete', 'username');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await email.fill(EMAIL);
  await email.press('Tab');
  await expect(password).toBeFocused();
  await password.fill(PASSWORD);
  await password.press('Tab');
  const toggle = page.getByRole('button', { name: 'Показать пароль' });
  await expect(toggle).toBeFocused();
  const inputBox = await password.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(toggleBox!.y).toBeGreaterThanOrEqual(inputBox!.y);
  expect(toggleBox!.y + toggleBox!.height).toBeLessThanOrEqual(inputBox!.y + inputBox!.height);
  await toggle.press('Enter');
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Скрыть пароль' }).press('Enter');
  await expect(password).toHaveAttribute('type', 'password');

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submits = 0;
  await page.route('**/login', async (route) => {
    if (route.request().method() === 'POST') {
      submits++;
      await gate;
    }
    await route.continue();
  });
  try {
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    const pending = page.getByRole('button', { name: 'Входим…', exact: true });
    await expect(pending).toBeDisabled();
    await expect(pending).toHaveAttribute('aria-busy', 'true');
    await password.press('Enter');
    expect(submits).toBe(1);
  } finally {
    release();
  }
  await expect(page).toHaveURL(/\/today/);
});

for (const theme of ['light', 'dark'] as const) {
  test(`вход: доступность, адаптивность и reduced motion — ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const directory = 'reports/login-refresh-2026-09-19';
    mkdirSync(directory, { recursive: true });
    for (const [width, height] of [
      [320, 844],
      [375, 812],
      [390, 844],
      [768, 1024],
      [844, 390],
      [1440, 1000],
      [720, 500],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await page.goto('/login');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      for (const control of await page.locator('main input, main button, main a').all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
      }
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      if ([390, 1440].includes(width!))
        await page.screenshot({ path: `${directory}/login-${theme}-${width}.png`, fullPage: true });
    }
  });
}

test('за Cloudflare Access почта подставлена в поле, но вход всё равно спрашивают', async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ 'cf-access-authenticated-user-email': 'admin@example.invalid' });
  await page.goto('/login');
  const main = page.getByRole('main');

  await expect(main.getByLabel('Email', { exact: true })).toHaveValue('admin@example.invalid');
  await expect(main).toContainText('Cloudflare Access пропустил admin@example.invalid');
  await expect(main.getByRole('link', { name: 'Выйти из Access' })).toHaveAttribute(
    'href',
    '/cdn-cgi/access/logout',
  );
  await expect(main.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('после входа экран входа показывает, кто вошёл, и даёт открыть рабочее место', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(EMAIL);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);

  await page.goto('/login');
  const main = page.getByRole('main');
  await expect(main).toContainText('Вы вошли');
  await expect(main).toContainText('Дана Тестова');
  await expect(main.getByRole('link', { name: 'Открыть рабочее место' })).toHaveAttribute(
    'href',
    '/today',
  );
  await expect(main.getByRole('button', { name: 'Выйти' })).toBeVisible();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveCount(0);
});

// ── Регистрация (ADR-053): почта, имя, пароль — и сразу внутрь, без письма ──

test.describe('регистрация доступна по умолчанию', () => {
  test('на экране входа нет входа по коду: только пароль и кнопка регистрации', async ({
    page,
  }) => {
    await page.goto('/login');
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'Войти по коду из письма' })).toHaveCount(0);
    await expect(main.getByLabel('Код из письма')).toHaveCount(0);
    await expect(main.getByRole('button', { name: 'Регистрация' })).toBeVisible();
  });

  test('кнопка «Регистрация» открывает форму из трёх полей и возвращает назад к паролю', async ({
    page,
  }) => {
    await page.goto('/login');
    const main = page.getByRole('main');
    await main.getByRole('button', { name: 'Регистрация' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Регистрация');
    await expect(main.getByLabel('Email')).toBeVisible();
    await expect(main.getByLabel('Имя')).toBeVisible();
    await expect(main.getByLabel('Пароль', { exact: true })).toBeVisible();
    await expect(main).not.toContainText('Название организации');

    await main.getByRole('button', { name: 'Войти по паролю' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
  });

  test('/login?mode=register открывает регистрацию сразу — по этой ссылке приходят с сайта', async ({
    page,
  }) => {
    await page.goto('/login?mode=register');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Регистрация');
  });

  test('регистрация с /register: почта, имя, пароль → «подтвердите почту», без сессии', async ({
    page,
    context,
  }) => {
    await page.goto('/register');
    const main = page.getByRole('main');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Регистрация');
    await main.getByLabel('Email').fill('novyj@example.com');
    await main.getByLabel('Имя').fill('Вячеслав Петров');
    await main.getByLabel('Пароль', { exact: true }).fill('novyj-parol-2026');
    await main.getByRole('button', { name: 'Создать организацию' }).click();
    await page.waitForURL('**/login/check-email**');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('Проверьте почту');
    await expect(page.getByRole('main')).toContainText('novyj@example.com');

    // до подтверждения почты сессии нет: куки выдавать не за что (ADR-060)
    expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
  });

  test('ссылка из письма: подтверждение почты открывает рабочее место; кука HttpOnly', async ({
    page,
    context,
  }) => {
    await page.goto('/register');
    const main = page.getByRole('main');
    await main.getByLabel('Email').fill('novyj@example.com');
    await main.getByLabel('Имя').fill('Вячеслав Петров');
    await main.getByLabel('Пароль', { exact: true }).fill('novyj-parol-2026');
    await main.getByRole('button', { name: 'Создать организацию' }).click();
    await page.waitForURL('**/login/check-email**');

    // стенд выдаёт ссылки подтверждения по порядку — первой регистрации достаётся первая
    await page.goto('/login/verify?token=ui-verify-1');
    await page.getByRole('button', { name: 'Подтвердить почту и войти' }).click();
    await page.waitForURL('**/today');

    const cookie = (await context.cookies()).find((c) => c.name === 'wetop_session');
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
  });

  test('негодная ссылка подтверждения: отказ текстом на той же странице', async ({ page }) => {
    await page.goto('/login/verify?token=нет-такой-ссылки');
    await page.getByRole('button', { name: 'Подтвердить почту и войти' }).click();
    await expect(page.getByRole('alert')).toContainText('Ссылка не годится');
  });

  test('регистрация: ошибки формы приходят текстом из API и не уводят со страницы', async ({
    page,
  }) => {
    await page.goto('/register');
    const main = page.getByRole('main');

    // занятый адрес называется прямо — иначе человеку нечего ответить на вторую попытку
    await main.getByLabel('Email').fill(EMAIL);
    await main.getByLabel('Имя').fill('Вячеслав Петров');
    await main.getByLabel('Пароль', { exact: true }).fill('novyj-parol-2026');
    await main.getByRole('button', { name: 'Создать организацию' }).click();
    await expect(main.getByRole('alert')).toContainText('уже зарегистрирован');
    await expect(page).toHaveURL(/\/register/);

    // короткий пароль форма отдаёт браузеру (minLength), длину проверяет и API — берём его текст
    await main.getByLabel('Email').fill('novyj@example.com');
    await main.getByLabel('Пароль', { exact: true }).fill('korotkij1');
    await main.getByRole('button', { name: 'Создать организацию' }).click();
    await expect(page).toHaveURL(/\/register/);
  });
});
