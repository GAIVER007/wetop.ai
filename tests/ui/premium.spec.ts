import { FIXTURE_API, boardFilter, expect, test, devNoise, openProfileMenu } from './fixtures';
import { mkdirSync } from 'node:fs';
const fixture = FIXTURE_API;
const screenshotDir = 'reports/premium-ui';
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
  mkdirSync(screenshotDir, { recursive: true });
});
test('темы: system, мгновенное переключение, сохранение после перезагрузки', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/today');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-light.png` });
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Утверждённая Главная показывает поступления в общем денежном блоке.
  await expect(page.getByTestId('owner-paid')).toBeVisible();
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-dark.png` });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Как на устройстве' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
test('shell: панель, меню профиля, поиск', async ({ page }) => {
  await page.goto('/today');
  // панели слева нет (ADR-134): разделы в шапке, сворачивать нечего
  await expect(page.locator('.workspace-header .topmenu__tab').first()).toHaveText('Главная');
  // меню профиля упрощено 01.10 («Simplify account menu»): обучение и вход/выход, ссылки «Профиль и
  // предпочтения» больше нет
  await openProfileMenu(page);
  await expect(page.getByTestId('tour-restart')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tour-restart')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Найти гостя или бронь' })).toBeHidden();
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Быстрый поиск' });
  await expect(search).toBeVisible();
  await search.getByLabel('Запрос').fill('Тест');
  await search.getByRole('button', { name: 'Найти', exact: true }).click();
  await expect(page).toHaveURL(/guests\?q=/);
});
test('drawer: бронь открывается поверх доски, вкладки доступны клавиатурой, Escape возвращает контекст', async ({
  page,
}) => {
  await page.goto('/chessboard');
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/chessboard-light.png` });
  await page.getByTestId('stay-cell').first().dblclick();
  const drawer = page.getByRole('dialog', { name: 'Бронирование', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { level: 1 })).toContainText('Бронь');
  await drawer.getByRole('tab', { name: 'Счета', exact: true }).click();
  await expect(drawer.getByTestId('folio-panel')).toBeVisible();
  await drawer.getByRole('tab', { name: 'Счета', exact: true }).press('ArrowRight');
  await expect(drawer.getByRole('tab', { name: 'Действия', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/booking-drawer.png` });
  await drawer.getByRole('tab', { name: 'Обзор', exact: true }).click();
  await drawer.getByRole('link', { name: 'Принять оплату', exact: true }).click();
  await expect(drawer.getByRole('tab', { name: 'Счета', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await drawer
    .getByTestId('payment-form')
    .getByRole('button', { name: 'Принять оплату', exact: true })
    .click();
  await expect(drawer.getByTestId('folio-balance')).toHaveText('0 ₸ · оплачено');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/chessboard/);
  await expect(page.getByTestId('chessboard')).toBeVisible();
});
test('новые фильтры шахматки, список броней и карточки номеров используют данные', async ({
  page,
}) => {
  await page.goto('/chessboard');
  // Status filters apply to the first date; seed occupancy is relative to today.
  const today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);
  const last = new Date(Date.parse(`${today}T00:00:00Z`) + 6 * 86400_000)
    .toISOString()
    .slice(0, 10);
  await page.goto(`/chessboard?from=${today}&to=${last}`);
  // тип места — в окошке «Фильтры» (PR 7 «Шахматки v2»), состояние мест — полем в строке
  const main = page.getByRole('main');
  const filters = page.getByRole('dialog', { name: 'Фильтры календаря' });
  const kind = async (name: string) => {
    await main.getByRole('button', { name: /^Фильтры( \d+)?$/ }).click();
    await filters.getByRole('button', { name, exact: true }).click();
    await filters.getByRole('button', { name: 'Применить', exact: true }).click();
  };
  await kind('Номера');
  await expect(page.getByTestId('unit-row')).toHaveCount(16);
  await kind('Койки');
  await expect(page.getByTestId('unit-row')).toHaveCount(72);
  await boardFilter(page, { state: 'FREE' });
  const count = await page.getByTestId('unit-row').count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(72);
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await expect(page.getByTestId('unit-row')).toHaveCount(88);
  await page.goto('/reservations');
  // девять броней фикстуры: восемь прежних и «не заехал вовремя» (20260913-TEST8)
  await expect(page.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(9);
  // статус — больше не чипы, а поле «Статус брони» с кнопкой «Показать» (упрощение списка 01.10, 3a916ca)
  await page.getByLabel('Статус брони', { exact: true }).selectOption('CANCELLED');
  await page.getByRole('button', { name: 'Показать', exact: true }).click();
  await expect(page.getByText('Бронирований не найдено')).toBeVisible();
  // Карточки номеров с PR #66 живут в /inventory (/rooms — переход туда); фильтры, поиск и вид
  // каталога проверяет inventory-catalog.spec
  await page.goto('/rooms');
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('main').getByTestId('unit-row')).toHaveCount(88);
  await page.screenshot({ caret: 'initial', path: `${screenshotDir}/rooms-light.png` });
});
test('новые страницы и обе темы: адаптивность и отсутствие ошибок браузера', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    if (!devNoise.test(e.message)) errors.push(e.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const routes = [
    '/today',
    '/chessboard',
    '/reservations',
    '/guests',
    '/inventory',
    '/finance',
    '/profile',
    '/profile',
    '/connections',
    '/hotel-settings',
    '/channels',
    '/channels/sync',
    '/journal',
    '/incidents',
    '/marketing',
    '/website',
    '/website/analytics',
    '/management/analytics',
    '/management/analytics/occupancy',
    '/hotel-settings/services',
  ];
  for (const width of [320, 390, 768, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (width === 390 && route === '/today')
        await page.screenshot({ caret: 'initial', path: `${screenshotDir}/dashboard-mobile.png` });
      const overflow = await page.evaluate(() => {
        const browser = globalThis as unknown as {
          document: { documentElement: { scrollWidth: number } };
          innerWidth: number;
        };
        return browser.document.documentElement.scrollWidth > browser.innerWidth + 1;
      });
      expect(overflow, `${width} ${route}`).toBe(false);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/today');
  await page.getByRole('button', { name: 'Переключить тему', exact: true }).click();
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  expect(errors).toEqual([]);
});
// вход настоящий (ADR-047): чужая почта с чужим паролем не пускает, и текст один для обоих случаев
test('вход не пускает с чужой почтой и чужим паролем', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('demo@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Неверная почта или пароль',
  );
  await expect(page).toHaveURL(/\/auth\/fallback/);
});

/**
 * B1 «Список броней» (tasks/todo.md, 20.09.2026): выборка названа словами — число, день и статус;
 * пустой результат называет условие и предлагает убрать именно его, а не только «сбросить всё»;
 * на телефоне строка складывается в карточку — гость, место, даты, статус и остаток видны без
 * прокрутки вбок, у фильтров статуса цели 44 px.
 */
test('список броней: выборка названа, пустой результат предлагает поправку, телефон без прокрутки вбок', async ({
  page,
}) => {
  await page.goto('/reservations');
  const main = page.getByRole('main');
  const meta = main.getByTestId('directory-meta');
  await expect(meta).toContainText('9 бронирований');
  // один день — одна дата словами, без «20 сент. — 20 сент.»
  await expect(meta).toContainText(/на \d{1,2} [а-яё]+\.?/); // «мая» — без точки
  await expect(meta).not.toContainText('—');
  // ручной период — за кнопкой «Даты» (ADR-106, §62 ТЗ); в раскрытом виде подписи видны, не только aria-label
  await main.getByRole('button', { name: 'Даты', exact: true }).click();
  await expect(main.locator('.reservations-toolbar').getByText('С', { exact: true })).toBeVisible();
  await expect(
    main.locator('.reservations-toolbar').getByText('По', { exact: true }),
  ).toBeVisible();
  // одна страница — счётчик страниц не рисуется
  await expect(main.getByText(/Страница \d+ из/)).toHaveCount(0);

  // пустой результат: шапки пустой таблицы нет, поправка точечная — кнопки ровно по применённым
  // отборам (словами отбор больше не называется: упрощение списка 01.10, 3a916ca)
  await page.goto('/reservations?status=CANCELLED&q=Иванов');
  const empty = main.locator('.empty-state');
  await expect(empty).toContainText('Бронирований не найдено');
  await expect(main.getByTestId('reservations-table')).toHaveCount(0);
  await empty.getByRole('link', { name: 'Убрать поиск', exact: true }).click();
  await expect(main.getByLabel('Поиск броней')).toHaveValue('');
  await expect(page).toHaveURL(/status=CANCELLED/);
  await main
    .locator('.empty-state')
    .getByRole('link', { name: 'Все статусы', exact: true })
    .click();
  await expect(main.getByTestId('reservations-table').locator('tbody tr')).toHaveCount(9);

  // телефон
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reservations');
  const table = main.getByTestId('reservations-table');
  const overflow = await main
    .locator('.table-scroll')
    .evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const row = table.locator('tbody tr').first();
  await expect(row).toContainText(/\d{1,2} [а-яё]+\.?/);
  // слово статуса из реестра (DS1a); группа «Подтверждённые» осталась именем отбора
  await expect(row).toContainText('Подтверждена');
  await expect(row).toContainText('к оплате');
  await expect(row.getByRole('link', { name: 'Открыть бронь 20260913-TESTAA' })).toBeVisible();
  const chip = await main.getByLabel('Статус брони', { exact: true }).boundingBox();
  expect(chip!.height).toBeGreaterThanOrEqual(44);
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(layout.content).toBeLessThanOrEqual(layout.viewport + 1);
});
