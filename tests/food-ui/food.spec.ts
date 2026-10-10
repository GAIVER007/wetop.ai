import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = 'http://127.0.0.1:55824';
const date = '2026-10-12';
async function settled(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
}
const shots = 'reports/mv7-food-ui-2026-10-05/screenshots';
type Fixture = {
  business: string;
  otherBusiness: string;
  beauty: string;
  hotel: string;
  locations: string[];
};
const pointer = (b: string, l: string) => `business=${b};location=${l}`;
async function scope(page: Page, b: string, l: string) {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(pointer(b, l)),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}
async function reset(page: Page, request: APIRequestContext) {
  const res = await request.post(`${api}/__test/reset`);
  expect(res.ok()).toBe(true);
  const f: Fixture = await res.json();
  await scope(page, f.business, f.locations[0]!);
  return f;
}
async function setup(page: Page) {
  await page.goto('/dining-areas');
  await page.getByRole('button', { name: '+ Добавить зал', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название', { exact: true }).fill('Основной зал');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '+ Стол', exact: true }).click();
  await dialog.getByLabel('Название', { exact: true }).fill('Стол 7');
  await dialog.getByLabel('Вместимость').fill('4');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Периоды обслуживания', exact: true }).click();
  await page.getByRole('button', { name: '+ Добавить период', exact: true }).click();
  await dialog.getByLabel('Название', { exact: true }).fill('Ужин');
  await dialog.getByLabel('День недели').selectOption('1');
  await dialog.getByLabel('Начало', { exact: true }).fill('18:00');
  await dialog.getByLabel('Конец', { exact: true }).fill('23:00');
  await dialog.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function seed(page: Page, request: APIRequestContext) {
  const f = await reset(page, request);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const area = await (
    await request.post(`${api}/food-service/areas`, {
      headers,
      data: { name: 'Основной зал', sortOrder: 0, active: true },
    })
  ).json();
  const table = await (
    await request.post(`${api}/food-service/tables`, {
      headers,
      data: { areaId: area.id, name: 'Стол 7', capacity: 4, sortOrder: 0, active: true },
    })
  ).json();
  const period = await (
    await request.post(`${api}/food-service/service-periods`, {
      headers,
      data: {
        name: 'Ужин',
        weekday: 1,
        timeFrom: '18:00',
        timeTo: '23:00',
        defaultDurationMinutes: 120,
        endsNextDay: false,
        active: true,
      },
    })
  ).json();
  return { f, headers, area, table, period };
}
async function create(page: Page, walkIn = false) {
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await page
    .getByRole('button', { name: walkIn ? 'Посадить без брони' : '+ Новая бронь', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Новый', exact: true }).check();
  await dialog.getByLabel('Имя', { exact: true }).fill('Анна');
  await dialog.getByLabel('Фамилия', { exact: true }).fill('Тестовая');
  await dialog.getByLabel('Телефон', { exact: true }).fill(
    `+700000${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')}`,
  );
  await dialog.getByLabel('Время', { exact: true }).fill('19:00');
  if (walkIn)
    await dialog
      .getByRole('combobox', { name: 'Стол', exact: true })
      .selectOption({ label: 'Основной зал, Стол 7, 4 мест' });
  await dialog
    .getByRole('button', { name: walkIn ? 'Посадить' : 'Создать бронь', exact: true })
    .click();
  await expect(dialog.getByRole('heading', { name: 'Анна Тестовая', exact: true })).toBeVisible();
  return dialog;
}
test('empty restaurant catalog and complete persisted desk flow', async ({ page, request }) => {
  const f = await reset(page, request);
  await setup(page);
  const dialog = await create(page);
  await dialog.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await page.reload();
  await page.getByRole('button', { name: /19:00, Анна Тестовая/ }).click();
  await dialog
    .getByRole('combobox', { name: 'Назначить стол', exact: true })
    .selectOption({ label: 'Основной зал, Стол 7, 4 мест' });
  await dialog.getByRole('button', { name: 'Назначить стол', exact: true }).click();
  await expect(dialog).toContainText('Основной зал, Стол 7');
  await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(dialog).toContainText('Подтверждено');
  await dialog.getByRole('button', { name: 'Посадить', exact: true }).click();
  await expect(dialog).toContainText('За столом');
  await dialog.getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(dialog).toContainText('Завершено');
  await dialog.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Стол 7, Свободен' })).toBeVisible();
  const rows = await (
    await request.get(`${api}/food-service/reservations?date=${date}`, {
      headers: { 'x-wetop-scope': pointer(f.business, f.locations[0]!) },
    })
  ).json();
  expect(rows.items[0].status).toBe('COMPLETED');
  expect(rows.items[0].table.name).toBe('Стол 7');
});
test('walk-in is seated immediately and persisted after reload', async ({ page, request }) => {
  await seed(page, request);
  const dialog = await create(page, true);
  await expect(dialog).toContainText('За столом');
  await dialog.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Стол 7, За столом' }).click();
  await expect(dialog.getByRole('button', { name: 'Снять стол', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Завершить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await expect(page.getByRole('button', { name: 'Стол 7, Свободен' })).toBeVisible();
});
test('real API screenshots, keyboard and axe', async ({ page, request }) => {
  await seed(page, request);
  const d = await create(page);
  await d
    .getByRole('combobox', { name: 'Назначить стол', exact: true })
    .selectOption({ label: 'Основной зал, Стол 7, 4 мест' });
  await d.getByRole('button', { name: 'Назначить стол', exact: true }).click();
  await d.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await d.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  for (const width of [1440, 390])
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme: theme as 'light' | 'dark' });
      for (const [name, path] of [
        ['floor-plan', `/floor-plan?date=${date}&time=19:00`],
        ['table-reservations', `/table-reservations?date=${date}`],
        ['dining-areas', '/dining-areas'],
        ['customers', '/customers'],
      ]) {
        await page.goto(path!);
        const themeButton = page.getByRole('button', { name: 'Переключить тему', exact: true });
        const initial = await page.locator('html').getAttribute('data-theme');
        await themeButton.click();
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          initial === 'dark' ? 'light' : 'dark',
        );
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await themeButton.click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
        await settled(page);
        await page.screenshot({ path: `${shots}/${name}-${theme}-${width}.png`, fullPage: true });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      }
      await page.goto(`/floor-plan?date=${date}&time=19:00`);
      await page.getByRole('button', { name: 'Стол 7, Подтверждено' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await settled(page);
      await page.screenshot({
        path: `${shots}/reservation-drawer-${theme}-${width}.png`,
        fullPage: true,
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Закрыть: Бронирование' }).focus();
      await page.keyboard.press('Shift+Tab');
      expect(
        await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press('Tab');
      expect(
        await page.getByRole('dialog').evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Стол 7, Подтверждено' })).toBeFocused();
    }
});

test('overlap and archived catalog preserve creation draft and idempotency key', async ({
  page,
  request,
}) => {
  const { f, headers, table, period } = await seed(page, request);
  const body = {
    servicePeriodId: period.id,
    startsAt: `${date}T19:00:00+05:00`,
    partySize: 2,
    source: 'DESK',
    tableId: table.id,
    customer: { firstName: 'Занятый синтетический' },
  };
  expect(
    (
      await request.post(`${api}/food-service/reservations`, {
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        data: body,
      })
    ).ok(),
  ).toBe(true);
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await page.getByRole('button', { name: '+ Новая бронь', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByRole('radio', { name: 'Новый', exact: true }).check();
  await d.getByLabel('Имя', { exact: true }).fill('Сохранённый черновик');
  await d.getByLabel('Заметка').fill('Тестовая заметка');
  await d.getByRole('combobox', { name: 'Стол', exact: true }).selectOption(table.id);
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('занят');
  await expect(d.getByRole('combobox', { name: 'Стол', exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(d.getByLabel('Имя', { exact: true })).toHaveValue('Сохранённый черновик');
  await expect(d.getByLabel('Заметка')).toHaveValue('Тестовая заметка');
  await request.patch(`${api}/food-service/tables/${table.id}`, {
    headers,
    data: { active: false },
  });
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('недоступен');
  await expect(d.getByLabel('Заметка')).toHaveValue('Тестовая заметка');
  await request.patch(`${api}/food-service/service-periods/${period.id}`, {
    headers,
    data: { active: false },
  });
  await d.getByRole('combobox', { name: 'Стол', exact: true }).selectOption('');
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('недоступен');
  const keys: string[] = await (await request.get(`${api}/__test/keys`)).json();
  expect(new Set(keys.slice(-3)).size).toBe(1);
  await scope(page, f.otherBusiness, f.locations[2]!);
  await page.goto('/customers');
  await expect(page.getByRole('main')).toContainText('Клиенты появятся после первого бронирования');
});
test('stale token refreshes drawer without automatic mutation retry', async ({ page, request }) => {
  const { headers } = await seed(page, request);
  const d = await create(page);
  // After creation the form calls router.refresh(). The status must change out of band only after
  // that refresh lands: a late refresh would show the new status before the click, and the stale
  // token would never be tested.
  await expect(page.getByLabel('Состояние столов')).toContainText('Без стола 1');
  const rows = await (
    await request.get(`${api}/food-service/reservations?date=${date}`, { headers })
  ).json();
  const r = rows.items[0];
  expect(
    (
      await request.post(`${api}/food-service/reservations/${r.id}/status`, {
        headers,
        data: { expectedStatus: r.status, expectedUpdatedAt: r.updatedAt, status: 'CONFIRMED' },
      })
    ).ok(),
  ).toBe(true);
  await d.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(d.getByRole('alert')).toHaveText('Бронирование уже изменилось. Данные обновлены.');
  await expect(d.getByRole('button', { name: 'Подтвердить', exact: true })).toHaveCount(0);
  await expect(d).toContainText('Подтверждено');
});
test('READ_ONLY and STAFF permissions on real API', async ({ page, request }) => {
  const { headers } = await seed(page, request);
  await request.post(`${api}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/dining-areas');
  await expect(page.getByRole('button', { name: '+ Добавить зал', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Изменить', exact: true })).toHaveCount(0);
  expect(
    (
      await request.post(`${api}/food-service/areas`, { headers, data: { name: 'Denied' } })
    ).status(),
  ).toBe(403);
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await expect(page.getByRole('button', { name: '+ Новая бронь', exact: true })).toBeVisible();
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await page.reload();
  await expect(page.getByTestId('read-only-banner')).toContainText('Режим только для чтения');
  await expect(page.getByRole('button', { name: '+ Новая бронь', exact: true })).toHaveCount(0);
  expect(
    (
      await request.post(`${api}/food-service/reservations`, {
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        data: {},
      })
    ).status(),
  ).toBe(403);
  await request.post(`${api}/__test/control`, { data: {} });
});
test('server branch switch isolates Food businesses and locations and other verticals', async ({
  page,
  request,
}) => {
  const { f } = await seed(page, request);
  await create(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page.getByRole('button', { name: /Тестовый филиал Парк/ }).click();
  // MV8: выбор филиала ведёт на общий рабочий экран дня
  await page.waitForURL('**/today');
  await expect(page.getByTestId('food-today')).toBeVisible();
  await page.goto('/floor-plan');
  await expect(page.getByRole('main')).not.toContainText('Основной зал');
  await expect(page.getByRole('main')).not.toContainText('Анна Тестовая');
  await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
  await page.getByRole('button', { name: /Другой тестовый бизнес/ }).click();
  await page.waitForURL('**/today');
  await page.goto('/floor-plan');
  await expect(page.getByRole('main')).toContainText('Сначала добавьте зал');
  for (const [name, landing] of [
    ['Тестовый салон', 'today'],
    ['Тестовый отель', 'register/setup'],
  ]) {
    await page.getByRole('button', { name: 'Выбрать филиал', exact: true }).click();
    await page.getByRole('button', { name: new RegExp(name!) }).click();
    await page.waitForURL(`**/${landing}`);
  }
  await scope(page, f.business, f.locations[0]!);
  for (const route of ['/calendar', '/appointments', '/chessboard', '/reservations']) {
    await page.goto(route);
    await page.waitForURL('**/today');
  }
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(calls.filter((c) => c.startsWith('/bar') || c.startsWith('/channels'))).toEqual([]);
  await scope(page, f.beauty, f.locations[3]!);
  const before = (await (await request.get(`${api}/__test/calls`)).json()).length;
  for (const route of ['/floor-plan', '/table-reservations', '/dining-areas']) {
    await page.goto(route);
    await page.waitForURL('**/today');
  }
  const after: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(after.slice(before).filter((c) => c.startsWith('/food-service'))).toEqual([]);
  expect(
    (
      await request.get(`${api}/food-service/reservations?date=${date}`, {
        headers: { 'x-wetop-scope': pointer(f.otherBusiness, f.locations[0]!) },
      })
    ).status(),
  ).toBe(403);
});
test('pagination beyond 100 and previous local day keep table occupied after reload', async ({
  page,
  request,
}) => {
  const { headers, table, period } = await seed(page, request);
  for (let i = 0; i < 101; i++) {
    const response = await request.post(`${api}/food-service/reservations`, {
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      data: {
        servicePeriodId: period.id,
        startsAt: `${date}T18:00:00+05:00`,
        partySize: 1,
        source: 'DESK',
        customer: { firstName: `Синтетический ${i}` },
      },
    });
    expect(response.ok()).toBe(true);
  }
  const response = await request.post(`${api}/food-service/reservations`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      servicePeriodId: period.id,
      startsAt: `${date}T19:00:00+05:00`,
      partySize: 2,
      source: 'WALK_IN',
      tableId: table.id,
      customer: { firstName: 'Синтетический последний' },
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Стол 7, За столом' })).toBeVisible();
  const night = await (
    await request.post(`${api}/food-service/service-periods`, {
      headers,
      data: {
        name: 'Ночной',
        weekday: 1,
        timeFrom: '18:00',
        timeTo: '02:00',
        endsNextDay: true,
        defaultDurationMinutes: 120,
        active: true,
      },
    })
  ).json();
  expect(
    (
      await request.post(`${api}/food-service/reservations`, {
        headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
        data: {
          servicePeriodId: night.id,
          startsAt: `${date}T23:30:00+05:00`,
          partySize: 2,
          source: 'DESK',
          tableId: table.id,
          customer: { firstName: 'Синтетическая ночь' },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto('/floor-plan?date=2026-10-13&time=00:30');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Стол 7, Бронь' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Синтетическая ночь');
});

test('assignment reassign unassign edit and capacity conflicts stay in drawer', async ({
  page,
  request,
}) => {
  const { headers, area, table, period } = await seed(page, request);
  const second = await (
    await request.post(`${api}/food-service/tables`, {
      headers,
      data: { areaId: area.id, name: 'Стол 8', capacity: 4 },
    })
  ).json();
  const d = await create(page);
  await expect(d.getByRole('button', { name: 'Посадить', exact: true })).toBeDisabled();
  await d.getByRole('combobox', { name: 'Назначить стол', exact: true }).selectOption(table.id);
  await d.getByRole('button', { name: 'Назначить стол', exact: true }).click();
  await d
    .getByRole('combobox', { name: 'Пересадить на другой стол', exact: true })
    .selectOption(second.id);
  await d.getByRole('button', { name: 'Пересадить', exact: true }).click();
  await expect(d.locator('dl')).toContainText('Основной зал, Стол 8');
  await d.getByRole('button', { name: 'Снять стол', exact: true }).click();
  await expect(d).toContainText('Без стола');
  await d.getByRole('button', { name: 'Изменить бронь', exact: true }).click();
  await d.getByLabel('Количество гостей').fill('5');
  await d.getByLabel('Заметка').fill('Обновлено');
  await d.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(d).toContainText('Обновлено');
  await expect(
    d
      .getByRole('combobox', { name: 'Назначить стол', exact: true })
      .locator(`option[value="${table.id}"]`),
  ).toHaveAttribute('disabled', '');
  const rows = await (
    await request.get(`${api}/food-service/reservations?date=${date}`, { headers })
  ).json();
  const r = rows.items[0];
  expect(
    (
      await request.put(`${api}/food-service/reservations/${r.id}/table`, {
        headers,
        data: { tableId: table.id, expectedStatus: r.status, expectedUpdatedAt: r.updatedAt },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post(`${api}/food-service/reservations/${r.id}/status`, {
        headers,
        data: { status: 'SEATED', expectedStatus: r.status, expectedUpdatedAt: r.updatedAt },
      })
    ).status(),
  ).toBe(409);
  await d.getByRole('button', { name: 'Изменить бронь', exact: true }).click();
  await d.getByLabel('Количество гостей').fill('2');
  await d.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await d.getByRole('combobox', { name: 'Назначить стол', exact: true }).selectOption(table.id);
  await d.getByRole('button', { name: 'Назначить стол', exact: true }).click();
  await expect(d.locator('dl')).toContainText('Основной зал, Стол 7');
  await d.getByRole('button', { name: 'Закрыть: Бронирование' }).click();
  await page.goto('/dining-areas');
  await page.getByRole('button', { name: 'Изменить стол Стол 7', exact: true }).click();
  await d.getByLabel('Вместимость').fill('1');
  await d.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('Нельзя уменьшить вместимость');
  await expect(d.getByLabel('Вместимость')).toHaveValue('1');
  await d.getByRole('button', { name: 'Закрыть: Изменить: Стол', exact: true }).click();
  for (const kind of ['table', 'area', 'period']) {
    if (kind === 'table')
      await page.getByRole('button', { name: 'Изменить стол Стол 8', exact: true }).click();
    if (kind === 'area')
      await page
        .locator('.food-catalog-grid')
        .getByRole('button', { name: 'Изменить', exact: true })
        .first()
        .click();
    if (kind === 'period') {
      await page.getByRole('button', { name: 'Периоды обслуживания', exact: true }).click();
      await page
        .locator('.food-catalog-grid')
        .getByRole('button', { name: 'Изменить', exact: true })
        .click();
    }
    await d.getByRole('button', { name: 'Архивировать', exact: true }).click();
    await expect(d).not.toBeVisible();
    if (kind === 'table')
      await page.getByRole('button', { name: 'Изменить стол Стол 8', exact: true }).click();
    else
      await page
        .locator('.food-catalog-grid')
        .getByRole('button', { name: 'Изменить', exact: true })
        .first()
        .click();
    await d.getByRole('button', { name: 'Вернуть', exact: true }).click();
    await expect(d).not.toBeVisible();
  }
  expect((await request.get(`${api}/food-service/service-periods`, { headers })).ok()).toBe(true);
  expect(period.id).toBeTruthy();
});
// DS2a (план mv8-5-ds2-shell-navigation §12): меню ресторана подсвечивает свой раздел по своему реестру
test('DS2a: Food menu highlights its own sections on desktop and phone', async ({ page, request }) => {
  await reset(page, request);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const menu = page.locator('.topmenu');
  const current = menu.locator('[aria-current="page"]');
  await page.goto('/customers');
  await expect(current).toHaveText('Гости');
  await expect(menu.getByRole('link', { name: 'Сотрудники и доступ', exact: true })).toHaveAttribute(
    'href',
    '/team',
  );
  for (const path of ['/team', '/staff']) {
    await page.goto(path);
    // `/staff` переводит на `/team` потоком: без ожидания адреса переход обрывает следующий `goto`
    if (path === '/staff') await expect(page).toHaveURL(/\/team$/);
    await expect(current, path).toHaveCount(1);
    await expect(current, path).toHaveText('Сотрудники и доступ');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.getByRole('navigation', { name: 'Основная навигация' });
  const more = bar.getByRole('button', { name: 'Ещё разделы' });
  await page.goto('/table-reservations');
  await expect(bar.locator('[aria-current="page"]')).toHaveText('Бронирования');
  await expect(more).not.toHaveClass(/is-active/);
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/team');
    await expect(bar.locator('[aria-current="page"]')).toHaveCount(0);
    await expect(more).toHaveClass(/is-active/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await more.click();
    const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
    await expect(drawer.locator('[aria-current="page"]')).toHaveText('Сотрудники и доступ');
    await settled(page);
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('API unavailable renders LoadError instead of free tables', async ({ page, request }) => {
  await seed(page, request);
  await request.post(`${api}/__test/control`, { data: { unavailable: true } });
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await expect(page.getByTestId('food-load-error')).toBeVisible();
  await expect(page.getByRole('button', { name: /Стол 7,/ })).toHaveCount(0);
  await request.post(`${api}/__test/control`, { data: {} });
});
test('creation 503 keeps the draft and retry key; invalid period stays inline', async ({
  page,
  request,
}) => {
  const { headers } = await seed(page, request);
  await page.goto(`/floor-plan?date=${date}&time=19:00`);
  await page.getByRole('button', { name: '+ Новая бронь', exact: true }).click();
  const d = page.getByRole('dialog');
  await d.getByLabel('Имя', { exact: true }).fill('Повтор синтетический');
  await d.getByLabel('Заметка').fill('Сохранённый ввод');
  await d.getByLabel('Время', { exact: true }).fill('10:00');
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('alert')).toBeVisible();
  await expect(d.getByLabel('Имя', { exact: true })).toHaveValue('Повтор синтетический');
  await d.getByLabel('Время', { exact: true }).fill('19:00');
  await request.post(`${api}/__test/control`, { data: { failCreate: true } });
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('alert')).toContainText('Тестовый сбой сохранения');
  await expect(d.getByLabel('Заметка')).toHaveValue('Сохранённый ввод');
  await d.getByRole('button', { name: 'Создать бронь', exact: true }).click();
  await expect(d.getByRole('heading', { name: 'Повтор синтетический', exact: true })).toBeVisible();
  const keys = await (await request.get(`${api}/__test/keys`)).json();
  expect(keys).toHaveLength(3);
  expect(new Set(keys).size).toBe(1);
  const rows = await (
    await request.get(`${api}/food-service/reservations?date=${date}`, { headers })
  ).json();
  expect(rows.items).toHaveLength(1);
  expect(rows.items[0].notes).toBe('Сохранённый ввод');
});
test('Food excludes every registered foreign workspace route before API requests', async ({
  page,
  request,
}) => {
  await seed(page, request);
  const before = (await (await request.get(`${api}/__test/calls`)).json()).length;
  for (const route of [
    '/finance',
    '/rooms/categories',
    '/onboarding',
    '/calendar',
    '/appointments',
    '/employees',
    '/services',
    '/beauty',
    '/chessboard',
    '/reservations',
    '/guests',
    '/inventory',
    '/rates',
    '/channels',
    '/bar',
    '/hotel-settings',
  ]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/today$/);
  }
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(
    calls
      .slice(before)
      .filter((c) =>
        /^\/(hotel|beauty|inventory|reservations|guests|rates|channels|bar|finance)(?:\/|$)/.test(
          c,
        ),
      ),
  ).toEqual([]);
});
test('marker guarded cleanup', async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});
