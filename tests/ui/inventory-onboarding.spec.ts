import { FIXTURE_API, test, expect } from './fixtures';

test('empty inventory can start a dorm category from the add menu', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { empty: true } });
  await page.goto('/inventory');
  await page.getByRole('button', { name: '+ Добавить', exact: true }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Комнату с койками', exact: true }),
  ).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Комнату с койками', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Создать категорию' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('radio', { name: /Койко-место/ })).toBeChecked();
  await dialog.getByLabel('Название категории').fill('Тестовая общая комната');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить комнату с койками', exact: true }).click();
  await page.getByLabel('Корпус', { exact: true }).fill('Тестовый корпус');
  await page.getByLabel('Этаж', { exact: true }).fill('2');
  await page.getByLabel('Обозначение комнаты', { exact: true }).fill('201');
  await page.getByLabel('Обозначения коек — по одному на строку').fill('TEST-201-A\nTEST-201-B');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  // Empty-state control overrides all reads, including newly created fixtures.
  await request.post(`${FIXTURE_API}/__test/control`, { data: { empty: false } });
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Открыть койко-место TEST-201-A', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Открыть койко-место TEST-201-B', exact: true }),
  ).toBeVisible();
  await request.post(`${FIXTURE_API}/__test/reset`);
});

test('location and operational filters intersect and survive reload', async ({ page, request }) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await request.post(`${FIXTURE_API}/__test/design-seed`);
  await page.goto('/inventory');
  await page.getByText('Расположение и состояние', { exact: true }).click();
  await page.getByLabel('Фильтр по корпусу').selectOption('Основной');
  await page.getByLabel('Фильтр по этажу').selectOption('1');
  await page.getByLabel('Фильтр по уборке').selectOption('DIRTY');
  await expect(page.getByTestId('unit-row')).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Открыть номер R01', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Фильтр по уборке')).toHaveValue('DIRTY');
  await expect(page.getByTestId('unit-row')).toHaveCount(2);
  await page.getByLabel('Фильтр по состоянию').selectOption('blocked');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
});
