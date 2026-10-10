import { expect, test, type Page } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BRANCHES_UI_API_PORT ?? '55864'}`;
type Fixture = {
  business: string;
  otherBusiness: string;
  beauty: string;
  hotel: string;
  locations: string[];
  hotelProperty: string;
  foodB: { business: string; location: string };
};
const scopeCookie = async (page: Page) =>
  decodeURIComponent(
    (await page.context().cookies()).find((c) => c.name === 'wetop_scope')?.value ?? '',
  );
const setScope = (page: Page, value: string) =>
  page
    .context()
    .addCookies([
      { name: 'wetop_scope', value: encodeURIComponent(value), domain: '127.0.0.1', path: '/' },
    ]);
async function reset(request: import('@playwright/test').APIRequestContext): Promise<Fixture> {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  return res.json();
}
async function choose(page: Page, name: string) {
  const region = page.getByRole('region', { name: 'Выбор филиала' });
  // щелчок до гидрации кнопки теряется (страница уже нарисована, обработчика ещё нет): повторяем, пока панель
  // не откроется; так падал release-checks #252 после смены оболочки на боковое меню
  await expect(async () => {
    if (!(await region.isVisible()))
      await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await expect(region).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  await region
    .getByRole('button')
    .filter({ hasText: name })
    .click();
}
// Match the accepted MV8 setup: switching is tested independently of the Hospitality training modal.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      const value = get.call(this, key);
      return value === null && key.startsWith('wetop.tour.v1:') ? 'done' : value;
    };
  });
});
test.describe('SCOPE-HARDENING: server-chosen branch scope', () => {
  test('несколько филиалов: вход ведёт на выбор, первый филиал сам не выбирается', async ({
    page,
    request,
  }) => {
    await reset(request);
    await page.goto('/scope/resolve?next=%2Ftoday');
    await expect(page).toHaveURL(/\/branches$/);
    expect(await scopeCookie(page)).toBe('');
    await expect(
      page.getByRole('heading', { name: 'Сводка по гостиничным филиалам', exact: true }),
    ).toBeVisible();
    // Смешанная организация: в гостиничной сводке только отель, салон и рестораны не показываются нулями
    const summary = page.getByRole('table', { name: 'Статистика по филиалам' });
    await expect(summary.getByRole('rowheader')).toHaveText(['Тестовый отель']);
  });

  test('устаревший Food: указатель снят, при нескольких филиалах выбор, без 403 на экране', async ({
    page,
    request,
  }) => {
    const f = await reset(request);
    await setScope(page, `business=${f.business};location=${f.locations[0]}`);
    await request.post(`${api}/__test/archive`, { data: { location: f.locations[0] } });
    await page.goto('/floor-plan');
    await expect(page).toHaveURL(/\/branches$/);
    expect(await scopeCookie(page)).toBe('');
  });

  test('устаревший Beauty: тот же выбор, гостиничная страница не открывается молча', async ({
    page,
    request,
  }) => {
    const f = await reset(request);
    await setScope(page, `business=${f.beauty};location=${f.locations[3]}`);
    await request.post(`${api}/__test/archive`, { data: { location: f.locations[3] } });
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/branches$/);
    expect(await scopeCookie(page)).toBe('');
  });

  test('выход и вход в другую организацию: чужой указатель сброшен, единственный филиал выбран сам', async ({
    page,
    request,
  }) => {
    const f = await reset(request);
    await setScope(page, `business=${f.business};location=${f.locations[0]}`);
    await request.post(`${api}/__test/control`, { data: { org: 'B' } });
    await page.goto('/floor-plan');
    await expect(page).toHaveURL(/\/floor-plan$/);
    await expect(page.getByRole('heading', { name: 'План зала', exact: true })).toBeVisible();
    expect(await scopeCookie(page)).toBe(
      `business=${f.foodB.business};location=${f.foodB.location}`,
    );
    await page.reload();
    await expect(page.getByRole('heading', { name: 'План зала', exact: true })).toBeVisible();
    expect(await scopeCookie(page)).toBe(
      `business=${f.foodB.business};location=${f.foodB.location}`,
    );
    // Вход с одним филиалом: next своего направления сохраняется
    await page.context().clearCookies();
    await page.goto('/scope/resolve?next=%2Ftable-reservations');
    await expect(page).toHaveURL(/\/table-reservations$/);
    expect(await scopeCookie(page)).toBe(
      `business=${f.foodB.business};location=${f.foodB.location}`,
    );
    await request.post(`${api}/__test/control`, { data: { org: 'A' } });
  });

  test('переключения: Hospitality → Food → Beauty → Food → Hospitality A → B', async ({
    page,
    request,
  }) => {
    const f = await reset(request);
    const hotelB = await (await request.post(`${api}/__test/second-hotel`)).json();
    await setScope(page, `business=${f.hotel};location=${f.locations[4]}`);
    await page.goto('/today');
    await expect(page.getByRole('main').getByTestId('owner-dashboard')).toBeVisible();
    // MV8: рабочий экран дня один на все направления
    await choose(page, 'Тестовый филиал Центр');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('main').getByTestId('food-today')).toBeVisible();
    await choose(page, 'Тестовый салон');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('main').getByTestId('beauty-today')).toBeVisible();
    await choose(page, 'Тестовый филиал Парк');
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole('main').getByTestId('food-today')).toBeVisible();
    expect(await scopeCookie(page)).toBe(`business=${f.business};location=${f.locations[1]}`);
    await choose(page, 'Тестовый отель');
    await expect(page).toHaveURL(/\/finance$/);
    // Гостиница уходит с общего /today на единые «Финансы»: ждём выбранный филиал перед переключателем.
    await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toContainText('Тестовый отель');
    await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toBeEnabled();
    await expect(page.getByRole('main').getByTestId('owner-dashboard')).toBeVisible();
    await choose(page, 'Гостиница Б');
    // у второго отеля ещё нет номеров: выбор ведёт в его настройку (MV3: владелец с выбранным филиалом попадает в общий
    // экран настройки)
    await expect(page).toHaveURL(/\/register\/setup$/);
    expect(await scopeCookie(page)).toBe(`business=${hotelB.business};location=${hotelB.location}`);
    await page.reload();
    expect(await scopeCookie(page)).toBe(`business=${hotelB.business};location=${hotelB.location}`);
  });
});

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
  await expect(page.getByRole('main').getByTestId('food-today')).toBeVisible();
  await page.goto('/floor-plan');
  await expect(page.getByRole('heading', { name: 'План зала', exact: true })).toBeVisible();
  await choose(page, 'Другой тестовый бизнес');
  await expect(page.getByRole('button', { name: 'Выбрать филиал', exact: true })).toContainText(
    'Другой тестовый бизнес',
  );
  await choose(page, 'Тестовый салон');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('main').getByTestId('beauty-today')).toBeVisible();
  await page.goto('/calendar');
  await expect(page.getByRole('heading', { name: 'Календарь', exact: true })).toBeVisible();
  await choose(page, 'Тестовый отель');
  await expect(page).toHaveURL(/\/finance$/);
  // The accepted branch action preserves a safe Hospitality collection or falls back to the landing.
  await expect(page.getByRole('main').getByTestId('owner-dashboard')).toBeVisible();
  expect(
    decodeURIComponent(
      (await page.context().cookies()).find((c) => c.name === 'wetop_scope')!.value,
    ),
  ).toBe(`business=${f.hotel};location=${f.locations[4]}`);
  await page.reload();
  await expect(page.getByRole('main').getByTestId('owner-dashboard')).toBeVisible();
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});
