import { FIXTURE_API, expect, test, devNoise, sideNav, openSection } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

// Контракт меню: основные разделы доступны ровно по разу, настройки объекта — во внутренних вкладках.
// «ИИ-агенты» в «Продажах» всегда, доступ проверяет сам раздел (ADR-090); «Платформа» — только по
// отметке главного администратора (ADR-083, tests/ui/platform-access.spec.ts).
// С 10.10.2026 (ADR-161) на компьютере разделы в левом меню с панелью (tests/ui/side-nav.spec.ts),
// здесь: меню телефона и планшета «Навигация» из того же реестра и обход всех пунктов по страницам.
// верхнее меню по решению владельца 17.10.2026 (ADR-TOPNAV-20261017): одна строка разделов у всех направлений,
// «Продажи» и «Маркетинг» в «Продвижении», экраны бара в «Складе», «Помощь» своим разделом
const routes = [
  '/today',
  '/chessboard',
  '/team',
  // кабинет горничной и ресепшена S10 (22.10.2026): «График работы» и «Зарплата» есть и у гостиницы
  '/staff-schedule',
  '/payroll',
  '/guests',
  '/reservations',
  '/inventory',
  '/reports',
  '/management/analytics',
  '/bar/products',
  '/bar/receipts',
  '/warehouse',
  '/bar',
  '/bar/consumables',
  // «Меню бара» (§62.3, K3 24.10.2026)
  '/bar/menu',
  '/bar/operations',
  '/bar/suppliers',
  '/finance',
  '/reports/finance',
  '/hotel-settings',
  '/channels',
  '/connections',
  '/incidents',
  '/journal',
  '/settings',
  '/marketing',
  '/marketing/ads',
  '/marketing/content',
  '/marketing/voice',
  '/ai-agents',
  '/market',
  '/sales',
  // «Бюджет и аналитика» одним пунктом (20.10.2026): аналитика вкладкой раздела
  '/marketing/budget',
  '/help',
];

const SECTIONS = [
  'Главная',
  'Журнал',
  'Персонал',
  'Клиенты',
  'Услуги',
  'Статистика',
  'Склад',
  'Финансы',
  'Настройки',
  'Продвижение',
  'Помощь',
];

const fixture = FIXTURE_API;
test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('меню телефона: работа смены прямыми ссылками, группы раскрываются, переход закрывает окно', async ({
  page,
}) => {
  await page.goto('/finance');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Навигация', exact: true });
  await expect(menu.locator('.sidebar-section-toggle')).toHaveText(SECTIONS);
  const links = await menu
    .locator('.workspace-links a')
    .evaluateAll((items) => items.map((item) => item.getAttribute('href')));
  expect([...links].sort()).toEqual([...routes].sort());
  expect(new Set(links).size).toBe(links.length);
  // активная отметка на пункте группы «Финансы»
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Обзор финансов');
  // «Журнал» не спрятан в группе: прямая ссылка с подписью
  const board = menu.getByRole('link', { name: 'Журнал', exact: true });
  await expect(board.locator('span')).toBeVisible();
  await board.click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(menu).not.toBeVisible();
  // группа: раскрывается с клавиатуры, открыт один раздел
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const sales = menu.getByRole('button', { name: 'Настройки', exact: true });
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  await sales.focus();
  await page.keyboard.press('Space');
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.sidebar-section-toggle[aria-expanded="true"]')).toHaveCount(1);
  await expect(menu.getByRole('link', { name: 'Каналы продаж', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link', { name: 'Объект', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link', { name: 'Каналы продаж', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/channels$/);
  await expect(menu).not.toBeVisible();
  // открыли снова: раздел текущей страницы раскрыт сам, пункт помечен
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Каналы продаж');
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
});

test('меню телефона: вложенные адреса подсвечивают свой пункт, «Каталог» в «Услугах»', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/hotel-settings/services');
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Навигация', exact: true });
  await expect(menu.getByRole('button', { name: 'Настройки', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Объект');
  // номерной фонд гостиницы это «Каталог» раздела «Услуги» (одно меню у всех направлений, 17.10.2026)
  await menu.getByRole('button', { name: 'Услуги', exact: true }).click();
  await menu.getByRole('link', { name: 'Каталог', exact: true }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(
    page
      .getByRole('main')
      .filter({ visible: true })
      .getByRole('heading', { level: 1 })
      .filter({ visible: true }),
  ).toHaveText('Номерной фонд');
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Каталог');
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
});

test('все пункты меню открывают существующие страницы', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  const menu = sideNav(page);
  for (const section of SECTIONS) {
    const items = await openSection(page, section);
    const count = await items.locator('a').count();
    for (let j = 0; j < count; j++) {
      // панель раздела: подразделы справа (ADR-161); после перехода панель закрыта, открываем снова
      const link = (await openSection(page, section)).locator('a').nth(j);
      const href = await link.getAttribute('href');
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(
        page
          .getByRole('main')
          .filter({ visible: true })
          .getByRole('heading', { level: 1 })
          .filter({ visible: true }),
      ).toHaveCount(1);
      await expect(
        page
          .getByRole('main')
          .filter({ visible: true })
          .getByRole('heading', { level: 1 })
          .filter({ visible: true }),
      ).toBeVisible();
      await expect(page.getByRole('main').filter({ visible: true })).not.toContainText(
        'Не удалось загрузить данные',
      );
      await expect(menu.locator('.sidenav__items [aria-current="page"]')).toHaveCount(1);
      await expect(menu.locator(`.sidenav__items a[href="${href}"]`)).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`меню телефона и планшета ровное и доступное: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync('reports/navigation-2026-09-20', { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    await page.goto('/finance');
    for (const width of [320, 390, 768, 960]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator('.sidenav')).toBeHidden();
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Навигация', exact: true });
      const groups = menu.locator('.sidebar-section-toggle');
      await expect(groups).toHaveCount(SECTIONS.length);
      const boxes = await groups.evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { x: box.x, width: box.width, height: box.height };
        }),
      );
      expect(new Set(boxes.map((box) => box.x)).size).toBe(1);
      expect(new Set(boxes.map((box) => box.width)).size).toBe(1);
      for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390) {
        const audit = await new AxeBuilder({ page })
          .include('.mobile-navigation')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(audit.violations).toEqual([]);
        await menu.screenshot({ path: `reports/navigation-2026-09-20/menu-${theme}-${width}.png` });
      }
      await menu.getByRole('button', { name: 'Настройки', exact: true }).click();
      await menu.getByRole('link', { name: 'Подключения', exact: true }).scrollIntoViewIfNeeded();
      const close = menu.getByRole('button', { name: 'Закрыть: Навигация', exact: true });
      const rect = await close.boundingBox();
      expect(rect!.y).toBeGreaterThanOrEqual(0);
      expect(rect!.y + rect!.height).toBeLessThan(844);
      expect(
        await menu.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
      ).toBe(true);
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeFocused();
    }
    expect(errors).toEqual([]);
  });
}

// «Гости и бронирования» (09.10.2026) в разделе «Клиенты»; список броней его пункт «Записи» (17.10.2026)
test('«Гости и бронирования»: одна вкладка меню, список броней её пунктом', async ({
  page,
}) => {
  await page.goto('/guests');
  const main = page.getByRole('main');
  // подразделы левого меню (ADR-161): каждый адрес один раз, текущий помечен
  const menu = page.locator('.sidenav__nav');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Клиенты');
  // вкладки раздела «Клиенты | Записи», как у салона (эталон 25.10.2026), вместо кнопок «Список броней» и «Гости»
  const tabs = main.getByRole('navigation', { name: 'Клиенты и записи' });
  await expect(tabs.getByRole('link', { name: 'Клиенты', exact: true })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('link', { name: 'Записи', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations$/);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Записи');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Записи');
  await expect(tabs.getByRole('link', { name: 'Записи', exact: true })).toHaveAttribute('aria-current', 'page');
  // обратно той же полосой вкладок
  await tabs.getByRole('link', { name: 'Клиенты', exact: true }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Клиенты');
});
