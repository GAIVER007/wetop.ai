import { test, expect } from '../ui/fixtures';
import type { Page, APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const api = `http://127.0.0.1:${process.env.BEAUTY_UI_API_PORT || '26814'}`;
// Ближайший понедельник после сегодняшнего дня по поясу филиала стенда (Asia/Almaty): тесты заводят мастеру
// рабочий понедельник. Дата была зашита как 2026-10-12, и с полуночи 13.10 по Алматы отсутствие на этот день
// стало прошедшим: список отсутствий показывает только идущие и будущие (`schedule.ts`, `dateTo >= сегодня`)
const day = (() => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1);
  while (d.getUTCDay() !== 1);
  return d.toISOString().slice(0, 10);
})();
const shots = process.env.BEAUTY_UI_SCREENSHOT_DIR || 'reports/mv5-beauty-ui-2026-10-04/screenshots';
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
async function expectEmptyCalendar(page: Page) {
  const grid = page.getByTestId('beauty-grid');
  await expect(grid).toBeVisible();
  await expect(grid.getByTestId('beauty-empty-timeline')).toBeVisible();
  await expect(grid).toContainText('09:00');
  await expect(grid).toContainText('17:30');
  await expect(grid.locator('.beauty-tile, .beauty-slot-free')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Новая запись', exact: true })).toBeDisabled();
  const setup = page.getByRole('status').filter({ hasText: 'Для новой записи нужны услуги' });
  await expect(setup.getByRole('link', { name: 'Добавить услугу', exact: true })).toHaveAttribute(
    'href',
    '/services',
  );
  await expect(setup.getByRole('link', { name: 'Добавить специалиста', exact: true })).toHaveAttribute(
    'href',
    '/employees',
  );
}
async function seed(page: Page, request: APIRequestContext, fixture?: Fixture) {
  const f = fixture ?? await reset(page, request);
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
        data: { expectedRevision: (await (await request.get(`${api}/beauty/schedule?employee=${employee.id}`, { headers })).json()).weekRevision, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] },
      })
    ).ok(),
  ).toBe(true);
  // Return the client snapshot after weekly setup, which advances the profile source version.
  const employeesResponse = await request.get(`${api}/beauty/employees`, { headers });
  expect(employeesResponse.ok()).toBe(true);
  const readyEmployee = (await employeesResponse.json()).items.find((e: { id: string }) => e.id === employee.id);
  expect(readyEmployee).toBeDefined();
  expect(readyEmployee.profileRevision).not.toBe(employee.profileRevision);
  return { ...f, headers, employee: readyEmployee, service };
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
  // сценарий вырос оплатой и возвратом записи (§49, §54): общего предела 90 с под нагрузкой не хватает
  test.setTimeout(150_000);
  await reset(page, request);
  await page.goto('/calendar?vertical=HOSPITALITY');
  await expectEmptyCalendar(page);
  await page.goto('/services');
  await page.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  let panel = page.getByRole('dialog');
  await panel.getByLabel('Название', { exact: true }).fill('Тестовая стрижка');
  await panel.getByLabel(/Цена каталога/).fill('12000');
  await panel.getByRole('button', { name: 'Сохранить услугу', exact: true }).click();
  await expect(
    page.locator('[data-service-list="catalog"] .beauty-service-item').filter({
      has: page.getByText('Тестовая стрижка', { exact: true }),
    }),
  ).toContainText('12 000');
  await panel.getByRole('button', { name: 'Закрыть: Новая услуга', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL(/\/services$/);
  await page.reload();
  // Незавершённая настройка филиала возобновляет созданную услугу в той же карточке.
  panel = page.getByRole('dialog');
  await expect(panel.getByLabel('Название', { exact: true })).toHaveValue('Тестовая стрижка');
  await expect(panel.getByLabel(/Цена каталога/)).toHaveValue('12000');
  await panel.getByLabel('Филиал оказывает эту услугу').check();
  await panel.getByRole('button', { name: 'Сохранить для филиала' }).click();
  await expect(panel.getByRole('status')).toContainText('Настройки филиала сохранены');
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Добавить специалиста' }).click();
  panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill('Тестовый мастер Анна');
  await panel.getByRole('button', {name:'Создать мастера',exact:true}).click();
  // Создание открывает полную карточку специалиста отдельной страницей, не диалог.
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  let profile = page.getByTestId('employee-manager');
  // новый мастер: карточка подсказывает оставшиеся шаги и открывает нужную вкладку (онбординг 21.10.2026)
  const setup = profile.getByTestId('portal-setup-steps');
  await expect(setup).toContainText('Чтобы к мастеру могли записаться');
  await setup.getByRole('link', { name: 'Назначьте услуги' }).click();
  await expect(profile.getByRole('tab', { name: 'Услуги', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.screenshot({ path: 'reports/master-setup-steps-1440.png' });
  await profile.getByRole('button', { name: 'Добавить услугу', exact: true }).click();
  const assignForm = profile.getByTestId('portal-services-form');
  await assignForm.getByRole('checkbox', { name: /^Тестовая стрижка(?:\s|$)/ }).check();
  await assignForm.getByRole('button', { name: 'Сохранить услуги' }).click();
  await expect(assignForm.getByRole('status')).toContainText('Сохранено на сервере');
  await expect(profile.getByTestId('portal-assigned-services')).toContainText('Тестовая стрижка');
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/employees$/);
  await page.reload();
  // единый экран персонала (20.10.2026): строка таблицы во вкладке «Все»
  await page
    .getByRole('tabpanel')
    .getByTestId('staff-row')
    .filter({ hasText: 'Тестовый мастер Анна' })
    .getByRole('link', { name: 'Открыть' })
    .click();
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/);
  profile = page.getByTestId('employee-manager');
  await profile.getByRole('tab', { name: 'График', exact: true }).click();
  const weekForm = profile.getByTestId('portal-week-form');
  await weekForm
    .getByRole('group', { name: 'Понедельник', exact: true })
    .getByRole('button', { name: 'Понедельник: добавить интервал' })
    .click();
  await weekForm.getByLabel('Понедельник: начало').fill('09:00');
  await weekForm.getByLabel('Понедельник: до, интервал 1').fill('18:00');
  await weekForm.getByRole('button', { name: 'Сохранить график' }).click();
  await expect(weekForm.getByRole('status')).toContainText('Сохранено на сервере');
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
  // A future visit cannot be marked absent (M6a); the API boundary tests
  // separately prove NO_SHOW becomes available at its actual start.
  await tile.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Не пришёл', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('Можно после начала визита');
  await page.getByRole('dialog').getByRole('button', { name: 'Начать', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  await expect(tile).toContainText('В процессе');
  await tile.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Не пришёл', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  // оплата записи в кассу филиала (§49): часть картой, отмена с оплатой закрыта
  await tile.click();
  panel = page.getByRole('dialog');
  await expect(panel.getByTestId('beauty-card-paid')).toHaveText('0 ₸ из 12 000 ₸');
  const payment = panel.getByRole('region', { name: 'Оплата записи' });
  await payment.getByLabel('Способ').selectOption('CARD_TERMINAL');
  await payment.getByLabel('Сумма, ₸').fill('5000');
  await payment.getByRole('button', { name: 'Принять оплату' }).click();
  await expect(panel).toBeHidden();
  await page.reload();
  await tile.click();
  panel = page.getByRole('dialog');
  await expect(panel.getByTestId('beauty-card-paid')).toHaveText('5 000 ₸ из 12 000 ₸');
  await expect(panel.getByRole('region', { name: 'Оплата записи' }).getByLabel('Сумма, ₸')).toHaveValue('7000');
  expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
  await panel.getByRole('button', { name: 'Отменить запись', exact: true }).click();
  // окно вопроса живёт внутри панели: берём его по своему признаку, как в beauty-journal.spec
  await page.getByTestId('confirm-dialog').getByRole('button', { name: 'Отменить запись', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('Сначала аннулируйте оплату записи в кассе');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await tile.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Завершить', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  await expect(tile).toContainText('Завершена');
  // возврат по выполненной записи (§54): часть с причиной, видно «Возвращено»
  await tile.click();
  panel = page.getByRole('dialog');
  const refund = panel.getByRole('region', { name: 'Возврат по записи' });
  await expect(refund.getByLabel('Сумма возврата, ₸')).toHaveValue('5000');
  await refund.getByLabel('Способ возврата').selectOption('CARD_TERMINAL');
  await refund.getByLabel('Сумма возврата, ₸').fill('2000');
  await refund.getByRole('button', { name: 'Оформить возврат' }).click();
  await expect(panel.getByRole('alert')).toContainText('Укажите причину возврата');
  await refund.getByLabel('Причина').fill('Клиент недоволен результатом');
  await refund.getByRole('button', { name: 'Оформить возврат' }).click();
  await expect(panel).toBeHidden();
  await page.reload();
  await tile.click();
  panel = page.getByRole('dialog');
  await expect(panel.getByTestId('beauty-card-refunded')).toHaveText('2 000 ₸');
  expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  // выгрузка записей в CSV (Q-BS-6): суммы записи есть, имени клиента в файле нет
  // ссылка экрана берёт его 7 дней; запись сценария в будущем, поэтому файл берём по её дню той же сессией
  await page.goto('/finance');
  await expect(page.getByRole('link', { name: 'Выгрузить записи (CSV)' })).toHaveAttribute('href', /\/finance\/export-appointments\?from=/);
  const exported = await page.request.get(`/finance/export-appointments?from=${day}&to=${day}`);
  expect(exported.headers()['content-type']).toContain('text/csv');
  const csv = await exported.text();
  // C2 (a98cf2fc5): после статуса идут источник записи и автор
  expect(csv).toContain('Статус;Источник;Автор;Валюта;Цена;Оплачено;Возвращено');
  expect(csv).toMatch(/Завершена;Стойка;[^;\r\n]*;KZT;12000,00;5000,00;2000,00/);
  expect(csv).not.toContain('Тестовая клиентка');
  await page.goto('/customers');
  await expect(page.getByRole('main')).toContainText('Тестовая клиентка');
  // VIP и день рождения клиента салона (§36, Q-BS-3)
  const client = page.getByRole('main').getByRole('row', { name: /Тестовая клиентка/ });
  await client.getByRole('button', { name: 'Изменить' }).click();
  const marks = page.getByTestId('customer-marks');
  await marks.getByLabel('VIP-гость').check();
  await marks.getByLabel('Дата рождения').fill('1990-03-15');
  await marks.getByRole('button', { name: 'Сохранить' }).click();
  // первое сохранение собирает серверное действие dev-сервером: под нагрузкой дольше 5 с
  await expect(marks).toBeHidden({ timeout: 20_000 });
  await expect(client).toContainText('VIP');
  await expect(client.getByTestId('customer-birthday')).toContainText('15 марта');
  await page.getByRole('main').getByLabel('Сегмент').selectOption('vip');
  // клиентка в сценарии одна: отбор «VIP» оставляет её в таблице
  await expect(client).toBeVisible();
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
  await expectEmptyCalendar(page);
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
  await expect(page.getByRole('button', { name: 'Добавить специалиста', exact: true })).toHaveCount(0);
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
  await panel.getByLabel('Телефон или имя', { exact: true }).fill('Несуществующий клиент');
  await expect(panel.getByLabel('Клиент', { exact: true }).locator('option')).toHaveCount(1);
  await panel.getByLabel('Телефон или имя', { exact: true }).fill('КЛИЕНТКА');
  await expect(panel.getByLabel('Клиент', { exact: true }).locator('option')).toHaveCount(2);
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
              data: { expectedRevision: (await (await request.get(`${api}/beauty/schedule?employee=${employee.id}`, { headers })).json()).weekRevision, intervals: [{ weekday: 1, timeFrom: '09:00', timeTo: '18:00' }] },
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
  // Archive uses the employee version from this intent's original API snapshot, not the stale seed POST.
  const employeeSnapshot = await request.get(`${api}/beauty/employees`, { headers: f.headers });
  expect(employeeSnapshot.ok(), `read archive source version: HTTP ${employeeSnapshot.status()}`).toBe(true);
  const originalEmployee = (await employeeSnapshot.json()).items.find((employee: { id: string }) => employee.id === f.employee.id);
  expect(originalEmployee?.profileRevision).toBeTruthy();
  const archived = await request.patch(`${api}/beauty/employees/${f.employee.id}`, {
    headers: f.headers,
    data: { active: false, expectedProfileRevision: originalEmployee.profileRevision },
  });
  const archiveError = archived.ok() ? null : await archived.json().catch(() => null);
  // Do not log raw responses: they may contain employee/contact data or internal diagnostics.
  const safeError = archiveError && {
    statusCode: typeof archiveError.statusCode === 'number' ? archiveError.statusCode : archived.status(),
    error: ['Bad Request', 'Forbidden', 'Conflict', 'Not Found', 'Internal Server Error'].includes(archiveError.error) ? archiveError.error : 'Other error',
    expectedProfileRevisionRejected: typeof archiveError.message === 'string' && archiveError.message.includes('expectedProfileRevision'),
  };
  expect(archived.ok(), `archive employee: HTTP ${archived.status()}, safe error ${JSON.stringify(safeError)}`).toBe(true);
  await page.reload();
  await expect(page.locator('.beauty-grid-day .beauty-tile')).toContainText('Тестовая клиентка');
  await expect(page.getByRole('button', { name: '+ Новая запись', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('beauty-mobile-calendar')).toContainText('Тестовая клиентка');
  await page.goto(`/calendar?date=${day}&view=week`);
  await expect(
    page.getByTestId('beauty-week').getByRole('link').filter({ hasText: 'Тестовая клиентка' }),
  ).toContainText('Тестовый мастер Анна');
  await page.goto(`/appointments?date=${day}`);
  await expect(page.getByRole('table')).toContainText('Тестовый мастер Анна');
  // The appointments list keeps inline filters; only the calendar uses a disclosure.
  await page.getByLabel('Специалист').selectOption({ label: 'Тестовый мастер Анна (не принимает)' });
  await expect(page.getByRole('table')).toContainText('Тестовая клиентка');
});

test('TimeOff via manager API with compact employee drawer, server denial and timezone persisted', async ({
  page,
  request,
}) => {
  const f = await seed(page, request);
  await page.goto('/employees');
  // единый экран персонала (20.10.2026): строка таблицы во вкладке «Все»
  await page
    .getByRole('tabpanel')
    .getByTestId('staff-row')
    .filter({ hasText: 'Тестовый мастер Анна' })
    .getByRole('link', { name: 'Открыть' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/employees/${f.employee.id}/profile$`));
  const panel = page.getByTestId('employee-manager');
  await panel.getByRole('tab', { name: 'График', exact: true }).click();
  await expect(panel.getByRole('heading', { name: 'Обычная неделя', exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Сохранить график', exact: true })).toBeVisible();
  await expect(panel.getByLabel('С какого дня')).toHaveCount(0);
  await expect(panel.getByLabel('По какой день включительно')).toHaveCount(0);
  await expect(panel.getByLabel(/Причина/)).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Добавить отсутствие' })).toHaveCount(0);
  // The compact drawer edits only the normal week; the owner API still manages dated absences.
  const created = await request.post(`${api}/beauty/employees/${f.employee.id}/time-offs`, {
    headers: f.headers,
    data: { dateFrom: day, dateTo: day, reason: 'Тестовое обучение' },
  });
  expect(created.ok(), `manager absence fixture: HTTP ${created.status()}`).toBe(true);
  const timeOffs = (await created.json()).timeOffs;
  expect(timeOffs).toHaveLength(1);
  expect(timeOffs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ dateFrom: day, dateTo: day, reason: 'Тестовое обучение' }),
    ]),
  );
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

/**
 * MV8.5 DS1c: день журнала на общем `DateBar` ведёт по тем же адресам, что прежние ссылки: `?date=` у
 * пути, «Сегодня» без даты; поле даты держит прежний `data-testid`. Стоит до онбординга: тот пересоздаёт
 * организацию стенда, и сброс после него не работает.
 */
test('DS1c: day navigation keeps the previous addresses', async ({ page, request }) => {
  await reset(page, request);
  await page.goto('/calendar?date=2026-10-12');
  const bar = page.locator('.date-bar');
  await expect(bar.getByTestId('beauty-day-date')).toHaveValue('2026-10-12');
  await bar.getByRole('button', { name: 'Следующий день' }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-13$/);
  await bar.getByRole('button', { name: 'Предыдущий день' }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-12$/);
  await bar.getByLabel('Дата', { exact: true }).fill('2026-10-20');
  await expect(page).toHaveURL(/\/calendar\?date=2026-10-20$/);
  await bar.getByRole('button', { name: 'Сегодня', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test('Beauty onboarding v2 completes a ready branch and resumes Today', async ({ page, request }) => {
  const f = await reset(page, request);
  await page.goto('/register/setup');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Настроить салон', exact: true }).click();
  await main.getByLabel('Название салона').fill('Тестовый салон');
  await main.getByLabel('Название филиала').fill('Тестовый филиал');
  // пояс идёт от страны и только для чтения, валюта подставляется и меняется (Q-SCHED-3)
  await expect(main.getByLabel('Часовой пояс')).toHaveJSProperty('readOnly', true);
  await main.getByLabel('Страна').selectOption({ label: 'ОАЭ' });
  await expect(main.getByLabel('Часовой пояс')).toHaveValue('Дубай (ОАЭ)');
  await expect(main.getByLabel('Валюта')).toHaveValue('AED');
  expect(await main.getByLabel('Валюта').locator('option').allTextContents()).toEqual([
    'Тенге (KZT)',
    'Доллар США (USD)',
    'Дирхам ОАЭ (AED)',
    'Катарский риал (QAR)',
  ]);
  await main.getByLabel('Страна').selectOption({ label: 'Казахстан' });
  await expect(main.getByLabel('Часовой пояс')).toHaveValue('Алматы (Казахстан)');
  await expect(main.getByLabel('Валюта')).toHaveValue('KZT');
  await main.getByRole('button', { name: 'Сохранить и продолжить', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Завершить настройку' })).toBeDisabled();
  await seed(page, request, f);
  await main.getByRole('button', { name: 'Обновить проверку', exact: true }).click();
  await expect(main.getByRole('status').filter({ hasText: 'Выполнено' })).toContainText('Выполнено 4 из 4');
  await main.getByRole('button', { name: 'Завершить настройку' }).click();
  await expect(main.getByRole('heading', { name: 'Салон готов к работе', exact: true })).toBeVisible();
  await main.getByRole('link', { name: 'Перейти к работе', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await page.goto(`/calendar?date=${day}`);
  await expect(page.getByTestId('beauty-grid')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Новая запись', exact: true })).toBeEnabled();
  await page.goto('/register/setup?entry=1');
  await expect(page).toHaveURL(/\/today$/);
});
