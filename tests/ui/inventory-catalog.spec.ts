import { expect, test, devNoise } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const fixture = 'http://127.0.0.1:4311';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('каталог: поиск, тип, категория, сброс и сохранение фильтров', async ({ page }) => {
  await page.goto('/inventory');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  await main.getByRole('button', { name: 'Койко-места', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(72);
  await main.getByRole('searchbox', { name: 'Поиск по номерному фонду' }).fill('M01');
  await expect(main.getByTestId('unit-row')).toHaveCount(1);
  await expect(page).toHaveURL(/q=M01/);
  await page.reload();
  await expect(main.getByTestId('unit-row')).toHaveCount(1);
  await expect(main.getByRole('searchbox')).toHaveValue('M01');
  await main.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  // категория — фильтр в toolbar (ADR-107), постоянной левой панели больше нет
  await main.getByRole('combobox', { name: 'Категория размещения' }).selectOption('MALE');
  await expect(main.getByTestId('unit-row')).toHaveCount(36);
  await expect(page).toHaveURL(/category=MALE/);
  await page.goBack();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
});

test('прямая ссылка на категорию сохраняется, список — вид по умолчанию, карточка открывается', async ({
  page,
}) => {
  await page.goto('/inventory?category=ROOM');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(16);
  await expect(main.getByRole('table', { name: 'Номера и койко-места' })).toBeVisible();
  await main.getByRole('button', { name: 'Карточки', exact: true }).click();
  await expect(main.getByRole('table', { name: 'Номера и койко-места' })).toHaveCount(0);
  await page.reload();
  await expect(main.getByRole('button', { name: 'Карточки', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await main.getByRole('button', { name: 'Список', exact: true }).click();
  // место открывается панелью справа поверх фонда (ADR-107, I2), адрес — карточки места
  await main.getByRole('link', { name: 'Открыть номер R01', exact: true }).click();
  await expect(page).toHaveURL(/\/units\/R01/);
  await expect(page.getByRole('dialog', { name: 'Номер R01' })).toBeVisible();
});

test('таблица показывает расположение, состояние и уборку; строка и меню «⋯» работают', async ({
  page,
  request,
}) => {
  // дизайн-сид фикстуры даёт блокировки с причиной и статусы уборки (тот же, что у /design-system)
  await request.post(`${fixture}/__test/design-seed`);
  await page.goto('/inventory');
  const main = page.getByRole('main');
  const row = (code: string) =>
    main
      .getByTestId('unit-row')
      .filter({ has: page.getByRole('link', { name: `Открыть номер ${code}`, exact: true }) });
  await expect(row('R09')).toContainText('заблокирована');
  await expect(row('R09')).toContainText('ремонт: кондиционер');
  await expect(row('R01')).toContainText('требует уборки');
  await expect(row('R01')).toContainText('Корпус Основной');
  await expect(row('R02')).toContainText('в продаже');
  await expect(row('R02')).toContainText('проверено');
  // строка сама открывает карточку места: клик по обычной ячейке, не по ссылке (ТЗ §12)
  await row('R02').locator('td').nth(1).click();
  await expect(page).toHaveURL(/\/units\/R02/);
  await expect(page.getByRole('dialog', { name: 'Номер R02' })).toBeVisible();
  await page.goBack();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  // кнопок «Редактировать» в строках больше нет — действия в меню «⋯»
  await expect(main.getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(0);
  await main.getByRole('button', { name: 'Действия: R03', exact: true }).click();
  // строка открывает панель, меню — полную карточку: пункт назван тем, куда ведёт (I2)
  await expect(
    page.getByRole('menuitem', { name: 'Полная карточка', exact: true }),
  ).toHaveAttribute('href', '/units/R03');
  await page.getByRole('menuitem', { name: 'Переименовать комнату', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Редактировать комнату' })).toBeVisible();
});

test('пустой поиск объясняется, сброс возвращает фонд', async ({ page }) => {
  await page.goto('/inventory?q=несуществующий-номер');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Сбросить фильтры', exact: true })
    .click();
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(88);
});

for (const theme of ['light', 'dark'] as const) {
  test(`каталог адаптивен и доступен: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/inventory-design-2026-09-20', { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (e) => {
      if (!devNoise.test(e.message)) errors.push(e.message);
    });
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/inventory');
      await expect(page.getByRole('searchbox', { name: 'Поиск по номерному фонду' })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390 || width === 1440) {
        const audit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        await page.screenshot({
          path: `reports/inventory-design-2026-09-20/catalog-${theme}-${width}.png`,
        });
      }
      if (width === 390) {
        await page.getByRole('combobox', { name: 'Категория размещения' }).selectOption('MALE');
        await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(36);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('пустой фонд отличается от пустого поиска', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { empty: true } });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Номерной фонд пока пуст' })).toBeVisible();
  await expect(page.getByRole('main').getByTestId('total-units')).toHaveText('0');
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(0);
});

test('категория и тип пересекаются, фильтр доступен с клавиатуры без запроса страницы', async ({
  page,
}) => {
  await page.goto('/inventory?category=MALE');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(36);
  const filterRequests: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/inventory') filterRequests.push(r.url());
  });
  await main.getByRole('button', { name: 'Номера', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(main.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await main.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click();
  await expect(main.getByTestId('unit-row')).toHaveCount(88);
  expect(filterRequests).toEqual([]);
  await main.getByRole('link', { name: 'Открыть номер R01', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/units\/R01/);
  await expect(page.getByRole('dialog', { name: 'Номер R01' })).toBeVisible();
});

test('панель места: факты, сейчас и следующее, уборка из панели; Escape возвращает фонд с фильтрами', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/design-seed`);
  await page.goto('/inventory?kind=ROOM');
  const main = page.getByRole('main');
  await expect(main.getByTestId('unit-row')).toHaveCount(16);
  await main
    .getByTestId('unit-row')
    .filter({ has: page.getByRole('link', { name: 'Открыть номер R09', exact: true }) })
    .locator('td')
    .nth(1)
    .click();
  const drawer = page.getByRole('dialog', { name: 'Номер R09' });
  await expect(drawer).toBeVisible();
  await expect(page).toHaveURL(/\/units\/R09$/);
  await expect(drawer.getByTestId('unit-category')).toHaveText(
    'Одноместная комната с окном и балконом',
  );
  await expect(drawer.getByTestId('unit-place')).toContainText('Корпус Основной');
  await expect(drawer.getByTestId('unit-capacity')).toHaveText('2 гостя');
  await expect(drawer.getByTestId('unit-state')).toContainText('заблокирована');
  await expect(drawer.getByTestId('unit-state')).toContainText('ремонт: кондиционер');
  await expect(drawer.getByTestId('unit-now')).toHaveText('свободно');
  await expect(drawer.getByTestId('unit-next')).toContainText('бронь');
  // даты блокировки словами, без « · » и сырых 2026-09-28
  await expect(drawer.getByTestId('block-row').first()).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  // под панелью фонд с тем же фильтром: список не перерисовался на пустые параметры адреса панели
  await expect(main.getByTestId('unit-row')).toHaveCount(16);
  // уборка из панели — тем же блоком, что в карточке
  await drawer.getByTestId('hk-DIRTY').click();
  await expect(drawer.getByTestId('unit-hk')).toHaveText('требует уборки');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/inventory\?kind=ROOM$/);
  await expect(
    main
      .getByTestId('unit-row')
      .filter({ has: page.getByRole('link', { name: 'Открыть номер R09', exact: true }) }),
  ).toContainText('требует уборки');
  // прямой заход по адресу — полная карточка с теми же фактами, без панели
  await page.goto('/units/R09');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('R09');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('main').getByTestId('unit-facts')).toBeVisible();
});

test('панель места: живущий гость — «живёт», отменённая бронь и незаезд место не держат', async ({
  page,
  request,
}) => {
  // дизайн-сид: R08 — гость заселён до завтра; R07 — отменённая бронь на сегодня и незаезд со вчера
  await request.post(`${fixture}/__test/design-seed`);
  const open = async (code: string) => {
    await page.goto('/inventory?kind=ROOM');
    await page
      .getByRole('main')
      .getByRole('link', { name: `Открыть номер ${code}`, exact: true })
      .click();
    const drawer = page.getByRole('dialog', { name: `Номер ${code}` });
    await expect(drawer).toBeVisible();
    return drawer;
  };
  const living = await open('R08');
  await expect(living.getByTestId('unit-now')).toContainText('живёт');
  await expect(living.getByTestId('unit-now')).toContainText('DSG-DESK');
  await page.keyboard.press('Escape');
  // как GET /units/:code — отменённые и незаезды в карточку места не попадают
  await expect((await open('R07')).getByTestId('unit-now')).toHaveText('свободно');
});

for (const theme of ['light', 'dark'] as const) {
  test(`панель места доступна: ${theme}`, async ({ page, request }) => {
    await request.post(`${fixture}/__test/design-seed`);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/inventory?kind=ROOM');
      await page
        .getByRole('main')
        .getByRole('link', { name: 'Открыть номер R09', exact: true })
        .click();
      await expect(page.getByRole('dialog', { name: 'Номер R09' })).toBeVisible();
      const audit = await new AxeBuilder({ page })
        .include('dialog[open]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      await page.keyboard.press('Escape');
    }
  });
}
