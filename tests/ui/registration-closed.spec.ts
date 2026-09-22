import { expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { registrationEnabled: false },
  });
});

for (const path of ['/login', '/register', '/login?mode=register']) {
  test(`регистрация закрыта: ${path} оставляет вход сотрудников`, async ({ page, context }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
    await expect(page.getByRole('button', { name: 'Регистрация', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Создать организацию' })).toHaveCount(0);
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Забыли пароль?' })).toBeVisible();
    if (path !== '/login') {
      await expect(page.getByRole('main')).toContainText(
        'Самостоятельная регистрация временно закрыта',
      );
    }
    expect((await context.cookies()).some((cookie) => cookie.name === 'wetop_session')).toBe(false);
  });
}

test('ошибка настроек API закрывает регистрацию и оставляет форму входа', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { failPath: '/auth/options' },
  });
  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
  await expect(page.getByRole('button', { name: 'Регистрация', exact: true })).toHaveCount(0);
});

test('ранее открытая форма получает отказ через server action без новой сессии', async ({
  page,
  request,
  context,
}) => {
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { registrationEnabled: true },
  });
  await page.goto('/register');
  await page.getByLabel('Email', { exact: true }).fill('closed@example.invalid');
  await page.getByLabel('Имя', { exact: true }).fill('Тестовый сотрудник');
  await page.getByLabel('Название отеля').fill('Тестовый хостел');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await request.post('http://127.0.0.1:4311/__test/control', {
    data: { registrationEnabled: false },
  });
  await page.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Самостоятельная регистрация закрыта',
  );
  expect((await context.cookies()).some((cookie) => cookie.name === 'wetop_session')).toBe(false);
  await expect(page).toHaveURL(/\/register/);
});
