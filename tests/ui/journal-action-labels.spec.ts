import { FIXTURE_API, expect, test } from './fixtures';

test('события филиалов и проверки остатков подписаны по-русски в фильтре журнала', async ({
  page,
  request,
}) => {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/journal');
  await page.getByText('Фильтры истории', { exact: true }).click();
  const actions = page.getByRole('combobox', { name: 'Действие', exact: true });
  await expect(actions.getByRole('option', { name: 'Салон создан', exact: true })).toHaveAttribute(
    'value',
    'location.salon_created',
  );
  await expect(
    actions.getByRole('option', { name: 'Ресторан создан', exact: true }),
  ).toHaveAttribute('value', 'location.restaurant_created');
  await expect(
    actions.getByRole('option', { name: 'Остатки в каналах проверены', exact: true }),
  ).toHaveAttribute('value', 'channex.availabilityRead');
});
