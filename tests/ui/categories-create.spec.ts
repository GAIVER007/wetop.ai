import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API } from './fixtures';

const fixture = FIXTURE_API;
const shots = 'reports/categories-v2-c3-2026-09-28';
const hideDevOverlay = (page: Page) =>
  page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
const axe = async (page: Page) =>
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations,
  ).toEqual([]);

/**
 * «Категории v2» C3 (ADR-119): категория создаётся без тарифа («Настроить позже» — по умолчанию), после создания —
 * следующий шаг, а не пустой список; «Настроить тариф» привязывает тариф потом; «Настроить сейчас» — выбрать
 * существующий или назвать новый. Ошибки формы — словами у поля.
 */
test('categories C3: create without a rate plan, set it later; create with one now; validation; themes and phone', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/rooms/categories');
  await hideDevOverlay(page);
  const rows = page.getByTestId('fund-category-row');
  await expect(rows).toHaveCount(3);

  // 1. Номер, тариф позже
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  const form = page.getByRole('dialog', { name: 'Создать категорию' });
  await expect(form.getByRole('radio', { name: 'Номер целиком' })).toBeChecked();
  await expect(form.getByRole('radio', { name: 'Настроить позже' })).toBeChecked();
  await expect(form.getByRole('radio', { name: /Апартаменты/ })).toHaveCount(0);

  // ошибки — словами у поля, форма не уходит
  await form.getByLabel('Гостей в номере').fill('0');
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(form.getByLabel('Название категории')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByText('Укажите название категории')).toBeVisible();
  await expect(form.getByText('Вместимость — от 1 до 100 гостей')).toBeVisible();
  await page.screenshot({ path: `${shots}/create-validation-light-1440.png` });
  await axe(page);

  await form.getByLabel('Название категории').fill('Одноместная с окном');
  await form.getByLabel('Гостей в номере').fill('1');
  await page.screenshot({ path: `${shots}/create-room-later-light-1440.png` });
  await form.getByRole('button', { name: 'Создать', exact: true }).click();

  // следующий шаг вместо пустого списка
  const done = page.getByRole('dialog', { name: 'Категория создана' });
  await expect(done).toContainText('Одноместная с окном');
  await expect(done).toContainText('Тариф не настроен');
  await expect(done.getByRole('button', { name: 'Добавить номер' })).toBeVisible();
  await expect(done.getByRole('button', { name: 'Готово' })).toBeVisible();
  await page.screenshot({ path: `${shots}/created-without-rate-light-1440.png` });
  await axe(page);

  // «Настроить тариф» — выбор существующего тарифа
  await done.getByRole('button', { name: 'Настроить тариф' }).click();
  const setRate = page.getByRole('dialog', { name: 'Настроить тариф' });
  await expect(setRate).toContainText('Одноместная с окном');
  await setRate.getByRole('combobox', { name: /^Тариф/ }).selectOption({ label: 'Стандартный' });
  await setRate.getByRole('button', { name: 'Привязать тариф' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const single = rows.filter({ hasText: 'Одноместная с окном' });
  await expect(single.getByRole('link', { name: '1 тариф' })).toBeVisible();
  // тариф есть, мест нет — ещё не продаётся
  await expect(single.getByText('Не готова к продаже')).toBeVisible();

  // 2. Койки, тариф сейчас; поле вместимости у койки не спрашивается
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await form.getByLabel('Название категории').fill('Общая женская, тест');
  await form.getByRole('radio', { name: 'Койко-место' }).check();
  await expect(form.getByLabel('Гостей в номере')).toHaveCount(0);
  await expect(form).toContainText('1 гость на койко-место');
  await form.getByRole('radio', { name: 'Настроить сейчас' }).check();
  // «сейчас» и новый тариф без названия — ошибка у поля
  await form.getByRole('combobox', { name: /^Тариф/ }).selectOption({ label: 'Новый тариф…' });
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(form.getByText('Назовите новый тариф или выберите существующий')).toBeVisible();
  await form.getByRole('combobox', { name: /^Тариф/ }).selectOption({ label: 'Стандартный' });
  // выбор исправлен — старое сообщение об ошибке не висит
  await expect(form.getByText('Назовите новый тариф или выберите существующий')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/create-bed-now-light-1440.png` });
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(done).toContainText('Общая женская, тест');
  await expect(done).toContainText('Стандартный');
  await expect(done.getByRole('link', { name: 'Цены в календаре' })).toHaveAttribute('href', /\/rates\?category=/);
  // «Добавить комнату с койками» ведёт в прежнюю форму с этой категорией
  await done.getByRole('button', { name: 'Добавить комнату с койками' }).click();
  const addRoom = page.getByRole('dialog', { name: 'Добавить размещение' });
  await expect(addRoom.getByLabel('Категория')).toHaveValue(/test-category/);
  await addRoom.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const bed = rows.filter({ hasText: 'Общая женская, тест' });
  await expect(bed.getByRole('link', { name: '1 тариф' })).toBeVisible();

  // 3. Номер без тарифа: в меню строки и в панели — «Настроить тариф»
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  // форма открывается чистой: тип и тариф прошлого создания не переносятся
  await expect(form.getByRole('radio', { name: 'Номер целиком' })).toBeChecked();
  await expect(form.getByRole('radio', { name: 'Настроить позже' })).toBeChecked();
  await form.getByLabel('Название категории').fill('Двухместная без тарифа');
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await done.getByRole('button', { name: 'Готово' }).click();
  const bare = rows.filter({ hasText: 'Двухместная без тарифа' });
  await expect(bare.getByText('Номер целиком')).toBeVisible();
  await expect(bare.getByText('тариф не настроен')).toBeVisible();
  await expect(bare.getByText('Не готова к продаже')).toBeVisible();
  await page.screenshot({ path: `${shots}/list-after-create-light-1440.png`, fullPage: true });
  await page.getByRole('button', { name: 'Действия с категорией Двухместная без тарифа' }).click();
  await expect(page.getByRole('menuitem', { name: 'Настроить тариф', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await bare.getByRole('button', { name: 'Двухместная без тарифа', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Двухместная без тарифа' });
  await expect(preview).toContainText('Тариф не настроен');
  await expect(preview.getByRole('button', { name: 'Настроить тариф' })).toBeVisible();
  await page.keyboard.press('Escape');

  // тёмная тема и телефон — форма и шаг после создания
  await page.evaluate(() => localStorage.setItem('wetop.theme', 'dark'));
  await page.reload();
  await hideDevOverlay(page);
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await form.getByLabel('Название категории').fill('Семейный, тёмная тема');
  await form.getByRole('radio', { name: 'Настроить сейчас' }).check();
  await page.screenshot({ path: `${shots}/create-now-dark-1440.png` });
  await axe(page);
  await page.getByRole('button', { name: 'Отмена' }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await form.getByLabel('Название категории').fill('Мансарда');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${shots}/create-dark-mobile-390.png` });
  await form.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(done).toContainText('Мансарда');
  await page.screenshot({ path: `${shots}/created-dark-mobile-390.png` });

  await page.evaluate(() => localStorage.setItem('wetop.theme', 'light'));
  await request.post(`${fixture}/__test/reset`);
});
