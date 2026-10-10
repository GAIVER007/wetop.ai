import { FIXTURE_API, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * «Настройки → Организации»: название, архив и возврат (ORG1, ADR-ORG1, план `plans/organizations-page-2026-10-09.md`).
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
  // гостиничный `/today` с 09.10.2026 перенаправляет на `/finance` (ADR-152): ждём конечный адрес, иначе
  // следующий goto обрывает идущий редирект (net::ERR_ABORTED)
  await page.waitForURL('**/finance');
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

async function openCreateForm(page: Page) {
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить организацию' }).click();
  return main.getByTestId('platform-create-form');
}

test('создание организации: письмо владельцу ушло, в таблице «ждёт пароля», повторная ссылка сразу нельзя', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const form = await openCreateForm(page);
  await form.getByLabel('Название организации').fill('Хостел «Новый»');
  await form.getByLabel('Почта владельца').fill('new-owner@example.com');
  await form.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(page.getByTestId('platform-create-result')).toContainText('Организация «Хостел «Новый»» создана');
  await expect(page.getByTestId('platform-create-result')).toContainText('Ссылка для пароля отправлена на new-owner@example.com');

  const table = page.getByTestId('platform-organizations');
  const row = table.getByRole('row', { name: /Хостел «Новый»/ });
  await expect(row).toContainText('ждёт пароля');
  await expect(row).toContainText('пробный');
  // у организаций, чей владелец уже вошёл, такой отметки и такой кнопки нет
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).not.toContainText('ждёт пароля');

  await row.getByRole('link', { name: 'Хостел «Новый»' }).click();
  await expect(page.getByTestId('platform-owner-link-form')).toContainText('new-owner@example.com ещё не задал пароль');
  await page.getByRole('button', { name: 'Отправить ссылку ещё раз' }).click();
  await expect(page.getByTestId('platform-owner-link-error')).toHaveText(
    'Письмо уже отправляли: повторить можно через несколько минут',
  );
  await page.screenshot({
    path: 'reports/organizations-page-2026-10-09/organization-created-1440.png',
    fullPage: true,
  });

  await page.goto('/platform?org=ui-org-2#organization');
  await expect(page.getByTestId('platform-owner-link-form')).toHaveCount(0);
});

test('письмо не ушло: организация создана, ссылку можно отправить ещё раз, когда почта заработала', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true, platformMail: 'off' } });
  await page.goto('/platform');
  const form = await openCreateForm(page);
  await form.getByLabel('Название организации').fill('Салон-студия «Лотос»');
  await form.getByLabel('Почта владельца').fill('lotos-owner@example.com');
  await form.getByRole('button', { name: 'Создать организацию' }).click();
  await expect(page.getByTestId('platform-create-result')).toContainText('создана, но письмо не ушло');

  await page.goto('/platform');
  const table = page.getByTestId('platform-organizations');
  await table.getByRole('link', { name: 'Салон-студия «Лотос»' }).click();
  await page.getByRole('button', { name: 'Отправить ссылку ещё раз' }).click();
  await expect(page.getByTestId('platform-owner-link-result')).toContainText('Письмо не ушло');

  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true, platformMail: 'on' } });
  await page.getByRole('button', { name: 'Отправить ссылку ещё раз' }).click();
  await expect(page.getByTestId('platform-owner-link-result')).toContainText(
    'Ссылка отправлена на lotos-owner@example.com',
  );
});

test('создание: отказы API видны словами; ссылка на самостоятельную регистрацию остаётся', async ({ page, request }) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const form = await openCreateForm(page);
  const submit = form.getByRole('button', { name: 'Создать организацию' });

  await form.getByLabel('Название организации').fill('   ');
  await form.getByLabel('Почта владельца').fill('someone@example.com');
  await submit.click();
  await expect(page.getByTestId('platform-create-error')).toHaveText('Название организации: от 1 до 200 знаков');

  await form.getByLabel('Название организации').fill('Хостел «Дубль»');
  await form.getByLabel('Почта владельца').fill('owner@example.com');
  await submit.click();
  await expect(page.getByTestId('platform-create-error')).toHaveText('Эта почта уже зарегистрирована');

  await form.getByLabel('Название организации').fill('Салон «Не пилот»');
  await form.getByLabel('Почта владельца').fill('beauty-owner@example.com');
  await form.getByLabel('Направление').selectOption('BEAUTY');
  await submit.click();
  await expect(page.getByTestId('platform-create-error')).toHaveText('Направление пока доступно только участникам пилота');

  await expect(page.getByTestId('platform-add-organization').getByRole('link', { name: 'страница регистрации' })).toHaveAttribute(
    'href',
    /register/,
  );
  await expect(page.getByTestId('platform-organizations').getByRole('link', { name: /Дубль|Не пилот/ })).toHaveCount(0);
});
