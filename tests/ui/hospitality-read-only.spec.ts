import { FIXTURE_API, expect, test, type Page } from './fixtures';

const main = (page: Page) => page.getByRole('main').filter({ visible: true });

test.beforeEach(async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { orgTrialDays: 'ended' } });
});

test('H-01: календарь сохраняет чтение и навигацию, но не предлагает команды записи', async ({
  page,
}) => {
  await page.goto('/chessboard');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main(page).getByRole('link', { name: 'Новая бронь', exact: true })).toHaveCount(0);

  const stay = page.getByTestId('stay-cell').first();
  await expect(stay).toBeVisible();
  await expect(stay).not.toHaveAttribute('draggable', 'true');
  await stay.click();
  const preview = page.getByTestId('stay-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('link', { name: 'Открыть бронь', exact: true })).toBeVisible();
  await expect(
    preview.getByRole('button', { name: /Заселить|Выселить|Оплата \/ возврат/ }),
  ).toHaveCount(0);
  await expect(page.locator('.board-stay-resize')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Убрано|Проверено|Требует уборки/ })).toHaveCount(
    0,
  );
});

test('H-01: прямые страницы брони и ячейки не показывают формы записи', async ({ page }) => {
  await page.goto('/reservations/new');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main(page).locator('form')).toHaveCount(0);
  await expect(main(page).getByRole('link', { name: /Брони|Вернуться/ })).toBeVisible();

  await page.goto('/reservations/20260913-TEST1');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(page.getByTestId('reservation-actions')).toHaveCount(0);
  await expect(page.locator('[data-testid^="guests-form-"], input[name="adults"], input[name="children"]')).toHaveCount(0);
  await expect(main(page).getByRole('navigation', { name: 'Печатные формы' })).toBeVisible();

  await page.goto('/units/R02');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(page.getByTestId('unit-stays')).toBeVisible();
  await expect(page.getByTestId('housekeeping-panel')).toHaveCount(0);
  await expect(page.getByTestId('block-form')).toHaveCount(0);
});

test('H-01: фонд и Bar оставляют просмотр без редакторов и submit-команд', async ({ page }) => {
  await page.goto('/inventory');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main(page).getByRole('button', { name: 'Добавить номер', exact: true })).toHaveCount(
    0,
  );
  await expect(main(page).getByRole('link', { name: 'Календарь', exact: true })).toBeVisible();
  await expect(main(page).getByRole('button', { name: /Переименовать|Редактировать/ })).toHaveCount(
    0,
  );

  await page.goto('/bar');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(main(page).getByRole('link', { name: 'Добавить товар' })).toHaveCount(0);
  await expect(main(page).getByRole('button', { name: 'Продать', exact: true })).toHaveCount(0);
  await expect(main(page).getByRole('table', { name: 'Товары и остатки бара' })).toBeVisible();

  await page.goto('/bar/receipts');
  await expect(main(page).getByRole('link', { name: /Новый приход|Добавить приход/ })).toHaveCount(
    0,
  );
  await expect(main(page).getByRole('table', { name: 'Приходы бара' })).toBeVisible();
});

test('H-01: Channels оставляет события доступными для чтения, но закрывает exchange и retry', async ({
  page,
}) => {
  await page.goto('/channels/sync');
  await expect(page.getByTestId('read-only-banner')).toBeVisible();
  await expect(
    main(page).getByRole('button', { name: /Загрузить|Отправить|Синхронизировать/ }),
  ).toHaveCount(0);

  await page.goto('/channels/events');
  await expect(main(page).getByRole('table')).toBeVisible();
  await expect(
    main(page).getByRole('button', { name: 'Обработать заново', exact: true }),
  ).toHaveCount(0);
  await expect(main(page).getByRole('search')).toBeVisible();
});
