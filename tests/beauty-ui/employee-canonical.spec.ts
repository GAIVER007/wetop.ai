import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;

type Fixture = { business: string; otherBusiness: string; locations: string[] };

async function reset(page: Page, request: APIRequestContext) {
  const response = await request.post(`${api}/__test/reset`);
  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  const fixture = JSON.parse(text) as Fixture;
  const pointer = `business=${fixture.business};location=${fixture.locations[0]}`;
  await page.context().addCookies([
    { name: 'wetop_scope', value: encodeURIComponent(pointer), domain: '127.0.0.1', path: '/' },
    {
      name: 'wetop_session',
      value: 'synthetic-beauty-ui-session',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
    },
  ]);
  return { ...fixture, headers: { 'x-wetop-scope': pointer } };
}

async function seed(page: Page, request: APIRequestContext) {
  const fixture = await reset(page, request);
  const response = await request.post(`${api}/beauty/employees`, {
    headers: fixture.headers,
    data: { name: 'Тестовый мастер' },
  });
  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  return { ...fixture, employee: JSON.parse(text) as { id: string } };
}

async function employees(request: APIRequestContext, headers: Record<string, string>) {
  const response = await request.get(`${api}/beauty/employees`, { headers });
  const text = await response.text();
  expect(response.ok(), text).toBe(true);
  return JSON.parse(text).items as Array<{
    id: string;
    name: string;
    phone: string | null;
    serviceIds: string[];
  }>;
}

test.afterEach(async ({ request }) => {
  const cleanup = await request.post(`${api}/__test/cleanup`);
  expect(cleanup.ok(), await cleanup.text()).toBe(true);
});

test('create, canonical links and legacy addresses use one full employee profile', async ({
  page,
  request,
}) => {
  const fixture = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Новый специалист', exact: true });
  await creation.getByLabel('Имя', { exact: true }).fill('Тестовый новый мастер');
  await creation.getByRole('combobox', { name: 'Уровень доступа' }).selectOption('NONE');
  await creation.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  const createdUrl = page.url();
  const id = createdUrl.split('/').at(-2)!;
  const profile = page.getByTestId('employee-manager');
  await expect(profile.getByRole('heading', { name: 'Тестовый новый мастер', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await employees(request, fixture.headers)).map((item) => item.id)).toContain(id);

  await page.goto(`/employees?employee=${id}#profile`);
  await expect(page).toHaveURL(createdUrl);
  await page.goto(`/beauty/masters?employee=${id}#profile`);
  await expect(page).toHaveURL(createdUrl);

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('two full-profile forms reject a stale save and retain its draft', async ({ page, request }) => {
  const fixture = await seed(page, request);
  await page.goto(`/employees/${fixture.employee.id}/profile`);
  const second = await page.context().newPage();
  await second.goto(`/employees/${fixture.employee.id}/profile`);

  await page.getByTestId('portal-profile-form').getByLabel('Телефон для связи').fill('+0000000001');
  await page.getByTestId('portal-profile-form').getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(page.getByTestId('portal-profile-form').getByRole('status')).toContainText('Сохранено');

  const stale = second.getByTestId('portal-profile-form');
  await stale.getByLabel('Телефон для связи').fill('+0000000002');
  await stale.getByRole('button', { name: 'Сохранить профиль' }).click();
  await expect(stale.getByRole('alert')).toContainText('Данные изменились');
  await expect(stale.getByLabel('Телефон для связи')).toHaveValue('+0000000002');
  expect((await employees(request, fixture.headers))[0]!.phone).toBe('+0000000001');
  await second.close();
});

test('manager assigns and removes salon services in the canonical profile', async ({ page, request }) => {
  const fixture = await seed(page, request);
  const created = await request.post(`${api}/beauty/services`, {
    headers: fixture.headers,
    data: { name: 'Тестовая услуга', durationMinutes: 45, priceMinor: '500000', currency: 'KZT' },
  });
  const createdText = await created.text();
  expect(created.ok(), createdText).toBe(true);
  const service = JSON.parse(createdText) as { id: string };
  const enabled = await request.put(`${api}/beauty/services/${service.id}/location`, {
    headers: fixture.headers,
    data: { enabled: true },
  });
  expect(enabled.ok(), await enabled.text()).toBe(true);

  await page.goto(`/employees/${fixture.employee.id}/profile`);
  await page.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const services = page.getByTestId('portal-services-form');
  await services.getByRole('checkbox', { name: /^Тестовая услуга(?:\s|$)/ }).check();
  await services.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(services.getByRole('status')).toContainText('Сохранено');
  expect((await employees(request, fixture.headers))[0]!.serviceIds).toEqual([service.id]);

  await services.getByRole('checkbox', { name: /^Тестовая услуга(?:\s|$)/ }).uncheck();
  await services.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(services.getByRole('status')).toContainText('Сохранено');
  expect((await employees(request, fixture.headers))[0]!.serviceIds).toEqual([]);
});

test('lost create response is recovered once and redirects to the saved full profile', async ({
  page,
  request,
}) => {
  const fixture = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Новый специалист', exact: true });
  await creation.getByLabel('Имя').fill('Тестовый потерянный ответ');
  let intercepted = false;
  let finishLostResponse = () => {};
  const lostResponse = new Promise<void>((resolve) => { finishLostResponse = resolve; });
  await page.route('**/employees', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    await route.fetch();
    await route.abort('failed');
    finishLostResponse();
  });
  await creation.getByRole('combobox', { name: 'Уровень доступа' }).selectOption('NONE');
  await creation.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
  await expect.poll(async () => (await employees(request, fixture.headers)).length).toBe(1);
  await lostResponse;
  await page.unroute('**/employees');
  page.once('dialog', async (prompt) => prompt.accept());
  await page.reload();
  const saved = (await employees(request, fixture.headers))[0]!;
  await expect(page).toHaveURL(new RegExp(`/employees/${saved.id}/profile$`));
  await expect(page.getByTestId('employee-manager')).toContainText('Тестовый потерянный ответ');
});

test('dirty creation still uses the save-before-leaving guard', async ({ page, request }) => {
  const fixture = await reset(page, request);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Новый специалист', exact: true });
  await creation.getByLabel('Имя').fill('Тестовый мастер перед закрытием');
  await creation.getByRole('button', { name: 'Закрыть: Новый специалист' }).click();
  const confirm = page.getByRole('dialog', { name: 'Несохранённые изменения', exact: true });
  await confirm.getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  await expect(page.getByTestId('employee-manager')).toContainText('Тестовый мастер перед закрытием');
  expect(await employees(request, fixture.headers)).toHaveLength(1);
});

test('dirty canonical profile guards tabs, keeps failed saves and protects reload', async ({
  page,
  request,
}) => {
  const fixture = await seed(page, request);
  await page.goto(`/employees/${fixture.employee.id}/profile`);
  const form = page.getByTestId('portal-profile-form');
  await form.getByLabel('Телефон для связи').fill('+0000000004');
  await page.getByRole('tab', { name: 'Услуги', exact: true }).click();
  let confirm = page.getByRole('dialog', { name: 'Несохранённые изменения', exact: true });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(form.getByLabel('Телефон для связи')).toHaveValue('+0000000004');

  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await page.getByRole('tab', { name: 'Услуги', exact: true }).click();
  confirm = page.getByRole('dialog', { name: 'Несохранённые изменения', exact: true });
  await confirm.getByRole('button', { name: 'Сохранить и перейти', exact: true }).click();
  await expect(confirm.getByRole('alert')).toContainText('Сохранение не завершено');
  await confirm.getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(form.getByLabel('Телефон для связи')).toHaveValue('+0000000004');
  expect((await employees(request, fixture.headers))[0]!.phone).toBeNull();

  let beforeUnloadSeen = false;
  page.once('dialog', async (prompt) => {
    beforeUnloadSeen = prompt.type() === 'beforeunload';
    await prompt.dismiss();
  });
  await page.reload({ timeout: 1500 }).catch(() => undefined);
  expect(beforeUnloadSeen).toBe(true);
  await expect(form.getByLabel('Телефон для связи')).toHaveValue('+0000000004');
});

test('canonical profile keeps keyboard tabs and accessibility in both themes', async ({
  page,
  request,
}) => {
  const fixture = await seed(page, request);
  await page.goto(`/employees/${fixture.employee.id}/profile`);
  const profile = page.getByTestId('employee-manager');
  const firstTab = profile.getByRole('tab', { name: 'Профиль', exact: true });
  await firstTab.focus();
  await page.keyboard.press('End');
  await expect(profile.getByRole('tab', { name: 'Управление', exact: true })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(firstTab).toBeFocused();

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    const results = await new AxeBuilder({ page }).include('[data-testid="employee-manager"]').analyze();
    expect(results.violations).toEqual([]);
  }
});

/** Держит первый POST на страницу профиля, пока тест не отпустит его: так видно поведение формы посреди запроса */
async function holdNextSave(page: Page) {
  let release!: () => void;
  let arrived!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  let intercepted = false;
  await page.route('**/employees/*/profile', async (route) => {
    if (route.request().method() !== 'POST' || intercepted) return route.continue();
    intercepted = true;
    const response = await route.fetch();
    arrived();
    await held;
    await route.fulfill({ response });
  });
  return { reached, release };
}

test('a scope switch during a profile save does not apply the old response', async ({ page, request }) => {
  const fixture = await seed(page, request);
  await page.goto(`/employees/${fixture.employee.id}/profile`);
  const profile = page.getByTestId('employee-manager');
  const form = profile.getByTestId('portal-profile-form');
  const save = await holdNextSave(page);
  await form.getByLabel('Телефон для связи').fill('+0000000007');
  await form.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await save.reached;
  // филиал сменили, пока сохранение было в пути: карточка старого филиала закрывается, его ответ никуда не пишется
  await page.evaluate(() => window.dispatchEvent(new Event('wetop-scope-switch')));
  save.release();
  await expect(profile).toHaveCount(0);
  await expect(page.getByText('Сохранено на сервере', { exact: true })).toHaveCount(0);
});

test('a profile save does not strand the week editor, and the week is locked while it saves', async ({
  page,
  request,
}) => {
  const fixture = await seed(page, request);
  await page.goto(`/employees/${fixture.employee.id}/profile`);
  const profile = page.getByTestId('employee-manager');
  const form = profile.getByTestId('portal-profile-form');
  // вымышленный номер в формате +7: поле и перечитанная страница показывают его одинаково, форма не считается изменённой.
  // Иностранный номер (не +7) поле при вводе не форматирует, а после сохранения страница показывает группами по три цифры
  await form.getByLabel('Телефон для связи').fill('+70000000008');
  await form.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('Сохранено на сервере');

  // версия недели сдвинулась вместе с профилем: нетронутая неделя берёт новую, без ложного конфликта
  await profile.getByRole('tab', { name: 'График', exact: true }).click();
  const week = profile.getByTestId('portal-week-form');
  const monday = week.getByRole('group', { name: 'Понедельник', exact: true });
  await monday.getByRole('button', { name: 'Понедельник: добавить интервал', exact: true }).click();
  await monday.getByLabel('Понедельник: начало', { exact: true }).fill('09:00');
  const end = monday.getByLabel('Понедельник: до, интервал 1', { exact: true });
  await end.fill('18:00');
  const save = await holdNextSave(page);
  await week.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await save.reached;
  // поздней правки посреди сохранения не бывает: поля недели закрыты до ответа сервера
  await expect(end).toBeDisabled();
  save.release();
  await expect(week.getByRole('status')).toContainText('Сохранено на сервере');
  await expect(week.getByRole('alert')).toHaveCount(0);
  const saved = await (
    await request.get(`${api}/beauty/schedule?employee=${fixture.employee.id}`, { headers: fixture.headers })
  ).json();
  expect(saved.week.find((day: { weekday: number }) => day.weekday === 1).intervals).toEqual([
    { timeFrom: '09:00', timeTo: '18:00' },
  ]);
  // сохранённая неделя не числится несохранённой: уход на другую вкладку без вопроса
  await profile.getByRole('tab', { name: 'Профиль', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Несохранённые изменения', exact: true })).toHaveCount(0);
  await expect(form).toBeVisible();
});
