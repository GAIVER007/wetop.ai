import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Волна 1 ТЗ «UX и удержание» (`plans/ux-retention-2026-09-26.md`, ADR-098): новый человек видит срок пробного
 * периода, пустые экраны говорят его языком и ведут к действию, частая форма не требует лишнего выбора, телефон и
 * компьютер показывают разделы в одном порядке. Стенд — подставной API (`scripts/preview/fixture-api.ts`).
 */
const API = FIXTURE_API;
const control = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post(`${API}/__test/control`, { data: body });

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`);
});

async function signIn(page: Page) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
}

test('пробный период виден в меню на рабочих экранах, у оплаченной организации строки нет (п. 2.7)', async ({
  page,
  request,
}) => {
  await signIn(page);
  const line = page.locator('.workspace-header').getByTestId('trial-line');
  await expect(page.locator('.workspace-header .profile-caption')).toContainText('Дана Тестова');
  await expect(line).toHaveCount(0);

  await control(request, { orgTrialDays: 7 });
  for (const path of ['/today', '/chessboard', '/reservations']) {
    await page.goto(path);
    await expect(line).toHaveText('Пробный период: ещё 7 дн.');
  }

  await control(request, { orgTrialDays: 'ended' });
  await page.goto('/today');
  await expect(line).toHaveText('Пробный период закончился');
});

test('пустые экраны без «Legacy» и «импорта», с действием и без круговой ссылки на онбординг (пп. 1.2, 1.3)', async ({
  page,
  request,
}) => {
  await control(request, { empty: true });
  const main = page.getByRole('main');

  await page.goto('/inventory');
  await expect(main.getByText('Номерной фонд пока пуст')).toBeVisible();
  await expect(main).not.toContainText(/Legacy|загрузки фонда/);
  await expect(main.locator('a[href="/onboarding"]')).toHaveCount(0);

  await page.goto('/management/analytics/occupancy');
  await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(main).not.toContainText(/Legacy/);

  await page.goto('/hotel-settings/services');
  await expect(main.getByTestId('services-empty')).toBeVisible();
  await expect(main.getByTestId('services-empty')).not.toContainText(/Legacy|импорт/);
});

test('новая бронь: источник по умолчанию «стойка» — на один выбор меньше (п. 1.4)', async ({
  page,
}) => {
  await page.goto('/reservations/new');
  await expect(page.getByRole('main').getByLabel('Источник *')).toHaveValue('DESK');
});

test('нижняя панель телефона — в порядке бокового меню (п. 1.6)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today');
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link'),
  ).toHaveText(['Главная', 'Календарь', 'Брони', 'Финансы']);
});

test('подсказка поиска: «⌘ K» на Mac, «Ctrl K» на остальных (п. 1.7)', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
  });
  await page.goto('/today');
  await expect(page.locator('.workspace-search kbd')).toHaveText('Ctrl K');
});

/**
 * П. 3.1 (UQ-1 — «да» владельца 26.09.2026): «Общие» настройки правит владелец организации, и управляющий — тоже: ему
 * «всё, кроме владельческого» (ADR-107). Администратору раздел закрыт целиком. Отказ API не стирает ввод. Валюта и
 * часовой пояс остаются только для просмотра.
 */
test('владелец и управляющий правят сведения гостиницы; отказ сохраняет ввод; администратору раздел закрыт (п. 3.1)', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.goto('/hotel-settings');
  // «Настройки объекта» SET1 (ADR-115): часы заезда — на вкладке «Проживание», сохранение — в шапке
  const form = page.getByTestId('hotel-settings-form');
  const save = page.getByRole('main').getByRole('button', { name: 'Сохранить изменения' });
  await expect(form.getByLabel('Название объекта', { exact: true })).toHaveValue('Luxx Aparts');
  // валюта стоит полем только для чтения (ADR-156)
  await expect(form.getByLabel('Валюта')).toHaveAttribute('readonly', '');
  await form.getByLabel('Телефон').fill('+7 701 555 44 33');
  await save.click();
  await expect(page.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');
  await page.reload();
  await expect(form.getByLabel('Телефон')).toHaveValue('+7 701 555 44 33');

  await form.getByLabel('Почта').fill('не почта');
  await save.click();
  await expect(form.getByRole('alert')).toContainText('Почта в виде name@example.kz');
  await expect(form.getByLabel('Почта')).toHaveValue('не почта');

  await control(request, { role: 'MANAGER' });
  await page.goto('/hotel-settings');
  await expect(form.getByLabel('Телефон')).toBeVisible();
  await form.getByLabel('Телефон').fill('+7 701 555 44 34');
  await save.click();
  await expect(page.getByTestId('settings-save-state')).toHaveText('✓ Изменения сохранены');

  await control(request, { role: 'STAFF' });
  await page.goto('/hotel-settings');
  await expect(page.getByTestId('hotel-settings-form')).toHaveCount(0);
  await expect(page.getByTestId('stored-property')).toHaveCount(0);
  await expect(page.getByRole('main').getByTestId('no-access')).toContainText(
    '«Настройки гостиницы»: доступ есть у владельца и управляющего.',
  );
});
