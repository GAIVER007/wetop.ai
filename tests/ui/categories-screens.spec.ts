import { test, expect } from '@playwright/test';

const fixture = 'http://127.0.0.1:4311';
const shots = 'reports/categories-v2-c1-2026-09-27';

/**
 * «Категории v2» C1 (ADR-109, ТЗ §48): таблица с пятью категориями формы Luxx, категория без фонда
 * и тарифа, длинное имя, фильтр типа, меню строки — снимки light/dark/телефон для стопа этапа.
 */
test('categories C1: five Luxx-shaped rows, filters, row menu, long name — light/dark/mobile', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  // Недостающие до формы Luxx категории: одноместные; вторая — длинное имя, без фонда и без тарифа
  const asClient = { headers: { 'x-wetop-test-client': '1' } };
  await request.post(`${fixture}/inventory/categories`, {
    ...asClient,
    data: {
      name: 'Одноместная комната с окном',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      ratePlanCode: 'BASE',
    },
  });
  await request.post(`${fixture}/inventory/categories`, {
    ...asClient,
    data: {
      name: 'Одноместная комната без окон и с очень длинным названием для проверки переноса',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      ratePlanLater: true,
    },
  });
  await page.goto('/rooms/categories');
  // индикатор dev-режима Next не относится к стойке — на снимках владельцу его не показываем
  const hideDevOverlay = () =>
    page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await hideDevOverlay();
  const rows = page.getByTestId('fund-category-row');
  await expect(rows).toHaveCount(5);
  // категория без фонда и без тарифа называет это словами, а не пустыми ячейками (ТЗ §20, §35)
  const bare = rows.filter({ hasText: 'длинным названием' });
  await expect(bare.getByText('не добавлен', { exact: true })).toBeVisible();
  await expect(bare.getByText('тариф не настроен', { exact: true })).toBeVisible();
  // у категорий с фондом число единиц — ссылка в состав (ТЗ §10)
  await expect(
    rows.filter({ hasText: 'Мужской общий номер' }).getByRole('link', { name: '36 коек' }),
  ).toBeVisible();
  // «Тип продажи» больше не колонка: тип виден по значку у названия и слову фонда («36 коек»);
  // «Активна» — текстом, бейджи только у исключений (упрощение 02.10, как в «Номерах и койках»)
  await expect(page.getByRole('columnheader', { name: 'Тип продажи' })).toHaveCount(0);
  await expect(
    rows.filter({ hasText: 'Мужской общий номер' }).getByText('активна', { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${shots}/categories-light-1440.png`, fullPage: true });

  // фильтр типа чипами (ТЗ §25)
  const kindGroup = page.getByRole('group', { name: 'Тип размещения' });
  await kindGroup.getByRole('button', { name: /^Койко-места/ }).click();
  await expect(rows).toHaveCount(2);
  await kindGroup.getByRole('button', { name: /^Номера/ }).click();
  await expect(rows).toHaveCount(3);
  await page.screenshot({ path: `${shots}/categories-filter-rooms.png`, fullPage: true });
  await kindGroup.getByRole('button', { name: /^Все/ }).click();
  await expect(rows).toHaveCount(5);

  // поиск сужает список и объявляет счёт
  await page.getByRole('searchbox', { name: 'Поиск категории' }).fill('одноместная');
  await expect(rows).toHaveCount(2);
  await expect(page.getByText('Показано 2 из 5', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Поиск категории' }).fill('');

  // действия — в меню строки и контекстны типу (ТЗ §8; «Добавить…» зависит от ROOM/BED)
  await page.getByRole('button', { name: 'Действия с категорией Мужской общий номер' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Добавить комнату с койками', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Открыть', exact: true })).toBeVisible();
  await page.screenshot({ path: `${shots}/categories-row-menu.png` });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Действия с категорией Двухместный номер' }).click();
  await expect(page.getByRole('menuitem', { name: 'Добавить номер', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');

  // тёмная тема
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.reload();
  await hideDevOverlay();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(rows).toHaveCount(5);
  await page.screenshot({ path: `${shots}/categories-dark-1440.png`, fullPage: true });

  // телефон: строки складываются в карточки, страница без горизонтальной прокрутки
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rows.first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/categories-dark-mobile-390.png`, fullPage: true });
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'light'));
  await page.reload();
  await hideDevOverlay();
  await expect(rows.first()).toBeVisible();
  await page.screenshot({ path: `${shots}/categories-light-mobile-390.png`, fullPage: true });

  await request.post(`${fixture}/__test/reset`);
});
