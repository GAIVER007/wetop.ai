import { FIXTURE_API, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * «Настройки → Организации»: название, архив и возврат (ORG1, ADR-154, план `plans/organizations-page-2026-10-09.md`).
 * Стенд отвечает теми же словами, что API; «Хостел «Пример»» (ui-org-2) чужая организация, «Luxx Aparts» (ui-org) своя.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signInAsPlatformAdmin(page: Page, request: import('@playwright/test').APIRequestContext) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

test('переименование: название сохраняется и видно в таблице; пустое отклоняется словами API', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform?org=ui-org-2#organization');
  const form = page.getByTestId('platform-rename-form');
  await form.getByLabel('Название').fill('   ');
  await form.getByRole('button', { name: 'Сохранить название' }).click();
  await expect(page.getByTestId('platform-rename-error')).toHaveText(
    'Название организации: от 1 до 200 знаков',
  );

  await form.getByLabel('Название').fill('  Хостел   «Север»  ');
  await form.getByRole('button', { name: 'Сохранить название' }).click();
  await expect(page.getByTestId('platform-rename-result')).toContainText('Название сохранено');
  const table = page.getByTestId('platform-organizations');
  await expect(table.getByRole('link', { name: 'Хостел «Север»' })).toBeVisible();
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toHaveCount(0);
});

test('архив вместо удаления: подтверждение, скрытие из списка, показ архивных и возврат с прежним статусом', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform?org=ui-org-2#organization');
  const table = page.getByTestId('platform-organizations');
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('пробный');

  await page.getByTestId('platform-archive').click();
  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toContainText('Убрать «Хостел «Пример»» в архив?');
  await expect(dialog).toContainText('Данные сохранятся');
  // отказ ничего не меняет
  await dialog.getByRole('button', { name: 'Оставить как есть' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId('platform-archive-result')).toHaveCount(0);

  await page.getByTestId('platform-archive').click();
  await dialog.getByRole('button', { name: 'Убрать в архив' }).click();
  await expect(page.getByTestId('platform-archive-result')).toContainText('Организация в архиве');
  // в архиве: из таблицы пропала (карточка выбранной осталась), подписки и расширения у неё не правятся
  await expect(page.getByTestId('platform-restore')).toBeVisible();
  await expect(page.getByTestId('platform-extension-form')).toHaveCount(0);

  await page.goto('/platform');
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Показать архивные (1)' }).click();
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('в архиве');
  await expect(page.getByRole('link', { name: 'Скрыть архивные' })).toBeVisible();

  await table.getByRole('link', { name: 'Хостел «Пример»' }).click();
  await page.getByTestId('platform-restore').click();
  await expect(page.getByTestId('platform-archive-result')).toContainText('Организация возвращена');
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('пробный');
  await expect(page.getByTestId('platform-extension-form')).toBeVisible();
  await page.screenshot({
    path: 'reports/organizations-page-2026-10-09/organization-card-1440.png',
    fullPage: true,
  });
});

test('своя организация: помечена «Ваша», в архив не убирается', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform?org=ui-org#organization');
  const table = page.getByTestId('platform-organizations');
  await expect(table.getByRole('row', { name: /Luxx Aparts/ })).toContainText('Ваша');
  await expect(page.getByTestId('platform-archive')).toBeDisabled();
  await expect(page.getByTestId('platform-archive-form')).toContainText(
    'Свою организацию в архив убрать нельзя',
  );
});

test('«Добавить организацию»: новая организация регистрируется сама, ссылка на регистрацию под рукой', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить организацию' }).click();
  await expect(main.getByTestId('platform-add-organization')).toContainText(
    'Организация регистрируется сама',
  );
  await expect(main.getByRole('link', { name: 'Страница регистрации' })).toHaveAttribute(
    'href',
    /register/,
  );
});
