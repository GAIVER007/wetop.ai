import { FIXTURE_API, expect, test, devNoise } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

// Контракт меню: основные разделы доступны ровно по разу, настройки объекта — во внутренних вкладках.
// «ИИ-агенты» в «Продажах» всегда, доступ проверяет сам раздел (ADR-090); «Платформа» — только по
// отметке главного администратора (ADR-083, tests/ui/platform-access.spec.ts).
// С 02.10.2026 (ADR-134) на компьютере разделы стоят строкой вкладок в шапке (tests/ui/top-menu.spec.ts),
// здесь: меню телефона и планшета «Навигация» из того же реестра и обход всех пунктов по страницам.
const routes = [
  '/ai-agents',
  '/chessboard',
  // «Гости и бронирования» с 09.10.2026: один пункт на месте «Броней» и «Гостей», список броней открывается кнопкой
  '/guests',
  '/inventory',
  '/market',
  '/channels',
  // MKT2: вход в сайт через хаб «Маркетинг» (ADR-149)
  '/marketing',
  // «Показатели за период» (A1) с AN2 перенаправляют на «Аналитику → Обзор» (ADR-114): в меню их нет
  '/reports',
  '/finance',
  '/bar',
  '/management/analytics',
  '/hotel-settings',
  // «Сотрудники» — видимый раздел команды (TEAM1, план settings-hub-2026-10-02)
  '/team',
  '/connections',
  '/journal',
  '/incidents',
];

// «Финансы» первой вкладкой: единый раздел вместо Главной (plans/finance-home-merge-2026-10-09.md)
const SECTIONS = [
  'Финансы',
  'Календарь',
  'Гости и бронирования',
  'Бар',
  'Продажи',
  'Маркетинг',
  'Отчёты',
  'Номерной фонд',
  'Настройки',
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
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Финансы');
  // «Календарь» больше не спрятан в группе: прямая ссылка с подписью
  const board = menu.getByRole('link', { name: 'Календарь', exact: true });
  await expect(board.locator('span')).toBeVisible();
  await board.click();
  await expect(page).toHaveURL(/\/chessboard$/);
  await expect(menu).not.toBeVisible();
  // группа: раскрывается с клавиатуры, открыт один раздел
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  const sales = menu.getByRole('button', { name: 'Продажи', exact: true });
  await expect(sales).toHaveAttribute('aria-expanded', 'false');
  await sales.focus();
  await page.keyboard.press('Space');
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('.sidebar-section-toggle[aria-expanded="true"]')).toHaveCount(1);
  await expect(menu.getByRole('link', { name: 'Загрузка конкурентов', exact: true })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('link', { name: 'Загрузка конкурентов', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/market$/);
  await expect(menu).not.toBeVisible();
  // открыли снова: раздел текущей страницы раскрыт сам, пункт помечен
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(sales).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Загрузка конкурентов');
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
});

test('меню телефона: вложенные адреса подсвечивают свой пункт, прямая ссылка «Номерной фонд»', async ({
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
  // «Номерной фонд» — прямая ссылка без раскрывашки (ADR-108): один пункт вместо трёх
  await menu.getByRole('link', { name: 'Номерной фонд', exact: true }).click();
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(
    page
      .getByRole('main')
      .filter({ visible: true })
      .getByRole('heading', { level: 1 })
      .filter({ visible: true }),
  ).toHaveText('Номерной фонд');
  await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Номерной фонд');
  await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
});

test('все пункты меню открывают существующие страницы', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/finance');
  const menu = page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
  const tabs = menu.locator('.topmenu__tabs > *');
  for (let i = 0; i < (await tabs.count()); i++) {
    const tab = tabs.nth(i);
    const toggle = tab.getByRole('button');
    // раздел из одного пункта — сама вкладка и есть ссылка; группа — список под вкладкой
    const grouped = (await toggle.count()) > 0;
    const links = grouped ? tab.locator('a') : tab;
    for (let j = 0; j < (await links.count()); j++) {
      const link = links.nth(j);
      const href = await link.getAttribute('href');
      if (grouped) {
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      }
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
      await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(link).toHaveAttribute('aria-current', 'page');
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
      await expect(page.locator('.topmenu')).toBeHidden();
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

// «Гости и бронирования» (поручение владельца 09.10.2026): в шапке один пункт, классический список броней
// открывается кнопкой на экране и оставляет подсвеченным тот же пункт.
test('«Гости и бронирования»: один пункт меню, список броней под той же вкладкой', async ({
  page,
}) => {
  await page.goto('/guests');
  const main = page.getByRole('main');
  const menu = page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Гости и бронирования');
  await main.getByRole('link', { name: 'Список броней', exact: true }).click();
  await expect(page).toHaveURL(/\/reservations$/);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Брони');
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Гости и бронирования');
  // обратно: кнопка на списке броней ведёт на экран гостей
  await main.getByRole('link', { name: 'Гости', exact: true }).click();
  await expect(page).toHaveURL(/\/guests$/);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Гости и бронирования');
});
