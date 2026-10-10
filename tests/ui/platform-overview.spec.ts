import { FIXTURE_API, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Обзор платформы и таблица клиентов (срез P1, план `plans/platform-superadmin-2026-10-10.md`, макет владельца).
 * Числа — из стенда: своя «Тестовая сеть» (ui-org, работает, три направления) и «Хостел «Пример»» (ui-org-2,
 * пробный, подключён два дня назад). Денег на экране нет: платежи платформе не ведутся (ADR-102, Q-PA-1, Q-PA-2).
 * Доступность /platform в двух темах сторожит platform-access.spec.ts, сюда не дублируется.
 */
test.beforeEach(async ({ request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
});

async function signInAsPlatformAdmin(page: Page, request: import('@playwright/test').APIRequestContext) {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance'); // /today у отеля сразу ведёт на /finance (ADR-152)
  await request.post(`${FIXTURE_API}/__test/control`, { data: { platformAdmin: true } });
}

test('обзор: плитки, рост, направления, статусы; про деньги — честные слова, а не числа', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const overview = page.getByTestId('platform-overview');
  await expect(overview.getByTestId('platform-kpi-organizations')).toHaveText('2');
  await expect(overview.getByTestId('platform-kpi-active')).toHaveText('1');
  await expect(overview.getByTestId('platform-kpi-trial')).toHaveText('1');
  await expect(overview.getByTestId('platform-kpi-read-only')).toHaveText('0');
  // «Хостел «Пример»» подключён два дня назад — единственное новое подключение за 30 дней
  await expect(overview.getByTestId('platform-kpi-new')).toHaveText('1');

  // рост: выбран текущий месяц, подпись говорит итог словами
  await expect(overview.getByTestId('platform-growth')).toBeVisible();
  await expect(overview).toContainText('всего организаций 2');
  // направления и статусы — кольца с подписями словами
  await expect(overview.getByTestId('platform-verticals')).toContainText('Гостиница');
  await expect(overview.getByTestId('platform-statuses')).toContainText('работает');
  await expect(overview.getByTestId('platform-statuses')).toContainText('пробный');

  // денег нет и не выдумано: ни MRR, ни ₽, только честное объяснение со ссылкой на решение
  const billing = page.getByTestId('platform-no-billing');
  await expect(billing).toContainText('ADR-102');
  await expect(billing).toContainText('Q-PA-1');
  await expect(page.locator('main')).not.toContainText('MRR —');
  await expect(page.locator('main')).not.toContainText('₽');
});

test('таблица клиентов: направления, филиалы, дата подключения; поиск и отборы работают на месте', async ({
  page,
  request,
}) => {
  await signInAsPlatformAdmin(page, request);
  await page.goto('/platform');
  const table = page.getByTestId('platform-organizations');
  await expect(table.getByRole('columnheader', { name: 'Направление' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Филиалы' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Подключена' })).toBeVisible();
  const own = table.getByRole('row', { name: /Тестовая сеть/ });
  await expect(own).toContainText('Гостиница, Салон, Ресторан');
  await expect(table.getByRole('row', { name: /Хостел «Пример»/ })).toContainText('Гостиница');

  // поиск по названию: счётчик для читалки говорит итог
  await page.getByTestId('platform-clients-search').fill('Пример');
  await expect(page.getByTestId('platform-clients-count')).toHaveText('Показано 1 из 2');
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toBeVisible();
  await expect(table.getByRole('link', { name: 'Тестовая сеть' })).toHaveCount(0);

  // поиск по почте владельца
  await page.getByTestId('platform-clients-search').fill('owner@example.com');
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toBeVisible();

  // отбор по статусу поверх пустого поиска
  await page.getByTestId('platform-clients-search').fill('');
  await page.getByTestId('platform-filter-status').selectOption('TRIAL');
  await expect(page.getByTestId('platform-clients-count')).toContainText('статус «пробный»');
  await expect(table.getByRole('link', { name: 'Тестовая сеть' })).toHaveCount(0);

  // отбор по направлению: салон есть только у своей сети
  await page.getByTestId('platform-filter-status').selectOption('');
  await page.getByTestId('platform-filter-vertical').selectOption('BEAUTY');
  await expect(table.getByRole('link', { name: 'Тестовая сеть' })).toBeVisible();
  await expect(table.getByRole('link', { name: 'Хостел «Пример»' })).toHaveCount(0);

  // под отбор никто не попал — пустое состояние вместо пустой таблицы
  await page.getByTestId('platform-clients-search').fill('нет такой организации');
  await expect(page.getByTestId('platform-clients-empty')).toBeVisible();
  await expect(page.getByTestId('platform-organizations')).toHaveCount(0);
});
