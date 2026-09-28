import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('category creation, rename, room creation and reload', async ({ page }) => {
  await page.goto('/rooms/categories');
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await page.getByLabel('Название категории').fill('Тестовая новая категория');
  await expect(page.getByLabel('Тариф для категории')).toBeEnabled();
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  const category = page
    .getByTestId('fund-category-row')
    .filter({ hasText: 'Тестовая новая категория' });
  await expect(category).toBeVisible();
  // новая категория без единиц и с тарифом из формы (ТЗ «Категории v2» §20, §35)
  await expect(category.getByText('не добавлен', { exact: true })).toBeVisible();
  await expect(category.getByRole('link', { name: '1 тариф', exact: true })).toBeVisible();
  await category
    .getByRole('button', { name: 'Действия с категорией Тестовая новая категория' })
    .click();
  await page.getByRole('menuitem', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Название категории').fill('Тестовая категория изменена');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const updated = page
    .getByTestId('fund-category-row')
    .filter({ hasText: 'Тестовая категория изменена' });
  await updated
    .getByRole('button', { name: 'Действия с категорией Тестовая категория изменена' })
    .click();
  await page.getByRole('menuitem', { name: 'Добавить номер', exact: true }).click();
  await page.getByLabel('Корпус', { exact: true }).fill('Тестовый корпус');
  await page.getByLabel('Этаж', { exact: true }).fill('1');
  await page.getByLabel('Обозначение комнаты', { exact: true }).fill('TEST-201');
  await page.getByLabel('Обозначение номера в шахматке').fill('TEST-201');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  // состав не разворачивается на месте — число единиц ведёт в «Номера и койки» (ТЗ §10)
  await updated.getByRole('link', { name: '1 номер', exact: true }).click();
  await expect(page).toHaveURL(/\/inventory\?category=/);
  await expect(
    page.getByRole('link', { name: 'Открыть номер TEST-201', exact: true }),
  ).toBeVisible();
});
test('availability preserves exact unit and dates; responsive category design', async ({
  page,
}) => {
  await page.goto('/rooms/availability?arrival=2026-09-24&departure=2026-09-27');
  await expect(page.getByRole('heading', { name: /Найдено \d+ вариант/ })).toBeVisible();
  await page.locator('.fund-availability summary').first().click();
  const link = page.locator('.fund-book-unit').first();
  await expect(link).toHaveAttribute('href', /arrival=2026-09-24&departure=2026-09-27&unit=/);
  await link.click();
  await expect(
    page.getByRole('heading', { name: 'Новая бронь', exact: true, level: 1 }),
  ).toBeVisible();
  for (const width of [1440, 768, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/rooms/categories');
    await expect(
      page.getByRole('heading', { name: 'Категории номеров', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.screenshot({ path: 'reports/fund-workspace-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'reports/fund-workspace-categories.png', fullPage: true });
  await page.goto('/rooms/availability?arrival=2026-09-24&departure=2026-09-27');
  await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('ROOM');
  await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('');
  await page.screenshot({ path: 'reports/fund-workspace-availability.png', fullPage: true });
});

test('guests filter categories by capacity; toggle shows all; tab renamed', async ({ page }) => {
  // ТЗ «Свободные места» AV1 (ADR-110): поиск отвечает «нас трое», а не только «есть ли место»
  await page.goto('/rooms/availability?arrival=2026-09-24&departure=2026-09-27&guests=3');
  await expect(page.getByText(/3 ночи · 3 гостя/)).toBeVisible();
  const rows = page.locator('.fund-availability article');
  // «Двухместный номер» вмещает двоих — запросу на троих не подходит и в выдачу не попадает
  await expect(rows.filter({ hasText: 'Двухместный номер' })).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Мужской общий номер' })).toHaveCount(1);
  // счётчик результата — по запросу: подходящих номеров нет
  await expect(page.locator('.fund-counts')).toContainText('0 номеров');
  // «Все категории» возвращает неподходящие строки с объяснением
  await page.getByRole('button', { name: 'Все категории', exact: true }).click();
  await expect(rows.filter({ hasText: 'Двухместный номер' })).toHaveCount(1);
  await expect(
    rows.filter({ hasText: 'Двухместный номер' }).getByText(/Не вмещает 3 гостей/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Только доступные', exact: true }).click();
  await expect(rows.filter({ hasText: 'Двухместный номер' })).toHaveCount(0);
  // раздел переименован: вкладка фонда и заголовок — «Свободные места», маршрут прежний
  await expect(
    page
      .getByRole('navigation', { name: 'Номерной фонд', exact: true })
      .getByRole('link', { name: 'Свободные места' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Свободные места', level: 1 })).toBeVisible();
  // пресет дат сохраняет число гостей
  await expect(page.getByRole('link', { name: '7 дней', exact: true })).toHaveAttribute(
    'href',
    /guests=3/,
  );
});

test('AV2: price «from» — rooms for the whole stay, beds for every guest', async ({
  page,
  request,
}) => {
  // ТЗ «Свободные места» §4 (ADR-110, закрытый Q-204); подставной API: номер 8 000 ₸, койка 4 000 ₸ за ночь
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.goto('/rooms/availability?arrival=2026-10-01&departure=2026-10-04&guests=2');
  const rows = page.locator('.fund-availability article');
  const room = rows.filter({ hasText: 'Двухместный номер' });
  await expect(room.getByText('от 24 000 ₸ за проживание')).toBeVisible();
  await expect(room.getByText('от 8 000 ₸ / ночь')).toBeVisible();
  // корректировка владельца: итог коек — на всех гостей запроса (4 000 × 2 гостя × 3 ночи)
  const bed = rows.filter({ hasText: 'Мужской общий номер' });
  await expect(bed.getByText('Итого от 24 000 ₸')).toBeVisible();
  await expect(bed.getByText('от 4 000 ₸ / койка / ночь')).toBeVisible();
  await expect(bed.getByText('2 гостя, 3 ночи')).toBeVisible();
});

test('dark categories and availability; invalid dates and empty onboarding', async ({
  page,
  request,
}) => {
  await request.post('http://127.0.0.1:4311/__test/reset');
  await page.addInitScript(() => localStorage.setItem('wetop.theme', 'dark'));
  for (const path of ['/rooms/categories', '/rooms/availability']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('navigation', { name: 'Номерной фонд', exact: true }).waitFor();
    if (path.endsWith('categories'))
      await page.getByRole('searchbox', { name: 'Поиск категории' }).fill('');
    else await page.getByRole('combobox', { name: 'Тип размещения', exact: true }).selectOption('');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `reports/fund-workspace-${path.endsWith('categories') ? 'categories' : 'availability'}-dark.png`,
      fullPage: true,
    });
  }
  await page.goto('/rooms/availability?arrival=2026-09-27&departure=2026-09-24');
  await expect(page.getByRole('main').getByText(/Выезд должен быть позже заезда/)).toBeVisible();
  await request.post('http://127.0.0.1:4311/__test/control', { data: { empty: true } });
  await page.goto('/rooms/categories');
  await expect(page.getByRole('heading', { name: 'Начните с категории размещения' })).toBeVisible();
  await page.getByRole('button', { name: '+ Категория', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'Создать категорию' })).toBeVisible();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await request.post('http://127.0.0.1:4311/__test/reset');
});
