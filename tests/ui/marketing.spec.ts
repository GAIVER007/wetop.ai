import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * MKT2 (ADR-149, plans/mkt2-marketing-hub-2026-10-06.md): хаб «Маркетинг» и совместимость с сайтом. Группа меню
 * «Маркетинг» отдельно от «Продаж», первый пункт «Сайт и SEO» ведёт в хаб `/marketing`; карточка «Сайт и SEO»
 * открывает существующий `/website`, адреса `/website/*` не менялись и подсвечивают «Маркетинг». Будущие продукты
 * статичны: без ссылок, данных и чисел. Хаб ничего не спрашивает у API, кроме общих запросов оболочки.
 */
const fixture = FIXTURE_API;
const SHOTS = 'reports/mkt2-marketing-hub-2026-10-06';
const WEBSITE = ['/website', '/website/booking', '/website/analytics', '/website/settings'];
/** Запросы оболочки на любом экране (`requests.spec.ts`): свежесть Channex, кто вошёл, настройки объекта для шапки */
const SHELL = new Set(['/system/freshness', '/auth/me', '/hotel/settings']);

const menuOf = (page: Page) =>
  page.locator('.workspace-header').getByRole('navigation', { name: 'Разделы' });
const main = (page: Page) => page.getByRole('main').filter({ visible: true });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('меню: «Маркетинг» своя группа, в «Продажах» сайта нет, клавиатура как у других групп', async ({
  page,
}) => {
  await page.goto('/today');
  const menu = menuOf(page);
  const marketing = menu.getByRole('button', { name: 'Маркетинг', exact: true });
  await expect(marketing).toHaveAttribute('aria-expanded', 'false');
  await expect(async () => {
    await marketing.focus();
    await page.keyboard.press('Enter');
    await expect(marketing).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const item = menu.getByRole('link', { name: 'Сайт и SEO', exact: true });
  await expect(item).toBeVisible();
  await expect(item).toHaveAttribute('href', '/marketing');
  // Escape закрывает список и возвращает фокус на вкладку
  await page.keyboard.press('Escape');
  await expect(marketing).toHaveAttribute('aria-expanded', 'false');
  await expect(marketing).toBeFocused();
  // Space открывает, Tab ведёт в пункт, Enter переходит
  await page.keyboard.press('Space');
  await expect(marketing).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(item).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/marketing$/);
  await expect(marketing).toHaveClass(/has-current-page/);
  await expect(menu.locator('[aria-current="page"]')).toHaveText('Сайт и SEO');
  // «Продажи» без сайта
  const sales = menu.getByRole('button', { name: 'Продажи', exact: true });
  await sales.click();
  const salesList = menu.locator(`#${await sales.getAttribute('aria-controls')}`);
  await expect(salesList.locator('a')).toHaveText(['Загрузка конкурентов', 'Каналы продаж', 'ИИ-продавцы']);
  await expect(menu.getByRole('link', { name: 'Сайт и онлайн-бронирование' })).toHaveCount(0);
});

test('/website/* подсвечивает «Маркетинг», а не «Продажи»; страница сайта знает, что она в «Маркетинге»', async ({
  page,
}) => {
  for (const path of WEBSITE) {
    await page.goto(path);
    const menu = menuOf(page);
    await expect(menu.getByRole('button', { name: 'Маркетинг', exact: true })).toHaveClass(
      /has-current-page/,
    );
    await expect(menu.getByRole('button', { name: 'Продажи', exact: true })).not.toHaveClass(
      /has-current-page/,
    );
    await expect(menu.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(menu.locator('[aria-current="page"]')).toHaveText('Сайт и SEO');
    // заголовок сайта прежний, над ним ссылка в хаб тем же приёмом, что у «Каналов продаж»
    await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(
      'Сайт и онлайн-бронирование',
    );
    await expect(main(page).locator('.page__crumbs').getByRole('link')).toHaveAttribute(
      'href',
      '/marketing',
    );
  }
});

test('хаб: карточка «Сайт и SEO» ведёт на /website, будущие продукты без ссылок, ни одного запроса данных', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/marketing');
  await page.waitForLoadState('networkidle');
  const hits = (await (await request.get(`${fixture}/__test/hits`)).json()) as {
    byPath: Record<string, number>;
  };
  const business = Object.keys(hits.byPath).filter((path) => !SHELL.has(path));
  expect(business, `хаб спросил данные: ${JSON.stringify(hits.byPath)}`).toEqual([]);

  const hub = main(page);
  await expect(hub.getByRole('heading', { level: 1 })).toHaveText('Маркетинг');
  await expect(hub.locator('.page__subtitle')).toHaveText(
    'Привлекайте гостей, развивайте сайт и управляйте продвижением из WETOP.',
  );
  const site = hub.getByTestId('marketing-site');
  await expect(site.getByRole('heading', { name: 'Сайт и SEO', exact: true })).toBeVisible();
  await expect(site.getByTestId('marketing-site-status')).toHaveText('Доступно');
  await expect(site).toContainText('ИИ-конструктор: скоро');
  // «скоро» не кнопка: в карточке ровно одна ссылка, и это «Открыть»
  await expect(site.getByRole('link')).toHaveCount(1);
  await expect(site.getByRole('button')).toHaveCount(0);

  const soon = hub.getByTestId('marketing-soon');
  await expect(soon.getByRole('heading', { level: 2 })).toHaveText('Скоро');
  const cards = soon.getByTestId('marketing-soon-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.getByRole('heading', { level: 3 })).toHaveText(['Реклама', 'Контент', 'Репутация']);
  for (let i = 0; i < 3; i++) await expect(cards.nth(i).getByText('Скоро', { exact: true })).toBeVisible();
  // никаких рабочих ссылок, кнопок и чисел у будущих продуктов
  await expect(soon.locator('a, button, [tabindex]')).toHaveCount(0);
  await expect(soon).not.toContainText(/\d/);

  await site.getByRole('link', { name: 'Открыть', exact: true }).click();
  await expect(page).toHaveURL(/\/website$/);
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText(
    'Сайт и онлайн-бронирование',
  );
  await expect(
    menuOf(page).getByRole('button', { name: 'Маркетинг', exact: true }),
  ).toHaveClass(/has-current-page/);
});

test('администратор (без права settings): вкладки «Маркетинг» нет, прямой адрес не открывает хаб', async ({
  page,
  request,
}) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${fixture}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/today');
  const menu = menuOf(page);
  await expect(menu.getByRole('button', { name: 'Продажи', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Маркетинг', exact: true })).toHaveCount(0);
  for (const path of ['/marketing', '/website']) {
    await page.goto(path);
    await expect(main(page).getByTestId('no-access')).toBeVisible();
    await expect(main(page).getByTestId('marketing-site')).toHaveCount(0);
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`хаб на компьютере и телефоне, доступность: ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    mkdirSync(SHOTS, { recursive: true });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (!devNoise.test(error.message)) errors.push(error.message);
    });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/marketing');
      await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Маркетинг');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      // кнопка «Открыть»: цель нажатия не меньше 44 px (DESIGN.md §11)
      const open = await main(page)
        .getByRole('link', { name: 'Открыть', exact: true })
        .boundingBox();
      expect(open!.height).toBeGreaterThanOrEqual(width === 390 ? 44 : 32);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/hub-${theme}-${width}.png`, fullPage: true });
    }
    // телефон: тот же раздел в выдвижном меню, цели не ниже 44 px
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: 'Навигация', exact: true });
    const group = drawer.getByRole('button', { name: 'Маркетинг', exact: true });
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    const item = drawer.getByRole('link', { name: 'Сайт и SEO', exact: true });
    await expect(item).toHaveAttribute('aria-current', 'page');
    for (const target of [group, item])
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${SHOTS}/drawer-${theme}-390.png` });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}

test('MKT3: хаб «Маркетинг» только для гостиницы, салон уводится в свой календарь', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const body = main(page);
  await body.locator('summary').filter({ hasText: 'Добавить филиал' }).click();
  await body.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await body.getByLabel('Название филиала').fill('Студия MKT3');
  await body.getByRole('button', { name: 'Добавить филиал', exact: true }).click();
  await expect(body.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main(page)
    .locator('.branches-grid section')
    .filter({ hasText: 'Студия MKT3' })
    .getByRole('button', { name: 'Открыть салон', exact: true })
    .click();
  await page.waitForURL('**/calendar');
  await page.goto('/marketing');
  await expect(page).toHaveURL(/\/calendar$/);
});
