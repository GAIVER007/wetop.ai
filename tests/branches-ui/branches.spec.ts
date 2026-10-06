import { expect, test, type Page } from '@playwright/test';
const api = 'http://127.0.0.1:55864';
type Fixture = {
  business: string;
  otherBusiness: string;
  beauty: string;
  hotel: string;
  locations: string[];
  hotelProperty: string;
};
async function choose(page: Page, name: string) {
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page
    .getByRole('region', { name: 'Выбор филиала' })
    .getByRole('button')
    .filter({ hasText: name })
    .click();
}
test('real branches -> selectBranch cookie -> selectedWorkspaceBranch Food timezone; Beauty and Hospitality regression', async ({
  page,
  request,
}) => {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  const ptr = `business=${f.business};location=${f.locations[0]}`;
  await page
    .context()
    .addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(ptr), domain: '127.0.0.1', path: '/' },
    ]);
  const list = await request.get(`${api}/branches`, { headers: { 'x-wetop-scope': ptr } });
  expect(list.ok()).toBe(true);
  const body = await list.json();
  expect(body.items).toHaveLength(5);
  expect(body.items.find((r: { id: string }) => r.id === f.locations[0])).toMatchObject({
    vertical: 'FOOD_SERVICE',
    timezone: 'Asia/Almaty',
  });
  await page.goto('/floor-plan');
  await expect(page.getByRole('heading', { name: 'План зала', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toContainText(
    'Тестовый филиал Центр',
  );
  await choose(page, 'Тестовый филиал Парк');
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toContainText(
    'Тестовый филиал Парк',
  );
  expect(
    decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value,
    ),
  ).toBe(`business=${f.business};location=${f.locations[1]}`);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'План зала', exact: true })).toBeVisible();
  await choose(page, 'Другой тестовый бизнес');
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toContainText(
    'Другой тестовый бизнес',
  );
  await choose(page, 'Тестовый салон');
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  await choose(page, 'Тестовый отель');
  await expect(page).toHaveURL(/\/today$/);
  // The accepted branch action preserves a safe Hospitality collection or falls back to Today.
  await expect(page.getByTestId('owner-dashboard')).toBeVisible();
  expect(
    decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value,
    ),
  ).toBe(`business=${f.hotel};location=${f.locations[4]}`);
  await page.reload();
  await expect(page.getByTestId('owner-dashboard')).toBeVisible();
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});
