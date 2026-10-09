import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

/**
 * График мастера в стойке (DATA_MODEL §19.1, Q-251, срез B4): недельный шаблон филиала, отсутствия и
 * филиалы мастера. Проверяется то, за чем приходит человек: неделя ставится и читается словами, отсутствие
 * предупреждает о записях и их не отменяет, перестановка между филиалами забирает график снятого.
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

async function addBranch(page: Page, name: string) {
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await main.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await main.getByLabel('Название филиала').fill(name);
  await main.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Салон создан');
}

async function openSalon(page: Page, request: APIRequestContext, second = false) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await addBranch(page, 'Студия Айна');
  if (second) await addBranch(page, 'Студия на Абая');
  await page.reload();
  await page
    .getByRole('main')
    .locator('.branches-grid section')
    .filter({ hasText: 'Студия Айна' })
    .getByRole('button', { name: 'Открыть салон', exact: true })
    .click();
  // MV8: открытый салон начинает с общего рабочего экрана дня
  await page.waitForURL('**/today');
  await page.goto('/calendar');
}

async function addMaster(page: Page, name: string) {
  await page.goto('/beauty/masters');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить мастера', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('Имя мастера').fill(name);
  await panel.getByRole('button', { name: 'Сохранить мастера', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Мастер добавлен');
}

async function setWeek(page: Page, day: string, from: string, to: string) {
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Изменить график', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel
    .getByRole('group')
    .filter({ hasText: day })
    .getByRole('button', { name: 'Сделать рабочим', exact: true })
    .click();
  await panel.getByLabel(`${day}: начало`).fill(from);
  await panel.getByLabel(`${day}: конец`).fill(to);
  return panel;
}

test('неделя мастера ставится и читается словами', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByTestId('beauty-schedule-summary')).toContainText('не задан');

  const panel = await setWeek(page, 'Понедельник', '9:00', '18:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');

  await page.goto('/beauty/schedule');
  // «9:00» приводится к «09:00» тем же правилом, что время заезда объекта (SET2)
  await expect(main.getByRole('row').filter({ hasText: 'Понедельник' })).toContainText(
    '09:00 до 18:00',
  );
  await expect(main.getByRole('row').filter({ hasText: 'Вторник' })).toContainText('Выходной');
  await expect(main.getByTestId('beauty-schedule-summary')).toContainText('9 часов');
  await page.screenshot({ path: `${SNAPSHOTS}/schedule-1440.png`, fullPage: true });
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
  await page.screenshot({ path: `${SNAPSHOTS}/week-error-1440.png`, fullPage: true });
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
  await expect(
    page.getByRole('main').getByRole('row').filter({ hasText: 'Пятница' }),
  ).toContainText('09:00 до 13:00, 14:00 до 20:00');
});

test('отсутствие предупреждает о записях, снимается с вопросом', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByTestId('beauty-timeoffs-empty')).toBeVisible();

  // у мастера уже есть запись в эти дни: срез B5 записи ещё не делает, стенд их подставляет
  const id = await main.getByTestId('beauty-schedule-master').inputValue();
  await request.post(`${FIXTURE_API}/__test/control`, {
    data: { beautyAppointments: [{ employeeId: id, date: '2026-11-11' }] },
  });

  await main.getByRole('button', { name: 'Добавить отсутствие', exact: true }).click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('С какого дня').fill('2026-11-10');
  await panel.getByLabel('По какой день включительно').fill('2026-11-12');
  await panel.getByLabel(/Причина/).fill('отпуск');
  await panel.getByRole('button', { name: 'Добавить отсутствие', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('остаётся 1 запись');
  await expect(panel.getByRole('status')).toContainText('никто не отменил');

  await page.goto('/beauty/schedule');
  const row = main.getByRole('row').filter({ hasText: '10.11.2026' });
  await expect(row).toContainText('отпуск');
  await expect(row).toContainText('1 запись');
  await page.screenshot({ path: `${SNAPSHOTS}/timeoff-1440.png`, fullPage: true });

  await row.getByRole('button', { name: 'Убрать', exact: true }).click();
  const ask = page.getByRole('dialog');
  await expect(ask).toContainText('Снять отсутствие');
  await ask.getByRole('button', { name: 'Снять отсутствие', exact: true }).click();
  await expect(main.getByTestId('beauty-timeoffs-empty')).toBeVisible();
});

test('отсутствие с концом раньше начала не уходит на сервер', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Добавить отсутствие', exact: true })
    .click();
  const panel = page.getByRole('dialog');
  await panel.getByLabel('С какого дня').fill('2026-11-14');
  await panel.getByLabel('По какой день включительно').fill('2026-11-12');
  await panel.getByRole('button', { name: 'Добавить отсутствие', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('конец раньше начала');
});

test('мастер переставляется между филиалами, снятый филиал забирает свой график', async ({
  page,
  request,
}) => {
  await openSalon(page, request, true);
  await addMaster(page, 'Дина');
  await page.goto('/beauty/schedule');
  const main = page.getByRole('main');
  await expect(main.getByTestId('beauty-schedule-locations')).toContainText('Студия Айна');
  const panel = await setWeek(page, 'Понедельник', '09:00', '18:00');
  await panel.getByRole('button', { name: 'Сохранить график', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('График сохранён');

  await page.goto('/beauty/schedule');
  await main.getByRole('button', { name: 'Изменить филиалы', exact: true }).click();
  const locations = page.getByRole('dialog');
  await locations.getByRole('checkbox', { name: 'Студия на Абая' }).check();
  await locations.getByRole('button', { name: 'Сохранить филиалы', exact: true }).click();
  await expect(locations.getByRole('status')).toContainText('Филиалы мастера сохранены');
  await page.goto('/beauty/schedule');
  await expect(main.getByTestId('beauty-schedule-locations')).toContainText('Студия на Абая');
  await page.screenshot({ path: `${SNAPSHOTS}/locations-1440.png`, fullPage: true });

  // снимаем текущий филиал: его график уходит вместе с ним
  await main.getByRole('button', { name: 'Изменить филиалы', exact: true }).click();
  const again = page.getByRole('dialog');
  await again.getByRole('checkbox', { name: 'Студия Айна' }).uncheck();
  await again.getByRole('button', { name: 'Сохранить филиалы', exact: true }).click();
  await expect(again.getByRole('status')).toContainText('Филиалы мастера сохранены');
  await page.goto('/beauty/schedule');
  await expect(main.getByTestId('beauty-schedule-summary')).toContainText(
    'в этом филиале не работает',
  );
  await expect(main.getByRole('row').filter({ hasText: 'Понедельник' })).toContainText('Выходной');
  // мастер, который здесь не работает, графика в этом филиале и не получит
  await expect(main.getByRole('button', { name: 'Изменить график', exact: true })).toHaveCount(0);
});

test('график на телефоне: без прокрутки вбок', async ({ page, request }) => {
  await openSalon(page, request);
  await addMaster(page, 'Дина');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/beauty/schedule');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // неделя это две короткие колонки: общий минимум таблиц 520 px резал её на телефоне
  const fits = await page
    .locator('.beauty-page .table-scroll:has(.beauty-week-table)')
    .evaluate((el) => el.scrollWidth <= el.clientWidth);
  expect(fits, 'неделя помещается в экран телефона без прокрутки таблицы').toBe(true);
  await page.screenshot({ path: `${SNAPSHOTS}/schedule-390.png`, fullPage: true });
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

    // панель графика тоже проверяем: в ней вся правка недели
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Изменить график', exact: true })
      .click();
    const panel = page.getByRole('dialog');
    await expect(panel).toBeVisible();
    await settled(panel);
    const inPanel = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(inPanel.violations.map((v) => `панель ${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.screenshot({ path: `${SNAPSHOTS}/week-${theme}.png`, fullPage: true });
  });
}
