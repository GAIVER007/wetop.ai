import { FIXTURE_API, expect, test } from './fixtures';

/**
 * Приглашение и сброс пароля (DATA_MODEL §13.8, ADR-049, решение владельца 15.09.2026 — письма через
 * сервис отправки). Сотрудник задаёт пароль сам по одноразовой ссылке из письма; владелец его не знает.
 *
 * Токены и сотрудник — из фикстуры интерфейса, вымышленные (ADR-010). Живой отправки писем в проверках нет:
 * её нельзя проверить без ключа, поэтому здесь проверяется всё, что видит человек.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('«Забыли пароль?» с экрана входа ведёт к форме и не выдаёт, есть ли такая почта', async ({
  page,
}) => {
  await page.goto('/auth/fallback');
  await page.getByRole('link', { name: 'Забыли пароль?' }).click();

  await expect(page).toHaveURL(/\/login\/reset/);
  await page.getByLabel('Email', { exact: true }).fill('nobody@example.invalid');
  await page.getByRole('button', { name: 'Прислать ссылку' }).click();

  const main = page.getByRole('main');
  await expect(main).toContainText('Если такая почта есть в системе');
  await expect(main).toContainText('24 часа');
});

test('по ссылке из письма сотрудник задаёт пароль сам и входит с ним', async ({ page }) => {
  await page.goto('/login/set-password?token=ui-reset-token');
  await page.getByLabel('Пароль', { exact: true }).fill('zhanga-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('zhanga-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();

  await expect(page).toHaveURL('http://127.0.0.1:3002/?next=%2Ftoday&password=set#login');
  await expect(page.getByRole('dialog')).toContainText('Пароль сохранён');

  await page.getByLabel('Почта', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('zhanga-parol-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/today/);
});

test('второй раз та же ссылка не работает', async ({ page }) => {
  await page.goto('/login/set-password?token=ui-reset-token');
  await page.getByLabel('Пароль', { exact: true }).fill('zhanga-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('zhanga-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/?next=%2Ftoday&password=set#login');

  await page.goto('/login/set-password?token=ui-reset-token');
  await page.getByLabel('Пароль', { exact: true }).fill('basqa-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('basqa-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('уже использована');
});

test('просроченная ссылка говорит, что делать', async ({ page }) => {
  await page.goto('/login/set-password?token=ui-reset-expired');
  await page.getByLabel('Пароль', { exact: true }).fill('zhanga-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('zhanga-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('Срок ссылки истёк');
});

test('разные пароли в двух полях не отправляются в API', async ({ page }) => {
  await page.goto('/login/set-password?token=ui-reset-token');
  await page.getByLabel('Пароль', { exact: true }).fill('zhanga-parol-2026');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('basqa-parol-2026');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('не совпадают');
});

test('короткий пароль отклоняется с объяснением', async ({ page }) => {
  await page.goto('/login/set-password?token=ui-reset-token');
  await page.getByLabel('Пароль', { exact: true }).fill('12345678');
  await page.getByLabel('Пароль ещё раз', { exact: true }).fill('12345678');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();

  await expect(page.getByRole('main').getByRole('alert')).toContainText('короче 10 символов');
});

test('ссылка без ключа объясняет, а не молчит', async ({ page }) => {
  await page.goto('/login/set-password');
  const main = page.getByRole('main');
  await expect(main).toContainText('Ссылка неполная');
  await expect(main.getByRole('link', { name: 'Прислать новую ссылку' })).toHaveAttribute(
    'href',
    '/login/reset',
  );
});

test('журнал показывает, кто сделал действие, и где система', async ({ page }) => {
  await page.goto('/journal');
  const rows = page.getByTestId('journal-row');

  await expect(page.getByRole('columnheader', { name: 'Кто' })).toBeVisible();
  await expect(rows.first()).toContainText('Дана Тестова');
  await expect(rows.first()).toContainText('заселение');

  // строка без автора — это импорт, сторож или скрипт сверки
  await expect(rows.nth(2)).toContainText('система');
});

test('в журнале есть отбор по сотрудникам, и вход в систему там виден', async ({ page }) => {
  await page.goto('/journal?type=user');
  await expect(page.getByTestId('journal-row').first()).toContainText('вход в систему');
});
