import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { registrationEnabled: false },
  });
});

for (const path of [
  '/auth/fallback',
  '/auth/fallback?mode=register',
  '/auth/fallback?mode=register&next=%2Ftoday',
]) {
  test(`регистрация закрыта: ${path} оставляет вход сотрудников`, async ({ page, context }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
    await expect(page.getByRole('button', { name: 'Регистрация', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Создать организацию' })).toHaveCount(0);
    await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Забыли пароль?' })).toBeVisible();
    if (path !== '/auth/fallback') {
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
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { failPath: '/auth/options' },
  });
  await page.goto('/auth/fallback?mode=register');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Вход в WETOP');
  await expect(page.getByRole('button', { name: 'Регистрация', exact: true })).toHaveCount(0);
});

test('ранее открытая форма получает отказ через сервер без новой сессии', async ({
  page,
  request,
  context,
}) => {
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { registrationEnabled: true },
  });
  await page.goto('/auth/fallback?mode=register');
  await page.getByLabel('Email', { exact: true }).fill('closed@example.invalid');
  await page.getByLabel('Имя', { exact: true }).fill('Тестовый сотрудник');
  // с 21.09 форма спрашивает название отеля (обязательное поле): без него submit не уходит
  await page.getByLabel('Название отеля', { exact: true }).fill('Хостел на Абая');
  // с 29.09 — телефон и согласие с политикой (обязательные): без них submit тоже не уходит
  await page.getByLabel('Телефон', { exact: true }).fill('701 555 44 33');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-2026');
  await page.getByRole('checkbox', { name: /политикой конфиденциальности/ }).check();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { registrationEnabled: false },
  });
  await page.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Самостоятельная регистрация закрыта',
  );
  expect((await context.cookies()).some((cookie) => cookie.name === 'wetop_session')).toBe(false);
  await expect(page).toHaveURL(/\/auth\/fallback/);
});
