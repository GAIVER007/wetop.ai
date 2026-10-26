import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * График мастеров в стойке (DATA_MODEL §19.1, Q-251; сетка недели по поручению владельца 17.10.2026): мастера
 * строками, дни колонками, переключатель «Работает» правит обычную неделю, часы правятся окном по имени.
 * Отсутствия на даты из модели видны в ячейке только для чтения: раздел «Нерабочие дни» убран.
 */
const SNAPSHOTS = 'reports/beauty-b4-2026-10-03';

/**
 * Панель выезжает анимацией 180 мс (`drawer-in`, premium.css). Пока она идёт, панель полупрозрачна, и
 * axe меряет контраст текста сквозь неё: в тёмной теме это даёт ложные нарушения, в светлой проходит.
 * Ждём конца анимации, а не «видно ли панель».
 */
async function settled(panel: ReturnType<Page['getByRole']>) {
  await panel.evaluate(async (el) => {
    await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished));
  });
}

async function addBranch(page: Page, name: string, business?: string) {
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  if (business) {
    await creation.getByLabel('Филиал существующего бизнеса').check();
    await creation.getByRole('combobox', { name: /^Бизнес/ }).selectOption({ label: business });
    await creation.getByLabel('Название объекта', { exact: true }).fill(name);
    await creation.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  } else {
    await creation.getByLabel('Новый бизнес или бренд').check();
    await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
    await creation.getByLabel('Название бизнеса', { exact: true }).fill(name);
    await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  }
  await expect(creation.getByRole('status')).toContainText('Салон создан');
}

async function openSalon(page: Page, request: APIRequestContext, second = false) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await addBranch(page, 'Студия Айна');
  if (second) await addBranch(page, 'Студия на Абая', 'Студия Айна');
  await page.reload();
  await page.getByRole('main').getByRole('button', { name: 'Открыть объект: Студия Айна', exact: true }).click();
  // MV8: открытый салон начинает с общего рабочего экрана дня
  await page.waitForURL('**/today');
  await page.goto('/calendar');
}

async function addMaster(page: Page, name: string) {
  await page.goto('/beauty/masters');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить специалиста', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя').fill(name);
  await panel.getByRole('combobox', { name: 'Уровень доступа' }).selectOption('NONE');
  await panel.getByRole('button', { name: 'Добавить сотрудника', exact: true }).click();
  // После сохранения экран сразу переходит в карточку, временный status может исчезнуть.
  // Проверяем сохранённого сотрудника в том же филиале, а не успеваемость чтения уведомления.
  await expect.poll(async () => {
    const response = await page.request.get(`${FIXTURE_API}/beauty/employees`, {
      headers: await apiHeaders(page),
    });
    expect(response.ok()).toBe(true);
    const { items } = await response.json() as { items: Array<{ name: string }> };
    return items.some((item) => item.name === name);
  }).toBe(true);
}

/** Окно часов мастера открывается по его имени в сетке */
async function openHours(page: Page, master: string) {
  await page.getByRole('main').getByRole('button', { name: master, exact: true }).click();
  return page.getByRole('dialog', { name: `Часы работы: ${master}` });
}

async function setWeek(page: Page, day: string, from: string, to: string) {
  const panel = await openHours(page, 'Дина');
  await panel
    .getByRole('group')
    .filter({ hasText: day })
    .getByRole('button', { name: 'Сделать рабочим', exact: true })
    .click();
  await panel.getByLabel(`${day}: начало`).fill(from);
  await panel.getByLabel(`${day}: конец`).fill(to);
  return panel;
}

/** Ячейка сетки: строка мастера, колонка дня недели по её номеру (0 это понедельник) */
function cell(page: Page, master: string, index: number) {
  return row(page, master).getByRole('cell').nth(index);
}

/** Окошко дня (вариант B владельца 25.10.2026): нажатие на плашку открывает переключатель даты и правку недели */
async function openDay(page: Page, master: string, index: number) {
  const day = cell(page, master, index);
  if ((await day.getByRole('dialog').count()) === 0) await day.getByRole('button').first().click();
  const menu = day.getByRole('dialog');
  await expect(menu).toBeVisible();
  return menu;
}

function row(page: Page, master: string) {
  return page
    .getByRole('main')
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: master }) });
}

async function apiHeaders(page: Page) {
  const scope = (await page.context().cookies()).find((c) => c.name === 'wetop_scope')?.value ?? '';
  return { 'x-wetop-test-client': '1', 'x-wetop-scope': decodeURIComponent(scope) };
}

test('«Сделать рабочим» и «Сохранить» сохраняют день без ручного ввода часов (приёмка 17.10)', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const panel = await openHours(page, 'Дина');
  await panel
    .getByRole('group')
    .filter({ hasText: 'Понедельник' })
    .getByRole('button', { name: 'Сделать рабочим', exact: true })
    .click();
  // в полях видно ровно то, что уйдёт на сервер: не подсказка, а значение
  await expect(panel.getByLabel('Понедельник: начало')).toHaveValue('09:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
  await page.goto('/beauty/schedule');
  await expect(cell(page, 'Дина', 0)).toContainText('Работает');
  await expect(cell(page, 'Дина', 0)).toContainText('09:00–18:00');
});

async function masterId(page: Page, request: APIRequestContext, name: string) {
  const { items } = (await (
    await request.get(`${FIXTURE_API}/beauty/employees`, { headers: await apiHeaders(page) })
  ).json()) as { items: Array<{ id: string; name: string }> };
  return items.find((e) => e.name === name)!.id;
}

test('сетка: выходной по графику ведёт в окно недели, переключатель меняет только дату (Q-SCHED-1)', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByRole('columnheader')).toHaveCount(8);
  // выходной по шаблону включить на одну дату нельзя: модели доп. рабочего дня нет
  await expect(cell(page, 'Дина', 2)).toContainText('Выходной по графику');
  await expect(cell(page, 'Дина', 2).getByRole('switch')).toHaveCount(0);
  await (await openDay(page, 'Дина', 2)).getByRole('button', { name: /Изменить график недели/ }).click();
  const panel = page.getByRole('dialog', { name: 'Часы работы: Дина' });
  await expect(panel.getByTestId('beauty-week-hint')).toContainText('каждую среду');
  await panel
    .getByRole('group')
    .filter({ hasText: 'Среда' })
    .getByRole('button', { name: 'Сделать рабочим', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
  await page.keyboard.press('Escape');
  await expect(cell(page, 'Дина', 2)).toContainText('Работает');
  await expect(cell(page, 'Дина', 2)).toContainText('09:00–18:00');

  // быстрый шаблон недели и кнопка «Задать часы» у нового специалиста (онбординг 21.10.2026)
  await addMaster(page, 'Ева');
  await page.goto('/beauty/schedule');
  await main.getByRole('row').filter({ hasText: 'Ева' }).getByTestId('beauty-week-unset').click();
  const eva = page.getByRole('dialog', { name: 'Часы работы: Ева' });
  await eva.getByRole('button', { name: 'Пн-Пт 10:00-19:00', exact: true }).click();
  await expect(eva.getByLabel('Пятница: начало')).toHaveValue('10:00');
  await expect(eva.getByRole('group', { name: 'Суббота' })).toContainText('Выходной');
  await eva.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(eva.getByRole('status')).toContainText('График сохранён');
  await page.screenshot({ path: `${SNAPSHOTS}/week-presets-1440.png` });
  await page.keyboard.press('Escape');
  await expect(main.getByRole('row').filter({ hasText: 'Ева' }).getByTestId('beauty-week-unset')).toHaveCount(0);

  // у мастера запись в эту среду: выключение дня её не отменяет и предупреждает
  // Берём дату отображаемой ячейки: неделя филиала может отличаться от недели браузера.
  const switchName = await cell(page, 'Дина', 2).getByRole('switch').getAttribute('name');
  const wednesday = switchName?.match(/(\d{4}-\d{2}-\d{2})$/)?.[1];
  expect(wednesday).toBeTruthy();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { beautyAppointments: [{ employeeId: await masterId(page, request, 'Дина'), date: wednesday }] },
  });
  await (await openDay(page, 'Дина', 2)).getByRole('switch').uncheck();
  await expect(cell(page, 'Дина', 2)).toContainText('Не работает');
  await expect(main.getByRole('alert')).toContainText('никто не отменил');

  // только эта дата: следующая среда по-прежнему рабочая
  const range = await main.getByTestId('beauty-week-range').textContent();
  await main.getByRole('link', { name: 'Следующая неделя', exact: true }).click();
  await expect(main.getByTestId('beauty-week-range')).not.toHaveText(range ?? '');
  await expect(cell(page, 'Дина', 2)).toContainText('Работает');
  await main.getByRole('link', { name: 'Прошлая неделя', exact: true }).click();
  await expect(main.getByTestId('beauty-week-range')).toHaveText(range ?? '');

  // включить дату обратно значит снять её однодневное отсутствие
  await (await openDay(page, 'Дина', 2)).getByRole('switch').check();
  await expect(cell(page, 'Дина', 2)).toContainText('Работает');
  await page.reload();
  await expect(cell(page, 'Дина', 2)).toContainText('Работает');
  await page.screenshot({ path: `${SNAPSHOTS}/grid-1440.png`, fullPage: true });
});

test('отбор «Профессия» по группам услуг мастера, отбора «Роль» нет (Q-SCHED-2)', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await addMaster(page, 'Асель');
  const headers = await apiHeaders(page);
  const svc = (await (
    await request.post(`${FIXTURE_API}/beauty/services`, {
      headers,
      data: { name: 'Маникюр', category: 'Ногти', durationMinutes: 60, priceMinor: '800000', currency: 'KZT' },
    })
  ).json()) as { id: string };
  const put = await request.put(
    `${FIXTURE_API}/beauty/employees/${await masterId(page, request, 'Дина')}/services`,
    { headers, data: { serviceIds: [svc.id] } },
  );
  expect(put.ok()).toBe(true);
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByLabel('Роль')).toHaveCount(0);
  // отбор применяется сразу при выборе: кнопки «Показать» в строке недели нет (вариант B, 25.10.2026)
  await expect(main.getByRole('button', { name: 'Показать', exact: true })).toHaveCount(0);
  await main.getByLabel('Профессия').selectOption('Ногти');
  await expect(page).toHaveURL(/group=/);
  await expect(main.getByRole('rowheader', { name: 'Дина' })).toBeVisible();
  await expect(main.getByRole('rowheader', { name: 'Асель' })).toHaveCount(0);
});

test('наложение интервалов в одном дне не уходит на сервер и не стирает ввод', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const panel = await setWeek(page, 'Среда', '09:00', '14:00');
  const day = panel.getByRole('group').filter({ hasText: 'Среда' });
  await day.getByRole('button', { name: 'Ещё интервал', exact: true }).click();
  await panel.getByLabel('Среда: начало').nth(1).fill('13:00');
  await panel.getByLabel('Среда: конец').nth(1).fill('18:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('накладываются');
  // набранное остаётся на месте: правим, а не вводим заново
  await expect(panel.getByLabel('Среда: начало').first()).toHaveValue('09:00');
  await expect(panel.getByLabel('Среда: конец').nth(1)).toHaveValue('18:00');
  // и до сервера такая неделя не доходит: отказ дал разбор домена прямо в браузере
  const sent = await request.get(`${FIXTURE_API}/__test/hits`);
  const { byRequest } = (await sent.json()) as { byRequest: Record<string, number> };
  expect(
    Object.keys(byRequest).filter((key) => key.includes('/working-hours')),
    'неверная неделя ушла на сервер',
  ).toEqual([]);
});

test('два интервала через перерыв сохраняются', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const panel = await setWeek(page, 'Пятница', '09:00', '13:00');
  await panel
    .getByRole('group')
    .filter({ hasText: 'Пятница' })
    .getByRole('button', { name: 'Ещё интервал', exact: true })
    .click();
  await panel.getByLabel('Пятница: начало').nth(1).fill('14:00');
  await panel.getByLabel('Пятница: конец').nth(1).fill('20:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
  await page.goto('/beauty/schedule');
  await expect(cell(page, 'Дина', 4)).toContainText('09:00–13:00, 14:00–20:00');
});

test('отсутствие на несколько дней видно в ячейке только для чтения, раздела «Нерабочие дни» нет', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByText('Нерабочие дни')).toHaveCount(0);
  // понедельник рабочий по графику: иначе ячейка говорит «Выходной по графику»
  const panel = await setWeek(page, 'Понедельник', '09:00', '18:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');
  const headers = await apiHeaders(page);
  const { items } = (await (
    await request.get(`${FIXTURE_API}/beauty/employees`, { headers })
  ).json()) as { items: Array<{ id: string; name: string }> };
  const id = items.find((e) => e.name === 'Дина')!.id;
  const monday = await page.evaluate(() => {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  });
  const off = await request.post(`${FIXTURE_API}/beauty/employees/${id}/time-offs`, {
    headers,
    data: {
      dateFrom: monday,
      dateTo: new Date(Date.parse(`${monday}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
      reason: 'отпуск',
    },
  });
  expect(off.ok()).toBe(true);
  await page.goto(`/beauty/schedule?week=${monday}`);
  await expect(cell(page, 'Дина', 0)).toContainText('Отсутствует');
  await expect(cell(page, 'Дина', 0)).toContainText('отпуск');
  await expect(cell(page, 'Дина', 0).getByRole('switch')).toHaveCount(0);
});

test('график на телефоне: страница без прокрутки вбок', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/beauty/schedule');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `${SNAPSHOTS}/grid-390.png`, fullPage: true });
});

for (const theme of ['light', 'dark'] as const) {
  test(`график доступен в ${theme === 'light' ? 'светлой' : 'тёмной'} теме`, async ({
    page,
    request,
  }) => {
    await openSalon(page, request);
    await addMaster(page, 'Дина');
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/beauty/schedule');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(audit.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);

    // окно часов тоже проверяем: в нём правка часов недели
    const panel = await openHours(page, 'Дина');
    await expect(panel).toBeVisible();
    await settled(panel);
    const inPanel = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(inPanel.violations.map((v) => `панель ${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: `${SNAPSHOTS}/week-${theme}.png`, fullPage: true });
  });
}
