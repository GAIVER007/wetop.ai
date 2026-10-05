import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '55814'}`;
const day = '2026-10-12';
const shots = 'reports/mv5-beauty-ui-2026-10-04/screenshots';
type Fixture = { business: string; otherBusiness: string; locations: string[] };
const pointer = (business: string, location: string) => `business=${business};location=${location}`;
async function scope(page: Page, business: string, location: string) {
  await page.context().addCookies([
    {
      name: 'wetop_scope',
      value: encodeURIComponent(pointer(business, location)),
      domain: '127.0.0.1',
      path: '/',
    },
  ]);
}
async function reset(page: Page, request: APIRequestContext) {
  const response = await request.post(`${api}/__test/reset`);
  expect(response.ok()).toBe(true);
  const f: Fixture = await response.json();
  await scope(page, f.business, f.locations[0]!);
  return f;
}
async function seed(page: Page, request: APIRequestContext) {
  const f = await reset(page, request);
  const headers = { 'x-wetop-scope': pointer(f.business, f.locations[0]!) };
  const service = await (
    await request.post(`${api}/beauty/services`, {
      headers,
      data: {
        name: 'Тестовая стрижка',
        durationMinutes: 60,
        priceMinor: '1200000',
        currency: 'KZT',
      },
    })
  ).json();
  expect(
    (
      await request.put(`${api}/beauty/services/${service.id}/location`, {
        headers,
        data: { enabled: true },
      })
    ).ok(),
  ).toBe(true);
  const employee = await (
    await request.post(`${api}/beauty/employees`, {
      headers,
      data: { name: 'Тестовый мастер Анна' },
    })
  ).json();
  expect(
    (
      await request.put(`${api}/beauty/employees/${employee.id}/services`, {
        headers,
        data: { serviceIds: [service.id] },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.put(`${api}/beauty/employees/${employee.id}/working-hours`, {
        headers,
        data: { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] },
      })
    ).ok(),
  ).toBe(true);
  return { ...f, headers, employee, service };
}
async function book(page: Page, name = 'Тестовая клиентка', time = '10:00') {
  await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя клиента', { exact: true }).fill(name);
  await panel.getByLabel('Услуга', { exact: true }).selectOption({ index: 1 });
  await panel.getByLabel('Время', { exact: true }).fill(time);
  await panel.getByRole('button', { name: 'Записать', exact: true }).click();
  return panel;
}
test.afterAll(async ({ request }) => {
  expect((await request.post(`${api}/__test/cleanup`)).ok()).toBe(true);
});

test('empty setup through real UI, persisted appointment, move, confirm, complete', async ({
  page,
  request,
}) => {
  await reset(page, request);
  await page.goto('/calendar?vertical=HOSPITALITY');
  await expect(page.getByRole('heading', { name: 'Пока нечего показывать' })).toBeVisible();
  await page.goto('/services');
  await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  let panel = page.getByRole('dialog');
  await panel.getByLabel('Название', { exact: true }).fill('Тестовая стрижка');
  await panel.getByLabel(/Цена каталога, тиын/).fill('1200000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Услуга добавлена');
  await page.reload();
  await page
    .getByRole('row')
    .filter({ hasText: 'Тестовая стрижка' })
    .getByRole('button', { name: 'Изменить' })
    .click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByRole('button', { name: 'Сохранить для филиала' }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить мастера' }).click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Тестовый мастер Анна');
  await panel.getByRole('checkbox', { name: 'Тестовая стрижка' }).check();
  await panel.getByRole('button', { name: 'Сохранить мастера' }).click();
  await expect(panel.getByRole('status')).toContainText('Мастер добавлен');
  await page.reload();
  await page
    .getByRole('row')
    .filter({ hasText: 'Тестовый мастер Анна' })
    .getByRole('button', { name: 'Открыть' })
    .click();
  panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'График', exact: true }).click();
  await panel
    .getByRole('group', { name: 'Понедельник', exact: true })
    .getByRole('button', { name: 'Сделать рабочим' })
    .click();
  await panel.getByLabel('Понедельник: начало').fill('09:00');
  await panel.getByLabel('Понедельник: конец').fill('18:00');
  await panel.getByRole('button', { name: 'Сохранить график' }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
  await page.goto(`/calendar?date=${day}`);
  await expect(await book(page)).toBeHidden();
  await page.reload();
  await page
    .locator('.beauty-grid-day .beauty-tile')
    .filter({ hasText: 'Тестовая клиентка' })
    .click();
  panel = page.getByRole('dialog');
  await expect(panel).toContainText('12 000 ₸');
  await panel.getByTestId('beauty-move-start').fill(`${day}T12:00`);
  await panel.getByRole('button', { name: 'Перенести', exact: true }).click();
  await expect(panel).toBeHidden();
  await page.reload();
  const tile = page.locator('.beauty-grid-day .beauty-tile');
  await expect(tile).toContainText('12:00');
  await tile.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await tile.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  await expect(tile).toContainText('Завершена');
  await page.goto('/customers');
  await expect(page.getByRole('main')).toContainText('Тестовая клиентка');
  const calls: string[] = await (await request.get(`${api}/__test/calls`)).json();
  expect(
    calls.filter(
      (p) =>
        p.startsWith('/hotel') || p.startsWith('/channels') || p.startsWith('/system/freshness'),
    ),
  ).toEqual([]);
});

test('overlap stays inline, two Businesses and Locations, STAFF and READ_ONLY', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/calendar?date=${day}`);
  await expect(await book(page)).toBeHidden();
  const panel = await book(page, 'Вторая тестовая клиентка');
  await expect(panel.getByRole('alert')).toContainText('Мастер в это время уже занят');
  await expect(panel.getByLabel('Имя клиента', { exact: true })).toHaveValue(
    'Вторая тестовая клиентка',
  );
  await scope(page, f.otherBusiness, f.locations[2]!);
  await page.goto(`/calendar?date=${day}`);
  await expect(page.getByRole('heading', { name: 'Пока нечего показывать' })).toBeVisible();
  await page.goto('/customers');
  await expect(page.getByRole('main')).not.toContainText('Тестовая клиентка');
  await scope(page, f.business, f.locations[1]!);
  await page.goto(`/appointments?date=${day}`);
  await expect(page.getByRole('main')).not.toContainText('Тестовая клиентка');
  await scope(page, f.business, f.locations[0]!);
  await request.post(`${api}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/services');
  await expect(page.getByRole('main')).toContainText('Тестовая стрижка');
  await expect(page.getByRole('button', { name: 'Добавить услугу', exact: true })).toHaveCount(0);
  await page.goto('/employees');
  await expect(page.getByRole('button', { name: 'Добавить мастера', exact: true })).toHaveCount(0);
  await request.post(`${api}/__test/control`, { data: { readOnly: true } });
  await page.goto(`/calendar?date=${day}`);
  await expect(page.getByRole('button', { name: '+ Новая запись', exact: true })).toBeDisabled();
  await page.locator('.beauty-grid-day .beauty-tile').click();
  await expect(page.getByRole('dialog')).toContainText('Тестовая клиентка');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Подтвердить' })).toHaveCount(
    0,
  );
});

test('existing customer can be selected for another appointment without duplication', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/calendar?date=${day}`);
  await expect(await book(page)).toBeHidden();
  await page.getByRole('button', { name: '+ Новая запись', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Клиент', { exact: true }).selectOption({ label: 'Тестовая клиентка' });
  await expect(panel.getByLabel('Имя клиента', { exact: true })).toHaveCount(0);
  await panel.getByLabel('Услуга', { exact: true }).selectOption({ index: 1 });
  await panel.getByLabel('Время', { exact: true }).fill('12:00');
  await panel.getByRole('button', { name: 'Записать', exact: true }).click();
  await expect(panel).toBeHidden();
  const data = await (
    await request.get(`${api}/beauty/appointments?date=${day}`, { headers: f.headers })
  ).json();
  expect(data.appointments).toHaveLength(2);
  expect(data.appointments[0].customer.id).toBe(data.appointments[1].customer.id);
  const customers = await (
    await request.get(`${api}/beauty/customers`, { headers: f.headers })
  ).json();
  expect(customers.items).toHaveLength(1);
});

for (const width of [1440, 390])
  for (const theme of ['light', 'dark'] as const) {
    test(`calendar and drawer ${width} ${theme}, keyboard, axe, no overflow`, async ({
      page,
      request,
    }) => {
      const fixture = await seed(page, request);
      for (const name of ['Тестовый мастер Борис', 'Тестовый мастер Диана']) {
        const headers = fixture.headers;
        const employee = await (
          await request.post(`${api}/beauty/employees`, { headers, data: { name } })
        ).json();
        expect(
          (
            await request.put(`${api}/beauty/employees/${employee.id}/services`, {
              headers,
              data: { serviceIds: [fixture.service.id] },
            })
          ).ok(),
        ).toBe(true);
        expect(
          (
            await request.put(`${api}/beauty/employees/${employee.id}/working-hours`, {
              headers,
              data: { intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] },
            })
          ).ok(),
        ).toBe(true);
        if (name.endsWith('Диана'))
          expect(
            (
              await request.post(`${api}/beauty/employees/${employee.id}/time-offs`, {
                headers,
                data: { dateFrom: day, dateTo: day, reason: 'Учёба' },
              })
            ).ok(),
          ).toBe(true);
      }
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`/calendar?date=${day}`);
      await expect(await book(page)).toBeHidden();
      await page.reload();
      if (width === 390) {
        await expect(page.getByTestId('beauty-mobile-calendar')).toBeVisible();
        await expect(page.getByTestId('beauty-grid')).toBeHidden();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
      ).toBeLessThanOrEqual(1);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `${shots}/calendar-${width}-${theme}.png`, fullPage: true });
      const tile = page.locator(
        width === 390 ? '.beauty-mobile-calendar .beauty-tile' : '.beauty-grid-day .beauty-tile',
      );
      await tile.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('dialog').evaluate(async (el) => {
        await Promise.all(
          el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => undefined)),
        );
      });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `${shots}/drawer-${width}-${theme}.png`, fullPage: false });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(tile).toBeFocused();
      for (const path of ['/appointments?date=' + day, '/services', '/employees', '/customers']) {
        await page.goto(path);
        await expect(page.getByRole('main')).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        ).toBeLessThanOrEqual(1);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        await page.screenshot({
          path: `${shots}/${path.split('?')[0]!.slice(1)}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }

test('archived service and employee preserve historical calendar appointments', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto(`/calendar?date=${day}`);
  await expect(await book(page)).toBeHidden();
  expect(
    (
      await request.patch(`${api}/beauty/services/${f.service.id}`, {
        headers: f.headers,
        data: { active: false },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.patch(`${api}/beauty/employees/${f.employee.id}`, {
        headers: f.headers,
        data: { active: false },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(page.locator('.beauty-grid-day .beauty-tile')).toContainText('Тестовая клиентка');
  await expect(page.getByRole('button', { name: '+ Новая запись', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('beauty-mobile-calendar')).toContainText('Тестовая клиентка');
  await page.goto(`/appointments?date=${day}`);
  await expect(page.getByRole('table')).toContainText('Тестовый мастер Анна');
  await page.getByLabel('Мастер').selectOption({ label: 'Тестовый мастер Анна (не принимает)' });
  await expect(page.getByRole('table')).toContainText('Тестовая клиентка');
});

test('TimeOff from employee drawer, server denial and timezone persisted', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees');
  await page
    .getByRole('row')
    .filter({ hasText: 'Тестовый мастер Анна' })
    .getByRole('button', { name: 'Открыть' })
    .click();
  const panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: 'Отсутствия', exact: true }).click();
  await panel.getByLabel('С какого дня').fill(day);
  await panel.getByLabel('По какой день включительно').fill(day);
  await panel.getByLabel(/Причина/).fill('Тестовое обучение');
  await panel.getByRole('button', { name: 'Добавить отсутствие' }).click();
  await expect(panel.getByRole('status')).toContainText('Отсутствие добавлено');
  await expect(panel.getByRole('table')).toContainText('Тестовое обучение');
  await page.goto(`/calendar?date=${day}`);
  await expect(page.getByTestId('beauty-grid')).toContainText('Тестовое обучение');
  const rejected = await book(page);
  await expect(rejected.getByRole('alert')).toContainText('отсутств');
  const offs = await (
    await request.get(`${api}/beauty/schedule?employee=${f.employee.id}`, { headers: f.headers })
  ).json();
  expect(
    (
      await request.delete(
        `${api}/beauty/employees/${f.employee.id}/time-offs/${offs.timeOffs[0].id}`,
        { headers: f.headers },
      )
    ).ok(),
  ).toBe(true);
  await page.reload();
  await expect(await book(page)).toBeHidden();
  const data = await (
    await request.get(`${api}/beauty/appointments?date=${day}`, { headers: f.headers })
  ).json();
  expect(data.appointments[0].startsAt).toBe(`${day}T05:00:00.000Z`);
  await page.goto(`/appointments?date=${day}`);
  await page.getByLabel('Поиск клиента').fill('Никого');
  await expect(page.getByRole('heading', { name: 'Записей не найдено' })).toBeVisible();
  await page.getByLabel('Поиск клиента').fill('Тестовая');
  await expect(page.getByRole('table')).toContainText('Тестовая клиентка');
});

test('Beauty onboarding completion opens calendar and resumes there', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/register/setup');
  const main = page.getByRole('main');
  await main.getByLabel('Название бизнеса').fill('Тестовый салон');
  await main.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await main.getByLabel('Название филиала').fill('Тестовый филиал');
  await main.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await main.getByRole('button', { name: 'Завершить настройку' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(main.getByRole('heading', { name: 'Пока нечего показывать' })).toBeVisible();
  await page.goto('/register/setup');
  await expect(page).toHaveURL(/\/calendar$/);
});
