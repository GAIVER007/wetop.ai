import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('tests/runs/screenshots/employee-workspace', { recursive: true });
import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
async function theme(page: Page, value: string) {
  await expect(page.getByRole('dialog', { name: 'Мастер', exact: true })).toBeVisible();
  await page.evaluate(async (next) => {
    document.documentElement.dataset.theme = next;
    const panel = document.querySelector('dialog[open]')!;
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
  ]);
  return {
    ...f,
    headers: { 'x-wetop-scope': `business=${f.business};location=${f.locations[0]}` },
  };
}
const dialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Мастер', exact: true }).filter({ visible: true });
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
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const panel = page.getByRole('dialog').filter({ visible: true });
  await expect(panel.getByRole('group', { name: 'Что умеет' })).toHaveCount(0);
  await expect(panel.getByLabel('Мастер работает')).toHaveCount(0);
  await panel
    .getByLabel('Имя мастера', { exact: true })
    .fill('Тестовый мастер с длинным именем для проверки переноса');
  await panel.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Специалист создан' })).toBeVisible();
  await expect(page).toHaveURL(/employee=[0-9a-f-]+#profile/);
  const id = new URL(page.url()).searchParams.get('employee');
  const rows = await read(request, f.headers);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.id).toBe(id);
  expect(rows[0]!.phone).toBeNull();
  expect(rows[0]!.serviceIds).toEqual([]);
  await page.reload();
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue(rows[0]!.name);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const mode of ['light', 'dark']) {
      await theme(page, mode);
      await expect(dialog(page)).toBeVisible();
      expect(
        await dialog(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
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
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  const second = await page.context().newPage();
  await second.goto(`/employees?employee=${f.employee.id}#profile`);
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000001');
  await dialog(page).getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Профиль сохранён' })).toBeVisible();
  await dialog(second)
    .getByLabel(/^Телефон/)
    .fill('+0000000002');
  await dialog(second).getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(dialog(second).getByRole('alert')).toContainText('Профиль изменён');
  await expect(dialog(second).getByLabel(/^Телефон/)).toHaveValue('+0000000002');
  await expect(dialog(second).getByRole('region', { name: 'Сохранённый профиль' })).toContainText(
    '+0000000001',
  );
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000001');
  await dialog(second).getByRole('button', { name: 'Отменить черновик и загрузить профиль', exact: true }).click();
  await expect(dialog(second).getByLabel(/^Телефон/)).toHaveValue('+0000000001');
  await second.close();
});

test('dirty stay, discard and save before tabs/close; failed save keeps draft', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000004');
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await expect(confirm(page)).toBeVisible();
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(dialog(page).getByLabel(/^Телефон/)).toHaveValue('+0000000004');
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await expect(dialog(page).getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await dialog(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  await expect(dialog(page).getByLabel(/^Телефон/)).toHaveValue('');
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000005');
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(dialog(page).getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000005');
  await dialog(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000006');
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await dialog(page).getByRole('button', { name: 'Закрыть: Мастер' }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(confirm(page).getByRole('alert')).toContainText('Сохранение не завершено');
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(dialog(page).getByLabel(/^Телефон/)).toHaveValue('+0000000006');
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000005');
});

test('Back/Forward and keyboard tabs retain a consistent employee URL', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Открыть', exact: true }).click();
  await dialog(page).getByLabel('Имя мастера').fill('Несохранённый тест');
  await page.evaluate(() => history.back());
  await expect(confirm(page)).toBeVisible();
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Несохранённый тест');
  await page.evaluate(() => history.back());
  await confirm(page).getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(dialog(page)).toHaveCount(0);
  await page.evaluate(() => history.forward());
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Тестовый мастер');
  await dialog(page).getByRole('tab', { name: 'Профиль', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog(page).getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/employees$/);
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(new RegExp(`employee=${f.employee.id}`));
  await expect(dialog(page)).toBeVisible();
});

test('inaccessible deep link is neutral and old Beauty entry remains compatible', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees?employee=eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee#profile');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Специалист недоступен');
  await expect(dialog(page)).toHaveCount(0);
  await page.goto(`/beauty/masters?employee=${f.employee.id}#profile`);
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Тестовый мастер');
});

test('lost create response is recovered on reload using one persistent operation', async ({
  page,
  request,
}) => {
  const f = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
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
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Тестовый потерянный ответ');
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
  expect((await response.json()).id).toBe((await read(request, f.headers))[0]!.id);
  expect(await read(request, f.headers)).toHaveLength(1);
});

test('late schedule A cannot populate employee B or a new employee', async ({ page, request }) => {
  const f = await seed(page, request);
  const response = await request.post(`${api}/beauty/employees`, {
    headers: f.headers,
    data: { name: 'Тестовый мастер Б' },
  });
  const b = (await response.json()) as { id: string };
  await request.post(`${api}/beauty/employees/${f.employee.id}/time-offs`, {
    headers: f.headers,
    data: { dateFrom: '2026-10-14', dateTo: '2026-10-15', reason: 'Тестовая причина только А' },
  });
  await page.goto('/employees');
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees*', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Тестовый мастер' })
    .filter({ hasNotText: 'Тестовый мастер Б' })
    .getByRole('button', { name: 'Открыть' })
    .click();
  await ready;
  await dialog(page).getByRole('button', { name: 'Закрыть: Мастер' }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Тестовый мастер Б' })
    .getByRole('button', { name: 'Открыть' })
    .click();
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Тестовый мастер Б');
  release();
  await dialog(page).getByRole('tab', { name: 'График' }).click();
  await expect(dialog(page).getByText('Тестовая причина только А', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`employee=${b.id}`));
});

test('a scope-switch event invalidates an in-flight profile response', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  let release!: () => void;
  let fetched!: () => void;
  const ready = new Promise<void>((resolve) => {
    fetched = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route('**/employees*', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000007');
  await dialog(page).getByRole('button', { name: 'Сохранить изменения' }).click();
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
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Профиль сохранён' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Специалист недоступен');
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'Тестовый мастер', exact: true })).toHaveCount(0);
});

test('services cannot restore a stale name and profile cannot restore stale services', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  const service = (await (
    await request.post(`${api}/beauty/services`, {
      headers: f.headers,
      data: { name: 'Тестовая услуга', durationMinutes: 30, priceMinor: '1000', currency: 'KZT' },
    })
  ).json()) as { id: string };
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await dialog(page).getByLabel('Тестовая услуга', { exact: true }).check();
  const renamed = await request.patch(`${api}/beauty/employees/${f.employee.id}`, {
    headers: f.headers,
    data: { name: 'Имя из другого окна', expectedProfileRevision: f.employee.profileRevision },
  });
  expect(renamed.ok()).toBe(true);
  await dialog(page).getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(
    dialog(page).getByRole('status').filter({ hasText: 'Услуги назначены' }),
  ).toBeVisible();
  const assigned = (await read(request, f.headers))[0]!;
  expect(assigned.name).toBe('Имя из другого окна');
  expect(assigned.serviceIds).toEqual([service.id]);
  await page.reload();
  await dialog(page).getByRole('tab', { name: 'Профиль', exact: true }).click();
  const current = (await read(request, f.headers))[0]!;
  const unassigned = await request.put(`${api}/beauty/employees/${f.employee.id}/services`, {
    headers: f.headers,
    data: { serviceIds: [] },
  });
  expect(unassigned.ok()).toBe(true);
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000008');
  await dialog(page).getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Профиль сохранён' })).toBeVisible();
  const saved = (await read(request, f.headers))[0]!;
  expect(saved.serviceIds).toEqual([]);
  expect(saved.name).toBe(current.name);
});

test('native beforeunload protects reload and preserves draft when dismissed', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  await dialog(page).getByLabel('Имя мастера').fill('Тестовый черновик перед reload');
  let seen = false;
  page.once('dialog', async (prompt) => {
    seen = true;
    expect(prompt.type()).toBe('beforeunload');
    await prompt.dismiss();
  });
  await page.reload({ timeout: 1500 }).catch(() => undefined);
  expect(seen).toBe(true);
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue(
    'Тестовый черновик перед reload',
  );
  page.once('dialog', async (prompt) => {
    await prompt.accept();
  });
  await page.reload();
  await expect(dialog(page).getByLabel('Имя мастера')).toHaveValue('Тестовый мастер');
});

test('dirty internal navigation asks before leaving and stays on failure', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  await dialog(page)
    .getByLabel(/^Телефон/)
    .fill('+0000000009');
  // Hidden panels retain this profile draft while the services panel offers its existing catalogue link.
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Остаться', exact: true }).click();
  // The tab shortcut is a real application link; request the navigation through its DOM control.
  await dialog(page).getByRole('tab', { name: 'Услуги', exact: true }).click();
  await confirm(page).getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await dialog(page).getByRole('link', { name: 'Добавить услуги в каталог салона' }).click();
  await expect(page).toHaveURL(/\/services$/);
  expect((await read(request, f.headers))[0]!.phone).toBe('+0000000009');
});

test('profile fields, keyboard focus and contrast pass an axe audit', async ({ page, request }) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#profile`);
  for (const mode of ['light', 'dark']) {
    await theme(page, mode);
    const results = await new AxeBuilder({ page }).include('dialog[open]').analyze();
    expect(
      results.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes.length })),
    ).toEqual([]);
  }
  await dialog(page).getByRole('tab', { name: 'Профиль' }).focus();
  await page.keyboard.press('End');
  await expect(dialog(page).getByRole('tab', { name: 'График' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(dialog(page).getByRole('tab', { name: 'Профиль' })).toBeFocused();
});

test('pending services save cannot mark a later checkbox edit as saved', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await request.post(`${api}/beauty/services`, {
    headers: f.headers,
    data: {
      name: 'Тестовая услуга ожидания',
      durationMinutes: 30,
      priceMinor: '1000',
      currency: 'KZT',
    },
  });
  await page.goto(`/employees?employee=${f.employee.id}#services`);
  const checkbox = dialog(page).getByLabel('Тестовая услуга ожидания', { exact: true });
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
  await page.route('**/employees*', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  try {
    await dialog(page).getByRole('button', { name: 'Сохранить услуги' }).click();
    await ready;
    await expect(checkbox).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    dialog(page).getByRole('status').filter({ hasText: 'Услуги назначены' }),
  ).toBeVisible();
  await expect(checkbox).toBeEnabled();
  expect((await read(request, f.headers))[0]!.serviceIds).toHaveLength(1);
});

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

test('a later week edit stays dirty after the submitted week is saved', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/employees?employee=${f.employee.id}#schedule`);
  const monday = dialog(page).getByRole('group', { name: 'Понедельник', exact: true });
  await monday.getByRole('button', { name: 'Сделать рабочим' }).click();
  await monday.getByLabel('Понедельник: начало', { exact: true }).fill('09:00');
  const end = monday.getByLabel('Понедельник: конец', { exact: true });
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
  await page.route('**/employees*', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const result = await route.fetch();
    fetched();
    await held;
    await route.fulfill({ response: result });
  });
  await dialog(page).getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await ready;
  await end.fill('19:00');
  release();
  await expect(
    dialog(page).getByRole('status').filter({ hasText: 'График сохранён' }),
  ).toBeVisible();
  await expect(end).toHaveValue('19:00');
  const saved = await (
    await request.get(`${api}/beauty/schedule?employee=${f.employee.id}`, { headers: f.headers })
  ).json();
  expect(saved.week.find((day: { weekday: number }) => day.weekday === 1).intervals).toEqual([
    { timeFrom: '09:00', timeTo: '18:00' },
  ]);
  await dialog(page).getByRole('tab', { name: 'Профиль' }).click();
  await expect(confirm(page)).toBeVisible();
  await confirm(page).getByRole('button', { name: 'Остаться' }).click();
  await expect(end).toHaveValue('19:00');
});
