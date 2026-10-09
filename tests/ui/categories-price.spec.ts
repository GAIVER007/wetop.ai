import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

const fixture = FIXTURE_API;
const shots = 'reports/categories-price-2026-10-06';
const hideDevOverlay = (page: Page) =>
  page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
const axe = async (page: Page) =>
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);

/**
 * План categories-price-2026-10-06 (решение владельца по снимку прежней системы): в «Категориях номеров» таблица
 * «№ · Название · Мест · Цена · Фонд · Статус · Операции», цена задаётся при создании и меняется кнопкой «Изменить»,
 * «Удалить» удаляет пустую категорию, с местами уводит в архив, с бронями впереди отказывает словами.
 */
test('categories: price column, create with price, edit price, delete, archive and refusal', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/rooms/categories');
  await hideDevOverlay(page);
  const main = page.getByRole('main');
  const rows = page.getByTestId('fund-category-row');
  await expect(rows).toHaveCount(3);
  await expect(main.getByRole('columnheader')).toHaveText([
    '№',
    'Название',
    'Мест',
    'Цена',
    'Фонд',
    'Статус',
    'Операции',
  ]);
  const male = rows.filter({ hasText: 'Мужской общий номер' });
  await expect(male.getByText('6 000 ₸', { exact: true })).toBeVisible();
  await expect(
    male.getByRole('button', { name: 'Изменить категорию Мужской общий номер' }),
  ).toBeVisible();
  await expect(
    male.getByRole('button', { name: 'Удалить категорию Мужской общий номер' }),
  ).toBeVisible();
  await page.screenshot({ path: `${shots}/list-light-1440.png`, fullPage: true });
  await axe(page);

  // создание: цена обязательна, ошибка у поля, введённое не стирается; выбора тарифа больше нет
  await page.getByRole('button', { name: 'Добавить категорию', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Создать категорию' });
  await expect(form.getByRole('radio', { name: /Настроить/ })).toHaveCount(0);
  await form.getByLabel('Название категории').fill('Семейный');
  await form.getByLabel('Гостей в номере').fill('3');
  await form.getByLabel('Цена за номер в ночь, ₸').fill('0');
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(form.getByText('Цена — число больше нуля, например 7000')).toBeVisible();
  await expect(form.getByLabel('Название категории')).toHaveValue('Семейный');
  await form.getByLabel('Цена за номер в ночь, ₸').fill('18 000');
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  const done = page.getByRole('dialog', { name: 'Категория создана' });
  await expect(done).toContainText('18 000 ₸');
  await done.getByRole('button', { name: 'Готово' }).click();
  const family = rows.filter({ hasText: 'Семейный' });
  await expect(family.getByText('18 000 ₸', { exact: true })).toBeVisible();

  // правка цены: 6 000 → 7 000 у мужского общего номера
  await male.getByRole('button', { name: 'Изменить категорию Мужской общий номер' }).click();
  const edit = page.getByRole('dialog', { name: 'Редактировать категорию' });
  const price = edit.getByLabel('Цена за койку в ночь, ₸');
  await expect(price).toHaveValue('6000');
  await expect(edit).toContainText('уже принятые брони не меняются');
  await page.screenshot({ path: `${shots}/edit-price-light-1440.png` });
  await axe(page);
  await price.fill('7000');
  await edit.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(male.getByText('7 000 ₸', { exact: true })).toBeVisible();

  // пустую категорию удаляет насовсем, после вопроса
  await family.getByRole('button', { name: 'Удалить категорию Семейный' }).click();
  const confirm = page.getByTestId('confirm-dialog');
  await expect(confirm).toContainText('Удалить «Семейный»?');
  await expect(confirm).toContainText('удалится насовсем');
  await confirm.getByRole('button', { name: 'Удалить категорию' }).click();
  await expect(main.getByText('«Семейный» удалена.')).toBeVisible();
  await expect(rows).toHaveCount(3);

  // с бронями впереди — отказ словами, без вопроса
  await male.getByRole('button', { name: 'Удалить категорию Мужской общий номер' }).click();
  await expect(main.getByRole('alert')).toContainText('нельзя удалить: впереди 14 броней');
  await expect(rows).toHaveCount(3);

  // с местами и без броней впереди — архив
  await request.post(`${fixture}/__test/control`, {
    data: { categoryUsage: { FEMALE: { upcomingReservations: 0 } } },
  });
  await page.reload();
  await hideDevOverlay(page);
  const female = rows.filter({ hasText: 'Женский общий номер' });
  await female.getByRole('button', { name: 'Удалить категорию Женский общий номер' }).click();
  await expect(confirm).toContainText('уйдёт в архив');
  await confirm.getByRole('button', { name: 'Убрать в архив' }).click();
  await expect(female.getByText('В архиве')).toBeVisible();
  await expect(
    female.getByRole('button', { name: 'Изменить категорию Женский общий номер' }),
  ).toBeDisabled();

  // тёмная тема и телефон
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.reload();
  await hideDevOverlay(page);
  await expect(rows).toHaveCount(3);
  await page.screenshot({ path: `${shots}/list-dark-1440.png`, fullPage: true });
  await axe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/list-dark-mobile-390.png`, fullPage: true });
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'light'));
  await request.post(`${fixture}/__test/reset`);
});

test('/rates ведёт в «Категории номеров», в меню раздела «Тарифы и цены» нет', async ({ page }) => {
  await page.goto('/rates');
  await expect(page).toHaveURL(/\/rooms\/categories$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Категории номеров');
  await expect(page.locator('.workspace-header a[href="/rates"]')).toHaveCount(0);
});
