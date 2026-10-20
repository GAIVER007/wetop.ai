import AxeBuilder from '@axe-core/playwright';
import { FIXTURE_API, expect, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * «Персонал»: специалист, другой сотрудник или оба (DATA_MODEL.md, решения владельца 18.10 и 20.10.2026).
 * Экран «Специалисты» показывает вкладки по назначению, старые записи без назначения отдельно «Не назначено (N)»,
 * руководитель меняет назначение в строке, у администратора только метка. Карточка остаётся страницей
 * /employees/<id>/profile.
 */
const SNAPSHOTS = 'reports/personnel-kind-2026-10-20';
const TEST_CLIENT = { 'x-wetop-test-client': '1' };
// первый заход компилирует страницы next dev: запас как в beauty-catalog.spec.ts
test.describe.configure({ timeout: 180_000 });

async function openSalon(page: Page, request: APIRequestContext) {
  await request.post(`${FIXTURE_API}/__test/reset`);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const main = page.getByRole('main');
  await main.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия Айна');
  await creation.getByRole('button', { name: 'Создать бизнес', exact: true }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main.getByRole('button', { name: 'Открыть объект: Студия Айна', exact: true }).click();
  await page.waitForURL('**/today');
}

/** Старые записи (до миграции 138) приходят без назначения; новые с назначением из формы */
async function seedPeople(request: APIRequestContext) {
  for (const data of [
    { name: 'Алия Старая запись', active: true },
    { name: 'Бота Специалист', active: true, personnelKind: 'SPECIALIST' },
    { name: 'Гульнар Администратор', active: true, personnelKind: 'OTHER_EMPLOYEE' },
    { name: 'Дана Мастер и админ', active: true, personnelKind: 'BOTH' },
  ]) {
    const response = await request.post(`${FIXTURE_API}/beauty/employees`, {
      headers: TEST_CLIENT,
      data,
    });
    expect(response.ok()).toBe(true);
  }
}

const tablist = (page: Page) =>
  page.getByRole('main').getByRole('tablist', { name: 'Назначение в персонале' });
const panel = (page: Page) => page.getByRole('main').getByRole('tabpanel');

test('вкладки по назначению и назначение старой записи руководителем', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await seedPeople(request);
  await page.goto('/employees');
  const tabs = tablist(page);
  // единый экран (вариант A, 20.10.2026): «Все» первой, «Не назначено» с числом и плиткой-предупреждением
  await expect(tabs.getByRole('tab')).toHaveText([
    'Все4',
    'Не назначено1',
    'Специалисты2',
    'Другие сотрудники2',
  ]);
  await expect(tabs.getByRole('tab', { name: /^Все/ })).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).getByTestId('staff-row')).toHaveCount(4);
  await tabs.getByRole('tab', { name: /^Не назначено/ }).click();
  await expect(panel(page)).toContainText('Укажите, кто это');
  await expect(panel(page).getByTestId('staff-row')).toHaveCount(1);
  await page.screenshot({ path: `${SNAPSHOTS}/employees-1440-light.png`, fullPage: true });

  await tabs.getByRole('tab', { name: /^Специалисты/ }).click();
  await expect(panel(page).getByTestId('staff-row')).toHaveText([
    /Бота Специалист/,
    /Дана Мастер и админ/,
  ]);
  await tabs.getByRole('tab', { name: /^Другие сотрудники/ }).click();
  await expect(panel(page).getByTestId('staff-row')).toHaveText([
    /Гульнар Администратор/,
    /Дана Мастер и админ/,
  ]);
  // «оба» это одна запись: одна ссылка на одну карточку
  const both = panel(page).getByTestId('staff-row').filter({ hasText: 'Дана Мастер и админ' });
  await expect(both.getByRole('link', { name: 'Открыть' })).toHaveAttribute(
    'href',
    /\/employees\/[0-9a-f-]+\/profile$/,
  );

  // руководитель назначает старую запись: она уходит из «Не назначено», вкладка пропадает
  await tabs.getByRole('tab', { name: /^Не назначено/ }).click();
  await panel(page).getByLabel('Назначение: Алия Старая запись').selectOption('OTHER_EMPLOYEE');
  await expect(tabs.getByRole('tab')).toHaveText(['Все4', 'Специалисты2', 'Другие сотрудники3']);
  await page.reload();
  await tabs.getByRole('tab', { name: /^Другие сотрудники/ }).click();
  await expect(panel(page).getByLabel('Назначение: Алия Старая запись')).toHaveValue(
    'OTHER_EMPLOYEE',
  );
});

test('устаревшая версия: понятное сообщение и свежий список', async ({ page, request }) => {
  await openSalon(page, request);
  await seedPeople(request);
  await page.goto('/employees');
  const list = (await (
    await request.get(`${FIXTURE_API}/beauty/employees`, { headers: TEST_CLIENT })
  ).json()) as {
    items: Array<{ id: string; name: string; profileRevision: string }>;
  };
  const target = list.items.find((row) => row.name === 'Алия Старая запись')!;
  // другое окно меняет имя: версия профиля на экране устарела
  const renamed = await request.patch(`${FIXTURE_API}/beauty/employees/${target.id}`, {
    headers: TEST_CLIENT,
    data: { name: 'Алия Переименована', expectedProfileRevision: target.profileRevision },
  });
  expect(renamed.ok()).toBe(true);
  await panel(page).getByLabel('Назначение: Алия Старая запись').selectOption('SPECIALIST');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('изменили в другом окне');
  await expect(panel(page)).toContainText('Алия Переименована');
  await expect(panel(page).getByLabel('Назначение: Алия Переименована')).toHaveValue('');
});

test('администратор видит только метки, без выбора', async ({ page, request }) => {
  await openSalon(page, request);
  await seedPeople(request);
  await request.post(`${FIXTURE_API}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/employees');
  await expect(tablist(page)).toBeVisible();
  await expect(page.getByRole('main').getByRole('combobox', { name: /^Назначение:/ })).toHaveCount(
    0,
  );
  await expect(
    panel(page).getByTestId('staff-row').filter({ hasText: 'Алия Старая запись' }),
  ).toContainText('Не назначено');
});

test('новый сотрудник: назначение выбирается в форме, по умолчанию «Специалист»', async ({
  page,
  request,
}) => {
  await openSalon(page, request);
  await page.goto('/employees');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Добавить специалиста', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const kind = dialog.getByLabel('Кто это');
  await expect(kind).toHaveValue('SPECIALIST');
  await kind.selectOption('BOTH');
  await dialog.getByLabel('Имя мастера').fill('Ержан Новый');
  await dialog.getByRole('button', { name: 'Создать мастера', exact: true }).click();
  // карточка мастера остаётся отдельной страницей (решение владельца 20.10.2026)
  await expect(page).toHaveURL(/\/employees\/[0-9a-f-]+\/profile$/, { timeout: 90_000 });
  await page.goto('/employees');
  await expect(tablist(page).getByRole('tab')).toHaveText(['Все1', 'Специалисты1', 'Другие сотрудники1']);
  await expect(panel(page).getByLabel('Назначение: Ержан Новый')).toHaveValue('BOTH');
});

// «сколько принёс» (решение владельца 20.10.2026): строка на карточке и переключатель периода ссылками
test('«Принёс» на карточке специалиста: день, неделя, месяц', async ({ page, request }) => {
  await openSalon(page, request);
  await seedPeople(request);
  await page.goto('/employees');
  // первая заведённая запись (старая, без назначения) получает синтетическую сумму стенда: 8 000 ₸ в день
  const card = panel(page).getByTestId('staff-row').filter({ hasText: 'Алия Старая запись' });
  await expect(page.getByRole('main').locator('thead').first()).toContainText('Принёс сегодня');
  await expect(card.getByTestId('employee-earned')).toHaveText('8 000 ₸');
  const periods = page.getByRole('navigation', { name: 'Период для «Принёс»' });
  await periods.getByRole('link', { name: 'Неделя' }).click();
  await expect(page).toHaveURL(/\/employees\?period=week$/, { timeout: 90_000 });
  await expect(card.getByTestId('employee-earned')).toHaveText('40 000 ₸');
  await page.screenshot({ path: `${SNAPSHOTS}/beauty-earned-1440.png`, fullPage: true });
  await tablist(page).getByRole('tab', { name: /^Специалисты/ }).click();
  const bota = panel(page).getByTestId('staff-row').filter({ hasText: 'Бота Специалист' });
  await expect(bota.getByTestId('employee-earned')).toHaveCount(0);
  await expect(bota).toContainText('—');
});

for (const theme of ['light', 'dark'] as const) {
  test(`экран «Специалисты» доступен в ${theme === 'light' ? 'светлой' : 'тёмной'} теме, 1440 и 390`, async ({
    page,
    request,
  }) => {
    await openSalon(page, request);
    await seedPeople(request);
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto('/employees');
      await expect(tablist(page)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${width}`,
      ).toBe(true);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(audit.violations.map((v) => `${width} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      if (theme === 'dark' && width === 1440)
        await page.screenshot({ path: `${SNAPSHOTS}/employees-1440-dark.png`, fullPage: true });
      if (theme === 'light' && width === 390)
        await page.screenshot({ path: `${SNAPSHOTS}/employees-390-light.png`, fullPage: true });
    }
  });
}
