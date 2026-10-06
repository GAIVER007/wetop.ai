import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import { FIXTURE_API, expect, test } from './fixtures';

/**
 * «Задачи» стойки (DATA_MODEL §22, ADR-145): создать, закрыть и открыть снова, раскладка по срокам, счётчик
 * «Задачи» в панели «Сегодня» календаря, «только чтение», доступность. Подставной API разбирает ввод тем же
 * доменом, что настоящий. Задачи вымышленные (ADR-010).
 */
const API = FIXTURE_API;
const H = { 'x-wetop-test-client': '1' };
const SHOTS = 'reports/desk-tasks-2026-10-04';

test.beforeEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`, { headers: H });
});
test.afterEach(async ({ request }) => {
  await request.post(`${API}/__test/reset`, { headers: H });
});

const plus = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
async function today(request: import('@playwright/test').APIRequestContext) {
  return (
    (await (await request.get(`${API}/desk/today`, { headers: H })).json()) as { date: string }
  ).date;
}

test('создать задачу, увидеть в «Сегодня», закрыть и открыть снова; счётчик в панели календаря', async ({
  page,
  request,
}) => {
  const t0 = await today(request);
  await page.goto('/tasks');
  await expect(page.getByRole('heading', { name: 'Задачи', exact: true })).toBeVisible();
  await expect(page.getByText('Задач пока нет')).toBeVisible();

  await page.getByTestId('task-new').click();
  const form = page.getByTestId('task-form');
  await form.getByTestId('task-title').fill('Позвонить гостю');
  await form.getByTestId('task-time').fill('9.30');
  await form.getByTestId('task-save').click();
  const section = page.getByTestId('tasks-today');
  await expect(section.getByTestId('task-row')).toContainText('Позвонить гостю');
  await expect(section.getByTestId('task-row')).toContainText('09:30');

  // счётчик в панели «Сегодня» календаря
  await page.goto('/chessboard');
  await expect(
    page.getByRole('group', { name: 'Сегодня на объекте' }).getByTestId('day-tasks'),
  ).toHaveCount(0);

  await page.goto('/tasks');
  await page.getByRole('checkbox', { name: 'Сделано: Позвонить гостю' }).click();
  await expect(page.getByTestId('tasks-done').getByTestId('task-row')).toContainText(
    'Позвонить гостю',
  );
  await expect(page.getByTestId('tasks-today')).toContainText('На сегодня задач нет');
  await page.getByRole('checkbox', { name: 'Сделано: Позвонить гостю' }).click();
  await expect(page.getByTestId('tasks-today').getByTestId('task-row')).toHaveCount(1);

  // просроченная и предстоящая
  for (const [title, d] of [
    ['Старая задача', plus(t0, -2)],
    ['Заказать воду', plus(t0, 3)],
  ])
    await request.post(`${API}/tasks`, { headers: H, data: { title, dueDate: d } });
  await page.reload();
  await expect(page.getByTestId('tasks-overdue').getByTestId('task-row')).toContainText(
    'Старая задача',
  );
  await expect(page.getByTestId('tasks-upcoming').getByTestId('task-row')).toContainText(
    'Заказать воду',
  );
});

test('ошибка словами у формы, введённое не теряется', async ({ page }) => {
  await page.goto('/tasks');
  await page.getByTestId('task-new').click();
  const form = page.getByTestId('task-form');
  await form.getByTestId('task-title').fill('Проверить кондиционеры');
  await form.getByTestId('task-time').fill('25:00');
  await form.getByTestId('task-save').click();
  await expect(form.getByText('Время — в виде 14:00 или пусто («весь день»)')).toBeVisible();
  await expect(form.getByTestId('task-title')).toHaveValue('Проверить кондиционеры');
});

test('«только чтение»: список виден, создавать и закрывать нельзя', async ({ page, request }) => {
  const t0 = await today(request);
  await request.post(`${API}/tasks`, {
    headers: H,
    data: { title: 'Вымышленная задача', dueDate: t0 },
  });
  await request.post(`${API}/__test/control`, { data: { orgTrialDays: 'ended' } });
  // срок пробного периода приходит с сессией: сначала вход, как в спеке рынка
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/tasks');
  await expect(page.getByTestId('task-row')).toContainText('Вымышленная задача');
  await expect(page.getByTestId('task-new')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Сделано/ })).toBeDisabled();
});

for (const theme of ['light', 'dark'] as const) {
  test(`снимки и доступность: ${theme}`, async ({ page, request }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    const t0 = await today(request);
    for (const [title, d, priority] of [
      ['Позвонить гостю по броне', t0, 'HIGH'],
      ['Заказать воду для номеров', plus(t0, 2), 'NORMAL'],
      ['Сверить кассу за вчера', plus(t0, -1), 'NORMAL'],
    ] as const)
      await request.post(`${API}/tasks`, { headers: H, data: { title, dueDate: d, priority } });
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tasks');
    await expect(page.getByTestId('task-row')).toHaveCount(3);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/${theme}-1440.png` });
    await page.getByTestId('task-new').click();
    await expect(page.getByTestId('task-form')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${theme}-form.png` });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${SHOTS}/${theme}-390.png` });
  });
}
