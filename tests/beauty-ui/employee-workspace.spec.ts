import { mkdirSync } from 'node:fs';
mkdirSync('tests/runs/screenshots/employee-workspace', { recursive: true });
import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
async function reset(page: Page, request: APIRequestContext) {
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f = (await response.json()) as {
    business: string;
    otherBusiness: string;
    locations: string[];
  };
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.business};location=${f.locations[0]}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  return {
    ...f,
    headers: { 'x-wetop-scope': `business=${f.business};location=${f.locations[0]}` },
  };
}
const confirm = (page: Page) =>
  page
    .getByRole('dialog', { name: 'Несохранённые изменения', exact: true })
    .filter({ visible: true });
async function read(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get(`${api}/beauty/employees`, { headers });
  expect(response.ok()).toBe(true);
  return (await response.json()).items as Array<{
    id: string;
    name: string;
    phone: string | null;
    serviceIds: string[];
    profileRevision: string;
  }>;
}

/**
 * Окно «Мастер» осталось только для создания специалиста; правка открытого специалиста переехала на страницу
 * профиля (формы кабинета). Её сценарии проверяют employee-canonical.spec.ts и tests/employee-portal-ui/portal.spec.mjs.
 * Здесь остаётся сценарий окна создания.
 */
test('saving dirty creation before close leaves one saved employee and a closed card', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const creating = page.getByRole('dialog', { name: 'Новый специалист', exact: true });
  await creating.getByLabel('Имя мастера').fill('Тестовый мастер перед закрытием');
  await creating.getByRole('button', { name: 'Закрыть: Новый специалист' }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти' }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
  expect(await read(request, f.headers)).toHaveLength(1);
  await page.reload();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
});

