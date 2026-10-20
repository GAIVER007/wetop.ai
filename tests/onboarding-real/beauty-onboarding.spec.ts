import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
const api = 'http://127.0.0.1:55844';
const site = 'http://127.0.0.1:55845';
const evidence = '.onboarding-work/evidence/screenshots';
const DAY = 24 * 60 * 60 * 1000;

/**
 * Карточка мастера открывается диалогом поверх списка (341554556, решение владельца 19.10, как у zapis.kz):
 * после создания адрес `/employees?employee=<id>#profile`, полная карточка по ссылке из диалога.
 */
async function openFullProfile(page: Page, id?: string) {
  await expect(page).toHaveURL(
    id ? new RegExp(`[?&]employee=${id}#profile$`) : /\/employees\?(?:.*&)?employee=[0-9a-f-]+#profile$/,
  );
  const master = page.getByRole('dialog', { name: 'Мастер', exact: true });
  await master.getByRole('link', { name: 'Полная карточка сотрудника', exact: true }).click();
  await expect(page).toHaveURL(id ? new RegExp(`/employees/${id}/profile$`) : /\/employees\/[0-9a-f-]+\/profile$/);
}
mkdirSync(evidence, { recursive: true });

async function register(page: Page, suffix: string, entry: 'hash' | 'cta' = 'hash') {
  const email = `onboarding-${suffix}-${randomUUID()}@example.invalid`;
  if (entry === 'cta') {
    // Настоящая кнопка страницы «Для салонов красоты», как её нажимает посетитель сайта
    await page.goto(`${site}/for/salons/`);
    // окно открывается на месте только после загрузки скриптов страницы; клик раньше уводит ссылкой на главную,
    // где направление выбирают сами (так под нагрузкой раннера упал гейт 354783d7)
    await page.waitForLoadState('networkidle');
    await page.locator('.salon-hero').getByRole('link', { name: /Начать работу/ }).click();
  } else await page.goto(`${site}/?vertical=BEAUTY#register`);
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Тестовый Владелец');
  await dialog.locator('input[name="businessName"]').fill('Салон Автотест');
  // С кнопки страницы салонов направление закреплено ссылкой, выбора нет; с главной выбирают сами
  if (entry === 'cta') await expect(dialog.getByTestId('auth-vertical-fixed')).toContainText('Салон');
  else await dialog.locator('input[value="BEAUTY"]').check();
  await dialog.locator('input[name="phone"]').fill('7000000000');
  await dialog.locator('input[name="email"]').fill(email);
  await dialog.locator('input[name="password"]').fill('Onboarding-Test-2026!a');
  await dialog.locator('input[name="privacyAccepted"]').check();
  await dialog.locator('button[type="submit"]').click();
  await expect
    .poll(async () => {
      const reply = await page.request.get(
        `${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`,
      );
      return Boolean((await reply.json()).link);
    })
    .toBe(true);
  const reply = await page.request.get(
    `${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`,
  );
  const { link } = await reply.json();
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Добро пожаловать в WETOP');
  return email;
}
async function shots(page: Page, name: string) {
  for (const width of [1440, 390])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
      await page.evaluate((t) => {
        localStorage.setItem('wetop.theme', t);
      }, theme);
      await page.reload();
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveAttribute('data-testid', 'beauty-onboarding');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      expect(
        (await new AxeBuilder({ page }).include('#main-content').analyze()).violations,
      ).toEqual([]);
      await page.screenshot({ path: `${evidence}/${name}-${width}-${theme}.png`, fullPage: true });
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test('O01/O04/O05/O22/O24/O25: real registration, linked Beauty setup, working calendar', async ({
  page,
}) => {
  const email = await register(page, 'full', 'cta');
  await shots(page, 'welcome');
  await page.getByRole('button', { name: 'Настроить салон', exact: true }).click();
  await expect(page.getByLabel('Название салона', { exact: true })).toHaveValue('Салон Автотест');
  await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click();
  await expect(
    page.getByText('Выполнено 0 из 4 обязательных шагов', { exact: true }),
  ).toBeVisible();
  await shots(page, 'checklist-empty');
  // Кто вошёл: своя организация в пробном периоде 7 дней (ADR-TRIAL-7-DAYS-20261017), салон, выбранный филиал
  const firstHeaders = await apiHeaders(page);
  const me = await (await page.request.get(`${api}/auth/me`, { headers: firstHeaders })).json();
  expect(me.organization.status).toBe('TRIAL');
  const trialLeft = Date.parse(me.organization.trialEndsAt) - Date.now();
  expect(trialLeft).toBeGreaterThan(7 * DAY - 15 * 60_000);
  expect(trialLeft).toBeLessThanOrEqual(7 * DAY);
  expect(me.context.vertical).toBe('BEAUTY');
  expect(me.context.locationId).toBeTruthy();
  await page.getByRole('link', { name: 'Добавить услугу', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('input[name="name"]').fill('Тестовая стрижка');
  await dialog.locator('input[name="durationMinutes"]').fill('30');
  await dialog.getByLabel(/^Цена каталога,/).fill('0');
  await dialog.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(dialog.getByLabel('Филиал оказывает эту услугу')).toBeVisible();
  await dialog.getByLabel('Филиал оказывает эту услугу').check();
  await dialog.getByRole('button', { name: 'Сохранить для филиала', exact: true }).click();
  await expect(dialog.getByText('Настройки филиала сохранены', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Вернуться к настройке салона', exact: true }).click();
  await expect(
    page.getByText('Выполнено 1 из 4 обязательных шагов', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Добавить специалиста', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя мастера', { exact: true }).fill('Тестовый Мастер');
  await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await openFullProfile(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const manager = page.getByTestId('employee-manager');
  await manager.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await manager.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const skills = page.getByTestId('portal-services-form');
  await skills.getByRole('checkbox', { name: /^Тестовая стрижка/ }).check();
  await page.screenshot({path:`${evidence}/employee-before-services-save.png`,fullPage:true});
  await skills.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(skills.getByRole('status')).toContainText('Сохранено на сервере');
  await goToEmployeesList(page);
  await expect(page.getByRole('listitem').filter({hasText:'Тестовый Мастер'})).toContainText('Тестовая стрижка');
  await page.getByRole('link', { name: 'Вернуться к настройке салона', exact: true }).click();
  await expect(
    page.getByText('Выполнено 3 из 4 обязательных шагов', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Настроить график', exact: true }).click();
  // график это сетка недели: часы мастера открываются по его имени (17.10.2026)
  await page.getByRole('main').getByRole('button', { name: 'Тестовый Мастер', exact: true }).click();
  dialog = page.getByRole('dialog');
  const monday = dialog.getByRole('group', { name: 'Понедельник', exact: true });
  await monday.getByRole('button', { name: 'Сделать рабочим', exact: true }).click();
  await monday.getByLabel('Понедельник: начало').fill('09:00');
  await monday.getByLabel('Понедельник: конец').fill('18:00');
  await dialog.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(dialog.getByText('График сохранён', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Вернуться к настройке салона', exact: true }).click();
  await expect(
    page.getByText('Выполнено 4 из 4 обязательных шагов', { exact: true }),
  ).toBeVisible();
  await shots(page, 'checklist-ready');
  await page.getByRole('button', { name: 'Завершить настройку', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Салон готов к работе');
  await page.screenshot({ path: `${evidence}/completed-1440.png`, fullPage: true });
  await page.getByRole('link', { name: 'Открыть календарь', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  const nextMonday = new Date();
  nextMonday.setUTCDate(nextMonday.getUTCDate() + ((8 - nextMonday.getUTCDay()) % 7 || 7));
  const date = nextMonday.toISOString().slice(0, 10);
  await page.goto(`/calendar?date=${date}`);
  const main = page.getByRole('main');
  await expect(main.getByTestId('beauty-day-summary')).toContainText('Записей на этот день нет');
  await main.getByRole('button', { name: 'Тестовый Мастер, 10:00, свободно', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Услуга', { exact: true })
    .selectOption({ label: 'Тестовая стрижка, 30 мин' });
  await dialog.getByLabel('Имя клиента', { exact: true }).fill('Клиент Автотест');
  await dialog.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(main.getByTestId('beauty-day-summary')).toContainText('Записей: 1');
  await page.reload();
  await expect(page.getByRole('main').getByTestId('beauty-day-summary')).toContainText(
    'Записей: 1',
  );
  await expect(
    page.getByRole('main').getByRole('button').filter({ hasText: 'Клиент Автотест' }).first(),
  ).toBeVisible();
  await page.screenshot({ path: `${evidence}/first-appointment-1440.png`, fullPage: true });

  // Повторный вход в новом браузере: та же организация и филиал, срок trial не начинается заново,
  // услуги и мастер те же (без дублей), настройка остаётся завершённой, запись на месте
  const snapshot = async (p: Page) => {
    const h = await apiHeaders(p);
    const get = async (path: string) => (await p.request.get(`${api}${path}`, { headers: h })).json();
    const who = await get('/auth/me');
    return {
      organization: who.user.organizationId,
      trialEndsAt: who.organization.trialEndsAt,
      location: who.context.locationId,
      vertical: who.context.vertical,
      services: (await get('/beauty/services')).items.map((x: { id: string }) => x.id).sort(),
      employees: (await get('/beauty/employees')).items.map((x: { id: string }) => x.id).sort(),
      completed: Boolean((await get('/onboarding')).completedAt),
    };
  };
  const before = await snapshot(page);
  expect(before.services).toHaveLength(1);
  expect(before.employees).toHaveLength(1);
  expect(before.completed).toBe(true);
  expect(before.trialEndsAt).toBe(me.organization.trialEndsAt);
  expect((await page.request.post(`${api}/auth/logout`, { headers: await apiHeaders(page) })).ok()).toBe(true);
  await page.context().clearCookies();
  const fresh = await page.context().browser()!.newContext({ baseURL: 'http://127.0.0.1:55843' });
  try {
    const other = await fresh.newPage();
    await login(other, email);
    // стойка после входа ещё ведёт на свою страницу: переход в календарь до этого обрывается (ERR_ABORTED)
    await other.waitForLoadState('networkidle');
    await expect(other.getByRole('main')).toBeVisible();
    expect(await snapshot(other)).toEqual(before);
    await other.goto(`/calendar?date=${date}`);
    await expect(other.getByRole('main').getByTestId('beauty-day-summary')).toContainText('Записей: 1');
    await other.reload();
    expect(await snapshot(other)).toEqual(before);
  } finally {
    await fresh.close();
  }
});

async function apiHeaders(page: Page) {
  const cookies = await page.context().cookies('http://127.0.0.1:55843');
  const session = cookies.find((c) => c.name === 'wetop_session')?.value;
  const scope = cookies.find((c) => c.name === 'wetop_scope')?.value;
  if (!session || !scope) throw new Error('Synthetic authenticated context missing');
  return { 'x-wetop-session': session, 'x-wetop-scope': decodeURIComponent(scope) };
}
async function goToEmployeesList(page: Page) {
  const personnel = page.getByRole('button', { name: 'Персонал', exact: true });
  if (!(await personnel.isVisible())) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await personnel.click();
  await page.getByRole('link', { name: 'Специалисты', exact: true }).click();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.getByTestId('employee-manager')).toHaveCount(0);
}
async function profileUI(page: Page) {
  await page.getByRole('button', { name: 'Настроить салон', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click();
  await expect(
    page.getByText('Выполнено 0 из 4 обязательных шагов', { exact: true }),
  ).toBeVisible();
}
async function login(page: Page, email: string) {
  await page.goto(`${site}/#login`);
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="email"]').fill(email);
  await dialog.locator('input[name="password"]').fill('Onboarding-Test-2026!a');
  await dialog.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:55843\//);
}

test('O03/O05/O20: logout, new session, deep links and history resume the saved Location', async ({
  page,
  browser,
}) => {
  const email = await register(page, 'resume');
  await profileUI(page);
  const headers = await apiHeaders(page);
  const before = await (await page.request.get(`${api}/onboarding`, { headers })).json();
  expect((await page.request.post(`${api}/auth/logout`, { headers })).ok()).toBe(true);
  await page.context().clearCookies();
  const fresh = await browser.newContext({ baseURL: 'http://127.0.0.1:55843' });
  try {
    const other = await fresh.newPage();
    await login(other, email);
    await expect(other.getByRole('heading', { level: 1 })).toHaveText('Подготовьте салон к работе');
    const state = await (
      await other.request.get(`${api}/onboarding`, { headers: await apiHeaders(other) })
    ).json();
    expect(state.locationId).toBe(before.locationId);
    expect(state.profileApplied).toBe(true);
    await other.goto('/services?onboarding=1');
    await other.goBack();
    // History can retain hidden route DOM; require exactly one visible progress status.
    const resumedProgress = other
      .getByText('Выполнено 0 из 4 обязательных шагов', { exact: true })
      .filter({ visible: true });
    await expect(resumedProgress).toHaveCount(1);
    await expect(resumedProgress).toBeVisible();
    await other.goForward();
    await expect(other.getByRole('heading', { level: 1 })).toHaveText('Услуги');
    await other.goto('/register/setup?vertical=HOSPITALITY&returnTo=https%3A%2F%2Fexample.invalid');
    await expect(other).toHaveURL(/127\.0\.0\.1:55843/);
    // Next retains inactive route DOM after history navigation. Require one visible form, not one DOM copy.
    const resumed = other.getByTestId('beauty-onboarding').filter({ visible: true });
    await expect(resumed).toHaveCount(1);
    await expect(resumed).toBeVisible();
    await expect(resumed.getByRole('heading', { level: 1 })).toHaveText('Подготовьте салон к работе');
    const resumedState = await (
      await other.request.get(`${api}/onboarding`, { headers: await apiHeaders(other) })
    ).json();
    expect(resumedState.businessId).toBe(before.businessId);
    expect(resumedState.locationId).toBe(before.locationId);
    expect(resumedState.vertical).toBe('BEAUTY');
    expect(resumedState.profileApplied).toBe(true);
    await expect(resumed.locator('header > p')).toHaveText(String(resumedState.draft.locationName));
  } finally {
    await fresh.close();
  }
});

test('O07c: a closed employee card leaves the router on the list, so later actions cannot restore it', async ({
  page,
}) => {
  // Детерминированная причина O07 (17.10.2026): закрытие карточки чистило адрес только в history, маршрутизатор
  // Next оставался на `employee=<закрытый>`, следующее действие сервера уходило на этот адрес, а его ответ
  // возвращал в строку закрытую карточку; перезагрузка открывала не того мастера.
  await register(page, 'closed');
  await profileUI(page);
  await page.goto('/employees?onboarding=1');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя мастера', { exact: true }).fill('Мастер Закрытый');
  await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await openFullProfile(page);
  const firstId = new URL(page.url()).pathname.split('/')[2]!;
  await expect(page.getByTestId('employee-manager')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await goToEmployeesList(page);
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя мастера', { exact: true }).fill('Мастер Следующий');
  const action = page.waitForRequest((r) => r.method() === 'POST' && Boolean(r.headers()['next-action']));
  await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  // действие уходит на тот адрес, который маршрутизатор считает текущим: это список, а не закрытая карточка
  const actionUrl = new URL((await action).url());
  expect(actionUrl.pathname).toBe('/employees');
  expect(actionUrl.searchParams.get('employee')).toBeNull();
  await openFullProfile(page);
  const secondId = new URL(page.url()).pathname.split('/')[2]!;
  expect(secondId).not.toBe(firstId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const headers = await apiHeaders(page);
  await expect
    .poll(async () => (await (await page.request.get(`${api}/beauty/employees`, { headers })).json()).items.length)
    .toBe(2);
  const rows = (await (await page.request.get(`${api}/beauty/employees`, { headers })).json()).items;
  expect(rows.map((row: { id: string }) => row.id).sort()).toEqual([firstId, secondId].sort());
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/employees/${secondId}/profile$`));
});

test('O07/O08: partial assignment and a lost create response recover one Employee ID', async ({
  page,
}) => {
  await register(page, 'retry');
  await profileUI(page);
  const headers = await apiHeaders(page);
  const created = await page.request.post(`${api}/beauty/services`, {
    headers,
    data: {
      creationId: randomUUID(),
      name: 'Услуга повтора',
      durationMinutes: '30',
      priceMinor: '0',
      currency: 'KZT',
      active: true,
    },
  });
  expect(created.ok()).toBe(true);
  const service = await created.json();
  expect(
    (
      await page.request.put(`${api}/beauty/services/${service.id}/location`, {
        headers,
        data: { enabled: true },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/employees?onboarding=1');
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя мастера', { exact: true }).fill('Мастер Частичный');
  await dialog.getByRole('button', {name:'Создать мастера',exact:true}).click();
  await openFullProfile(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const manager = page.getByTestId('employee-manager');
  await manager.getByRole('tab', { name: 'Услуги', exact: true }).click();
  await manager.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const skills = page.getByTestId('portal-services-form');
  const choice = skills.getByRole('checkbox', { name: /^Услуга повтора/ });
  await choice.check();
  await choice.evaluate((node, value) => {
    (node as HTMLInputElement).value = value;
  }, randomUUID());
  await skills.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(skills.getByRole('alert')).toContainText('Service outside business catalog');
  await expect(manager.getByRole('heading', { name: 'Мастер Частичный', exact: true })).toBeVisible();
  await expect(choice).toBeChecked();
  let saved = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
  expect(saved.items).toHaveLength(1);
  const firstId = saved.items[0].id;
  expect(saved.items[0].serviceIds).toEqual([]);
  await page.screenshot({ path: `${evidence}/partial-create-preserved.png`, fullPage: true });
  await choice.evaluate((node, value) => { (node as HTMLInputElement).value = value; }, service.id);
  await skills.getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get(`${api}/beauty/employees`, { headers })).json()).items[0]
          .serviceIds,
    )
    .toEqual([service.id]);
  saved = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
  expect(saved.items).toHaveLength(1);
  expect(saved.items[0].id).toBe(firstId);
  // Закрывать после подтверждения на экране: до него форма честно считает изменения несохранёнными
  await expect(skills.getByRole('status')).toContainText('Сохранено на сервере');
  await goToEmployeesList(page);
  await page.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя мастера', { exact: true }).fill('Мастер Потерянный Ответ');
  let dropped!: () => void;
  const responseDropped = new Promise<void>((resolve) => {
    dropped = resolve;
  });
  let intercepted = false;
  await page.route('**/employees*', async (route) => {
    if (
      !intercepted &&
      route.request().method() === 'POST' &&
      route.request().headers()['next-action']
    ) {
      intercepted = true;
      await route.fetch();
      await route.abort();
      dropped();
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  await responseDropped;
  await page.unroute('**/employees*');
  saved = await (await page.request.get(`${api}/beauty/employees`, { headers })).json();
  expect(saved.items).toHaveLength(2);
  const lostId = saved.items.find(
    (row: { name: string }) => row.name === 'Мастер Потерянный Ответ',
  ).id;
  page.once('dialog', async (prompt) => prompt.accept());
  await page.reload();
  await openFullProfile(page, lostId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('portal-profile-form').getByLabel('Имя в карточке', { exact: true })).toHaveValue('Мастер Потерянный Ответ');
  await page.getByTestId('employee-manager').getByRole('tab', { name: 'Услуги', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  await page.getByTestId('portal-services-form').getByRole('button', { name: 'Сохранить услуги', exact: true }).click();
  await expect(page.getByTestId('portal-services-form').getByRole('status')).toContainText('Сохранено на сервере');
  await page.reload();
  expect(
    (await (await page.request.get(`${api}/beauty/employees`, { headers })).json()).items,
  ).toHaveLength(2);
  await page.screenshot({ path: `${evidence}/lost-response-recovered.png`, fullPage: true });

  // Real stale replace with two browser forms, retaining the second form's local input.
  expect(
    (
      await page.request.put(`${api}/beauty/employees/${firstId}/working-hours`, {
        headers,
        data: { expectedRevision: (await (await page.request.get(`${api}/beauty/schedule?employee=${firstId}`, { headers })).json()).weekRevision, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '12:00' }] },
      })
    ).ok(),
  ).toBe(true);
  const a = await page.context().newPage();
  const b = await page.context().newPage();
  try {
    for (const tab of [a, b]) {
      await tab.goto(`/beauty/schedule?employee=${firstId}`);
      await tab.getByRole('main').getByRole('button', { name: 'Мастер Частичный', exact: true }).click();
    }
    await a.getByRole('dialog').getByLabel('Понедельник: конец').fill('13:00');
    await a
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить график', exact: true })
      .click();
    await expect(a.getByRole('dialog').getByText('График сохранён', { exact: true })).toBeVisible();
    await b.getByRole('dialog').getByLabel('Понедельник: конец').fill('14:00');
    await b
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить график', exact: true })
      .click();
    await expect(b.getByRole('dialog').getByRole('alert')).toContainText('другом окне');
    await expect(b.getByRole('dialog').getByLabel('Понедельник: конец')).toHaveValue('14:00');
    await b
      .getByRole('dialog')
      .getByRole('button', { name: 'Сравнить с актуальным графиком', exact: true })
      .click();
    await expect(
      b.getByRole('dialog').getByText('Понедельник: 09:00 до 13:00', { exact: true }),
    ).toBeVisible();
    await expect(b.getByRole('dialog').getByLabel('Понедельник: конец')).toHaveValue('14:00');
    await b.screenshot({ path: `${evidence}/stale-week-compared.png`, fullPage: true });
  } finally {
    await a.close();
    await b.close();
  }
});

test('O02/O17: unverified and expired confirmation do not bypass real guards', async ({ page }) => {
  expect((await page.request.get(`${api}/onboarding`)).status()).toBe(401);
  const email = `onboarding-expired-${randomUUID()}@example.invalid`;
  const result = await page.request.post(`${api}/auth/register`, {
    data: {
      email,
      name: 'Тестовый Владелец',
      businessName: 'Салон Проверки',
      vertical: 'BEAUTY',
      password: 'Onboarding-Test-2026!a',
      phoneCountry: 'KZ',
      phone: '7000000000',
      privacyAccepted: true,
    },
  });
  expect(result.ok()).toBe(true);
  expect(
    (
      await page.request.post(`${api}/auth/login`, {
        data: { email, password: 'Onboarding-Test-2026!a' },
      })
    ).status(),
  ).toBe(403);
  const { link } = await (
    await page.request.get(`${api}/__onboarding-test/mail?email=${encodeURIComponent(email)}`)
  ).json();
  const token = new URL(link).searchParams.get('token');
  expect(
    (
      await page.request.post(`${api}/__onboarding-test/expire-verification`, { data: { token } })
    ).ok(),
  ).toBe(true);
  const expired = await page.request.post(`${api}/auth/email/verify`, { data: { token } });
  expect([401, 403]).toContain(expired.status());
  expect((await page.context().cookies()).some((c) => c.name === 'wetop_session')).toBe(false);
});
