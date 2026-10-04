import { FIXTURE_API, expect, test } from './fixtures';

test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

/**
 * «Где я вошёл» и «выйти везде» (срез 13, §3 п. 3; DATA_MODEL §13.5). Синтетический API
 * (`scripts/preview/fixture-api.ts`) принимает код 123456 и отдаёт две живые сессии: эту и телефон.
 * Проверка экрана и серверных действий стойки; правила API закрыты тестами контроллера.
 */
async function login(page: import('@playwright/test').Page) {
  await page.goto('/auth/fallback');
  const main = page.getByRole('main');
  await main.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await main.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await main.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('вошедший видит, где он вошёл, — устройство словами и пометку своего сеанса', async ({
  page,
}) => {
  await login(page);
  await page.goto('/profile/access');
  const main = page.getByRole('main');
  const list = main.getByTestId('session-list');
  await expect(list).toContainText('Chrome, macOS');
  await expect(list).toContainText('Safari, iPhone');
  await expect(list).toContainText('этот сеанс');
  await expect(list.locator('li')).toHaveCount(2);
  // ни ключей, ни сырых строк агента
  await expect(list).not.toContainText('Mozilla');
});

test('«Завершить все сеансы» гасит вход и возвращает форму; куки больше нет', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/profile/access');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await page.waitForURL('http://127.0.0.1:3002/?next=%2Ftoday#login');
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
});

/**
 * Эта проверка пришла из приёмки 20.09.2026 в другом виде: она заводила сеанс через `/auth/verify`
 * и держала обещание «старые сессии по коду не отозваны переходом на пароль». Маршрута больше нет —
 * вход по коду снят целиком, вместе со вторым отпечатком ключа в замке. Обещание с ним и кончилось:
 * сессия, выписанная кодом, после обновления сервера перестанет опознаваться.
 *
 * Почему это принято, а не спрятано: в рабочей базе таких сессий нет и быть не могло — почтовая
 * служба не настроена ни разу (MAIL_* пусты), код никому не уходил, а база обнулена 19.09.2026.
 * Держать в замке второй отпечаток ради сессий, которых не существует, — это мёртвый код в самом
 * чувствительном месте. Проверяем то, что у людей действительно есть: сеанс по паролю переживает
 * перезагрузку страницы и гасится «Завершить все сеансы».
 */
test('выписанный ранее сеанс по паролю продолжает работать и гасится «Завершить все сеансы»', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/chessboard');
  await expect(page.getByRole('main')).toBeVisible();
  await page.goto('/profile/access');
  const main = page.getByRole('main');
  await expect(main.getByTestId('session-list')).toContainText('этот сеанс');
  await main.getByRole('button', { name: 'Завершить все сеансы' }).click();
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  expect((await context.cookies()).find((c) => c.name === 'wetop_session')).toBeUndefined();
});

test('удалённый вход по коду не выдаёт сессию; неизвестная старая cookie не открывает профиль', async ({
  page,
  request,
  context,
}) => {
  // Вход по коду снят в main по ADR-053. Проверяем отсутствие старого пути, а не возвращаем его в fixture.
  for (const path of ['/auth/code', '/auth/verify']) {
    const response = await request.post(`${FIXTURE_API}${path}`, {
      headers: { 'x-wetop-test-client': '1' },
      data: { email: 'legacy@example.invalid', code: '123456' },
    });
    expect(response.status()).toBe(404);
  }
  await context.addCookies([
    {
      name: 'wetop_session',
      value: 'retired-synthetic-session',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);
  await page.goto('/auth/fallback');
  const main = page.getByRole('main');
  await expect(main.getByTestId('session-list')).toHaveCount(0);
  await expect(main.getByLabel('Пароль', { exact: true })).toBeVisible();
});

test('без сессии списка сеансов нет', async ({ page }) => {
  await page.goto('/auth/fallback');
  const main = page.getByRole('main');
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible();
  await expect(main.getByTestId('session-list')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Завершить все сеансы' })).toHaveCount(0);
});

test('кука сессии выписывается заново при работе: срок отсчитывается от последней страницы', async ({
  page,
  context,
}) => {
  await login(page);
  const seen = async () =>
    (await context.cookies()).find((c) => c.name === 'wetop_session')!.expires;
  const first = await seen();
  expect(first).toBeGreaterThan(0);
  // на сервере срок сессии двигает сама работа (§13.5); в браузере — эта же кука с новым сроком
  await page.waitForTimeout(1100);
  await page.goto('/chessboard');
  await expect(page.getByRole('main').getByTestId('unit-row').first()).toBeVisible();
  expect(await seen()).toBeGreaterThan(first);
  const cookie = (await context.cookies()).find((c) => c.name === 'wetop_session')!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe('Lax');
});
