import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tests/runs/screenshots/employee-workspace', { recursive: true });
import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
async function theme(page: Page, value: string) {
  await expect(manager(page)).toBeVisible();
  await page.evaluate(async (next) => {
    document.documentElement.dataset.theme = next;
    const panel = document.querySelector('[data-testid="employee-manager"]')!;
    // Measure stable theme colours after existing finite CSS transitions, not an intermediate frame.
    void getComputedStyle(panel).backgroundColor;
    await Promise.all(
      panel
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  }, value);
}
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
    {
      name: 'wetop_session',
      value: 'synthetic-beauty-ui-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
    },
  ]);
  return {
    ...f,
    headers: { 'x-wetop-scope': `business=${f.business};location=${f.locations[0]}` },
  };
}
const manager = (page: Page) => page.getByTestId('employee-manager');
const profile = (page: Page) => manager(page).getByTestId('portal-profile-form');
const confirm = (page: Page) =>
  page
    .getByRole('dialog', { name: 'Несохранённые изменения', exact: true })
    .filter({ visible: true });
async function seed(page: Page, request: APIRequestContext) {
  const f = await reset(page, request);
  const response = await request.post(`${api}/beauty/employees`, {
    headers: f.headers,
    data: { name: 'Тестовый мастер' },
  });
  expect(response.ok()).toBe(true);
  return { ...f, employee: (await response.json()) as { id: string; profileRevision: string } };
}

async function enableService(
  request: APIRequestContext,
  headers: Record<string, string>,
  name: string,
) {
  const response = await request.post(`${api}/beauty/services`, {
    headers,
    data: { name, durationMinutes: 30, priceMinor: '1000', currency: 'KZT' },
  });
  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  const service = JSON.parse(text) as { id: string };
  const enabled = await request.put(`${api}/beauty/services/${service.id}/location`, {
    headers,
    data: { enabled: true },
  });
  expect(enabled.ok(), await enabled.text()).toBe(true);
  return service;
}
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

test('minimal create, saved ID, reload and actual desktop/mobile themes', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  const panel = page.getByRole('dialog').filter({ visible: true });
  await expect(panel.getByRole('group', { name: 'Что умеет' })).toHaveCount(0);
  await expect(panel.getByLabel('Мастер работает')).toHaveCount(0);
  await panel
    .getByLabel('Имя мастера', { exact: true })
    .fill('Тестовый мастер с длинным именем для проверки переноса');
  await panel.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  const id = new URL(page.url()).pathname.split('/').at(-2);
  const rows = await read(request, f.headers);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.id).toBe(id);
  expect(rows[0]!.phone).toBeNull();
  expect(rows[0]!.serviceIds).toEqual([]);
  await page.reload();
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue(rows[0]!.name);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['light', 'dark']) {
      await theme(page, mode);
      await expect(manager(page)).toBeVisible();
      expect(
        await manager(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `tests/runs/screenshots/employee-workspace/profile-${width}-${mode}.png` });
    }
  }
});

test('two stale forms keep the second draft and show the current profile', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  const second = await page.context().newPage();
  await second.goto(`/employees/${f.employee.id}/profile`);
  await profile(page).getByLabel('Телефон для связи').fill('+0000000001');
  await profile(page).getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(profile(page).getByRole('status')).toContainText('Сохранено');
  await profile(second).getByLabel('Телефон для связи').fill('+0000000002');
  await profile(second).getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(profile(second).getByRole('alert')).toContainText('Данные изменились');
  await expect(profile(second).getByLabel('Телефон для связи')).toHaveValue('+0000000002');
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000001');
  await profile(second).getByRole('button', { name: 'Отменить черновик и загрузить профиль', exact: true }).click();
  second.once('dialog', async (prompt) => prompt.accept());
  await second.getByRole('dialog', { name: 'Отменить черновик профиля?' })
    .getByRole('button', { name: 'Отменить черновик и загрузить профиль', exact: true }).click();
  await expect(profile(second).getByLabel('Телефон для связи')).toHaveValue('+0000000001');
  await second.close();
});

test('dirty stay, discard and save before tabs/close; failed save keeps draft', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  await profile(page).getByLabel('Телефон для связи').fill('+0000000004');
  await manager(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await expect(confirm(page)).toBeVisible();
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(profile(page).getByLabel('Телефон для связи')).toHaveValue('+0000000004');
  await manager(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await expect(manager(page).getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await manager(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  await expect(profile(page).getByLabel('Телефон для связи')).toHaveValue('');
  await profile(page).getByLabel('Телефон для связи').fill('+0000000005');
  await manager(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(manager(page).getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000005');
  await manager(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  await profile(page).getByLabel('Телефон для связи').fill('+0000000006');
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await manager(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(confirm(page).getByRole('alert')).toContainText('Сохранение не завершено');
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(profile(page).getByLabel('Телефон для связи')).toHaveValue('+0000000006');
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000005');
});

test('Back/Forward and keyboard tabs retain a consistent employee URL', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees');
  await page.goto(`/employees/${f.employee.id}/profile`);
  await manager(page).getByRole('tab', { name: 'Профиль', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(manager(page).getByRole('tab', { name: 'Записи', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page).toHaveURL(new RegExp(`/employees/${f.employee.id}/profile#work$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/employees$/);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/employees/${f.employee.id}/profile#work$`));
  await expect(manager(page)).toBeVisible();
});

test('inaccessible deep link is neutral and old Beauty entry remains compatible', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee/profile');
  await expect(page.getByTestId('portal-unavailable')).toContainText('Кабинет недоступен');
  await expect(manager(page)).toHaveCount(0);
  await page.goto(`/beauty/masters?employee=${f.employee.id}#profile`);
  await expect(page).toHaveURL(new RegExp(`/employees/${f.employee.id}/profile$`));
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue('Тестовый мастер');
});

test('lost create response is recovered on reload using one persistent operation', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  await page
    .getByRole('dialog')
    .filter({ visible: true })
    .getByLabel('Имя мастера')
    .fill('Тестовый потерянный ответ');
  const key = await page.evaluate(
    (scope) => sessionStorage.getItem(`wetop:beauty:create:${scope}:employee`),
    f.locations[0]!,
  );
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
  let aborted!: () => void;
  const abortFinished = new Promise<void>((resolve) => {
    aborted = resolve;
  });
  let intercepted = false;
  await page.route('**/employees', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    await route.fetch();
    await route.abort('failed');
    aborted();
  });
  await page
    .getByRole('dialog')
    .filter({ visible: true })
    .getByRole('button', { name: 'Создать мастера', exact: true })
    .click();
  await abortFinished;
  await expect.poll(async () => (await read(request, f.headers)).length).toBe(1);
  await page.unroute('**/employees');
  page.once('dialog', async (prompt) => {
    await prompt.accept();
  });
  await page.reload();
  const saved = (await read(request, f.headers))[0]!;
  await expect(page).toHaveURL(new RegExp(`/employees/${saved.id}/profile$`));
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue('Тестовый потерянный ответ');
  expect(
    await page.evaluate(
      (scope) => sessionStorage.getItem(`wetop:beauty:create:${scope}:employee`),
      f.locations[0]!,
    ),
  ).toBeNull();
  const response = await request.post(`${api}/beauty/employees`, {
    headers: f.headers,
    data: {
      creationId: key,
      name: 'Тестовый потерянный ответ',
      phone: '',
      email: '',
      active: true,
    },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).id).toBe(saved.id);
  expect(await read(request, f.headers)).toHaveLength(1);
});

test('late schedule A cannot populate employee B or a new employee', async ({ page, request }) => {
  const f = await seed(page, request);
  const response = await request.post(`${api}/beauty/employees`, {
    headers: f.headers,
    data: { name: 'Тестовый мастер Б' },
  });
  const b = (await response.json()) as { id: string };
  await page.goto(`/employees/${f.employee.id}/profile#week`);
  const mondayA = manager(page).getByRole('group', { name: 'Понедельник', exact: true });
  await mondayA.getByRole('button', { name: 'Понедельник: добавить интервал' }).click();
  await mondayA.getByLabel('Понедельник: начало').fill('09:00');
  await mondayA.getByLabel('Понедельник: до, интервал 1').fill('18:00');
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees/**/profile', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await manager(page).getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await ready;
  page.once('dialog', async (prompt) => prompt.accept());
  const navigation = page.goto(`/employees/${b.id}/profile#week`);
  release();
  await navigation;
  await expect(page).toHaveURL(new RegExp(`/employees/${b.id}/profile#week$`));
  await expect(manager(page).getByRole('heading', { name: 'Тестовый мастер Б', exact: true })).toBeVisible();
  const mondayB = manager(page).getByRole('group', { name: 'Понедельник', exact: true });
  await expect(mondayB).toContainText('Выходной');
  await expect(mondayB.getByLabel('Понедельник: начало')).toHaveCount(0);
});

test('a scope-switch event invalidates an in-flight profile response', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees/**/profile', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await profile(page).getByLabel('Телефон для связи').fill('+0000000007');
  await profile(page).getByRole('button', { name: 'Сохранить профиль' }).click();
  await ready;
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(`business=${f.otherBusiness};location=${f.locations[2]}`),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event('wetop-scope-switch')));
  release();
  await expect(page.getByRole('status').filter({ hasText: 'Переключаем филиал' })).toBeVisible();
  await expect(manager(page)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Сохранено на сервере' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('portal-unavailable')).toContainText('Кабинет недоступен');
  await expect(manager(page)).toHaveCount(0);
});

test('services cannot restore a stale name and profile cannot restore stale services', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  const service = await enableService(request, f.headers, 'Тестовая услуга');
  await page.goto(`/employees/${f.employee.id}/profile#services`);
  await manager(page).getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const services = manager(page).getByTestId('portal-services-form');
  await services.getByRole('checkbox', { name: /^Тестовая услуга(?:\s|$)/ }).check();
  const renamed = await request.patch(`${api}/beauty/employees/${f.employee.id}`, {
    headers: f.headers,
    data: { name: 'Имя из другого окна', expectedProfileRevision: f.employee.profileRevision },
  });
  expect(renamed.ok()).toBe(true);
  await services.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(services.getByRole('status')).toContainText('Сохранено');
  const assigned = (await read(request, f.headers))[0]!;
  expect(assigned.name).toBe('Имя из другого окна');
  expect(assigned.serviceIds).toEqual([service.id]);
  await page.reload();
  await manager(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  const current = (await read(request, f.headers))[0]!;
  const unassigned = await request.put(`${api}/beauty/employees/${f.employee.id}/services`, {
    headers: f.headers,
    data: { serviceIds: [] },
  });
  expect(unassigned.ok()).toBe(true);
  await profile(page).getByLabel('Телефон для связи').fill('+0000000008');
  await profile(page).getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await expect(profile(page).getByRole('status')).toContainText('Сохранено');
  const saved = (await read(request, f.headers))[0]!;
  expect(saved.serviceIds).toEqual([]);
  expect(saved.name).toBe(current.name);
});

test('native beforeunload protects reload and preserves draft when dismissed', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  await profile(page).getByLabel('Имя в карточке').fill('Тестовый черновик перед reload');
  let seen = false;
  page.once('dialog', async (prompt) => {
    seen = true;
    expect(prompt.type()).toBe('beforeunload');
    await prompt.dismiss();
  });
  await page.reload({ timeout: 1500 }).catch(() => undefined);
  expect(seen).toBe(true);
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue(
    'Тестовый черновик перед reload',
  );
  page.once('dialog', async (prompt) => {
    await prompt.accept();
  });
  await page.reload();
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue('Тестовый мастер');
});

test('dirty internal navigation asks before leaving and stays on failure', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  await profile(page).getByLabel('Телефон для связи').fill('+0000000009');
  await manager(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await page.getByRole('navigation', { name: 'Главное меню' }).getByRole('button', { name: 'Услуги', exact: true }).click();
  await page.locator('a[href="/services"]:visible').first().click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000009');
});

test('profile fields, keyboard focus and contrast pass an axe audit', async ({ page, request }) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile`);
  for (const mode of ['light', 'dark']) {
    await theme(page, mode);
    const results = await new AxeBuilder({ page })
      .include('[data-testid="employee-manager"]')
      .analyze();
    expect(
      results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.length })),
    ).toEqual([]);
  }
  await manager(page).getByRole('tab', { name: 'Профиль' }).focus();
  await page.keyboard.press('End');
  await expect(manager(page).getByRole('tab', { name: 'Управление' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(manager(page).getByRole('tab', { name: 'Профиль' })).toBeFocused();
});

test('pending services save cannot mark a later checkbox edit as saved', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await enableService(request, f.headers, 'Тестовая услуга ожидания');
  await page.goto(`/employees/${f.employee.id}/profile#services`);
  await manager(page).getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const services = manager(page).getByTestId('portal-services-form');
  const checkbox = services.getByRole('checkbox', { name: /^Тестовая услуга ожидания(?:\s|$)/ });
  await checkbox.check();
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees/**/profile', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  try {
    await services.getByRole('button', { name: 'Сохранить услуги' }).click();
    await ready;
    await expect(checkbox).toBeDisabled();
  } finally {
    release();
  }
  await expect(services.getByRole('status')).toContainText('Сохранено');
  await expect(checkbox).toBeEnabled();
  expect((await read(request, f.headers))[0]!.serviceIds).toHaveLength(1);
});

test('saving dirty creation before close leaves one saved employee in the canonical profile', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  const creating = page.getByRole('dialog', { name: 'Новый мастер', exact: true });
  await creating.getByLabel('Имя мастера').fill('Тестовый мастер перед закрытием');
  await creating.getByRole('button', { name: 'Закрыть: Новый мастер' }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти' }).click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
  expect(await read(request, f.headers)).toHaveLength(1);
  await page.reload();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  await expect(profile(page).getByLabel('Имя в карточке')).toHaveValue(
    'Тестовый мастер перед закрытием',
  );
  await expect(page.getByRole('dialog').filter({ visible: true })).toHaveCount(0);
});

test('a later week edit stays dirty after the submitted week is saved', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees/${f.employee.id}/profile#week`);
  const monday = manager(page).getByRole('group', { name: 'Понедельник', exact: true });
  await monday.getByRole('button', { name: 'Понедельник: добавить интервал' }).click();
  await monday.getByLabel('Понедельник: начало', { exact: true }).fill('09:00');
  const end = monday.getByLabel('Понедельник: до, интервал 1', { exact: true });
  await end.fill('18:00');
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees/**/profile', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await manager(page).getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await ready;
  await expect(end).toBeDisabled();
  release();
  await expect(manager(page).getByTestId('portal-week').getByRole('status')).toContainText(
    'Сохранено',
  );
  await expect(end).toBeEnabled();
  await end.fill('19:00');
  await expect(end).toHaveValue('19:00');
  const saved = await (
    await request.get(`${api}/beauty/schedule?employee=${f.employee.id}`, { headers: f.headers })
  ).json();
  expect(saved.week.find((day: { weekday: number }) => day.weekday === 1).intervals).toEqual([
    { timeFrom: '09:00', timeTo: '18:00' },
  ]);
  await manager(page).getByRole('tab', { name: 'Профиль' }).click();
  await expect(confirm(page)).toBeVisible();
  await confirm(page).getByRole('button', { name: 'Остаться' }).click();
  await expect(end).toHaveValue('19:00');
});
