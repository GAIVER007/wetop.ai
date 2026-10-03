import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

const fixture = FIXTURE_API;
const shots = 'reports/categories-v2-c4-2026-09-28';
const hideDevOverlay = (page: Page) =>
  page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
const axe = async (page: Page) =>
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);

/**
 * «Категории v2» C4, часть без Q-173 (ТЗ §17–§18): в правке видно, что использует категорию, тип продажи и
 * вместимость — фактами, а не полями; у сопоставленной с Channex — что название там не поменяется.
 * Архив, смена типа и вместимости ждут решения владельца (Q-173) и здесь не появляются.
 */
test('categories C4: edit shows what uses the category, type as a fact, Channex rename note; preview shows bookings', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/rooms/categories');
  await hideDevOverlay(page);
  const rows = page.getByTestId('fund-category-row');
  await expect(rows).toHaveCount(3);

  // используемая категория: места, тариф, брони, Channex
  await page.getByRole('button', { name: 'Действия с категорией Двухместный номер' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Редактировать категорию' });
  await expect(edit.getByLabel('Название категории')).toHaveValue('Двухместный номер');
  const usage = edit.getByRole('list', { name: 'Эту категорию используют' });
  await expect(usage.getByRole('listitem')).toHaveText([
    '16 номеров',
    '1 тариф: Стандартный',
    '123 брони в истории, из них 5 впереди',
    'Сопоставлена с каналами',
  ]);
  // тип и вместимость — факты, не поля
  await expect(edit.getByRole('radio')).toHaveCount(0);
  await expect(edit.getByLabel('Гостей в номере')).toHaveCount(0);
  await expect(edit).toContainText('Номер целиком');
  await expect(edit).toContainText('2 гостя');
  await expect(edit).toContainText('Тип продажи и вместимость после создания не меняются');
  await expect(edit).toContainText('В менеджере каналов тип номера сохранит прежнее название');
  await page.screenshot({ path: `${shots}/edit-used-light-1440.png` });
  await axe(page);

  // переименование работает как раньше
  await edit.getByLabel('Название категории').fill('Двухместный номер с балконом');
  await edit.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Двухместный номер с балконом' })).toHaveCount(1);

  // койки: тип «Койко-место» и «1 гость на койко-место»
  await page.getByRole('button', { name: 'Действия с категорией Мужской общий номер' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  await expect(edit.getByRole('list', { name: 'Эту категорию используют' })).toContainText('36 коек');
  await expect(edit).toContainText('Койко-место');
  await expect(edit).toContainText('312 броней в истории, из них 14 впереди');
  await page.keyboard.press('Escape');

  // новая категория: ничего не использует, про Channex ни слова
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Создать категорию' });
  await form.getByLabel('Название категории').fill('Семейный C4');
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByRole('dialog', { name: 'Категория создана' }).getByRole('button', { name: 'Готово' }).click();
  await page.getByRole('button', { name: 'Действия с категорией Семейный C4' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  await expect(edit).toContainText('Категорию пока ничего не использует');
  await expect(edit.getByRole('list', { name: 'Эту категорию используют' })).toHaveCount(0);
  await expect(edit).not.toContainText('менеджере каналов');
  await page.screenshot({ path: `${shots}/edit-unused-light-1440.png` });
  await page.keyboard.press('Escape');

  // панель категории: брони и Channex рядом с фондом и тарифами
  await rows
    .filter({ hasText: 'Женский общий номер' })
    .getByRole('button', { name: 'Женский общий номер', exact: true })
    .click();
  const preview = page.getByRole('dialog', { name: 'Женский общий номер' });
  const bookings = preview.getByRole('region', { name: 'Брони и каналы' });
  await expect(bookings).toContainText('287 броней в истории, из них 11 впереди');
  await expect(bookings).toContainText('Сопоставлена с каналами');
  await page.screenshot({ path: `${shots}/preview-usage-light-1440.png` });
  await page.keyboard.press('Escape');

  // тёмная тема и телефон
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.reload();
  await hideDevOverlay(page);
  await page.getByRole('button', { name: 'Действия с категорией Женский общий номер' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  await expect(edit.getByRole('list', { name: 'Эту категорию используют' })).toBeVisible();
  await page.screenshot({ path: `${shots}/edit-used-dark-1440.png` });
  await axe(page);
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Действия с категорией Женский общий номер' }).click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  await expect(edit.getByRole('list', { name: 'Эту категорию используют' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/edit-used-dark-mobile-390.png` });
  await axe(page);

  await page.evaluate(() => localStorage.setItem('wetop.theme', 'light'));
  await request.post(`${fixture}/__test/reset`);
});
