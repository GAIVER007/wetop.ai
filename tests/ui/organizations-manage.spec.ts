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
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('работает');

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
  await page.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Показать архивные (1)' }).click();
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('в архиве');
  await expect(page.getByRole('link', { name: 'Скрыть архивные' })).toBeVisible();

  await table.getByRole('link', { name: 'Хостел «Пример»' }).click();
  await page.getByTestId('platform-restore').click();
  await expect(page.getByTestId('platform-archive-result')).toContainText('Организация возвращена');
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('работает');
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

/** Окно «Создать организацию» (ADR-156): три шага, сохранение одним запросом на последнем */
async function createThroughWindow(
  page: Page,
  v: { name: string; brand: string; email: string; vertical?: string },
) {
  await page.getByTestId('create-organization-open').click();
  const dialog = page.getByRole('dialog', { name: 'Создать организацию' });
  await dialog.getByLabel('Название организации').fill(v.name);
  await dialog.getByLabel('Бренд / публичное название').fill(v.brand);
  if (v.vertical) await dialog.getByText(v.vertical, { exact: true }).click();
  await dialog.getByLabel('Владелец, имя').fill('Вера Образцова');
  await dialog.getByLabel('Номер телефона').fill('700 123 45 67');
  await dialog.getByLabel('Почта владельца').fill(v.email);
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  return dialog;
}

test('создание организации: письмо владельцу ушло, в таблице «ждёт пароля», повторная ссылка сразу нельзя', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const dialog = await createThroughWindow(page, { name: 'Хостел «Новый»', brand: 'Новый', email: 'new-owner@example.com' });
  await dialog.getByTestId('create-organization-submit').click();
  const done = page.getByTestId('create-organization-done');
  await expect(done).toContainText('Организация создана');
  await expect(done).toContainText('new-owner@example.com');
  await expect(done).toContainText('отправлено письмо');
  await page.getByRole('button', { name: 'Готово' }).click();

  await page.goto('/platform');
  await page.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
  const table = page.getByTestId('platform-organizations');
  const row = table.getByRole('row', { name: /Хостел «Новый»/ });
  await expect(row).toContainText('ждёт пароля');
  // организация работает сразу, пробного периода нет
  await expect(row).toContainText('работает');
  await expect(row).not.toContainText(/пробн/i);
  // у организаций, чей владелец уже вошёл, такой отметки и такой кнопки нет
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).not.toContainText('ждёт пароля');

  await row.getByRole('link', { name: 'Хостел «Новый»' }).click();
  await expect(page.getByTestId('platform-owner-link-form')).toContainText('new-owner@example.com ещё не задал пароль');
  await page.getByRole('button', { name: 'Отправить ссылку ещё раз' }).click();
  await expect(page.getByTestId('platform-owner-link-error')).toHaveText(
    'Письмо уже отправляли: повторить можно через несколько минут',
  );

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
  const dialog = await createThroughWindow(page, {
    name: 'Салон-студия «Лотос»',
    brand: 'Лотос',
    email: 'lotos-owner@example.com',
    vertical: 'Салон красоты',
  });
  await dialog.getByTestId('create-organization-submit').click();
  await expect(page.getByTestId('create-organization-done')).toContainText('Письмо не ушло');
  await page.getByRole('button', { name: 'Готово' }).click();

  await page.goto('/platform');
  await page.locator('summary').filter({ hasText: 'Подписки и администрирование' }).click();
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

test('создание: отказы API видны словами в окне, введённое остаётся; салон создаётся без списка пилота', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const dialog = await createThroughWindow(page, { name: 'Хостел «Дубль»', brand: 'Дубль', email: 'owner@example.com' });
  await dialog.getByTestId('create-organization-submit').click();
  await expect(dialog.getByRole('alert')).toHaveText('Эта почта уже зарегистрирована');
  await dialog.getByRole('button', { name: 'Назад' }).click();
  await dialog.getByRole('button', { name: 'Назад' }).click();
  await expect(dialog.getByLabel('Название организации')).toHaveValue('Хостел «Дубль»');

  // другая почта и направление салона: у главного администратора списка пилота нет
  await dialog.getByLabel('Почта владельца').fill('beauty-owner@example.com');
  await dialog.getByText('Салон красоты', { exact: true }).click();
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await dialog.getByRole('button', { name: /Продолжить/ }).click();
  await dialog.getByTestId('create-organization-submit').click();
  await expect(page.getByTestId('create-organization-done')).toContainText('Организация создана');
});
