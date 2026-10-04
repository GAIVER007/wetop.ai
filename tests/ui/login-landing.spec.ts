import { expect, test } from './fixtures';

/**
 * Посадочная страница после входа без явного адреса зависит от роли (ADR-146, поручение владельца
 * 02.10.2026 вместе с переименованием «Шахматка» → «Календарь»): владельца ведёт на Главную,
 * управляющего и администратора на Календарь. Явный `next` (защищённая страница, с которой человека
 * увели на вход) по-прежнему побеждает, это проверяет соседний `unified-auth.spec.ts`.
 */
const SITE = 'http://127.0.0.1:3002';
const APP = 'http://127.0.0.1:3102';
const API = 'http://127.0.0.1:4313';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function loginViaHeader(page: import('@playwright/test').Page) {
  await page.goto(`${SITE}/`);
  // Ссылка «Войти» есть и в шапке, и в скрытом телефонном меню, берём видимую в шапке
  await page.getByRole('banner').getByRole('link', { name: 'Войти', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('admin@wetop.test');
  await dialog.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
}

for (const [role, destination] of [
  ['OWNER', '/today'],
  ['MANAGER', '/chessboard'],
  ['STAFF', '/chessboard'],
] as const) {
  test(`вход без адреса назначения, роль ${role} → ${destination}`, async ({ page, request }) => {
    await request.post(`${API}/__test/control`, { data: { role } });
    // Ссылка «Войти» в шапке ведёт на «#login» без query: в адресе окна действительно нет next
    await expect(page).not.toHaveURL(/next=/);
    await loginViaHeader(page);
    await expect(page).toHaveURL(`${APP}${destination}`);
  });
}

test('явный next побеждает роль: администратор со ссылки на «Гости» остаётся на «Гости»', async ({
  page,
  request,
}) => {
  await request.post(`${API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto(`${APP}/guests`);
  await expect(page).toHaveURL(`${SITE}/?next=%2Fguests#login`);
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Почта').fill('admin@wetop.test');
  await dialog.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(`${APP}/guests`);
});
