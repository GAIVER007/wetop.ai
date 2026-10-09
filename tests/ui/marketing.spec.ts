import { FIXTURE_API, expect, test, devNoise, type Page } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

/**
 * MKT2 (ADR-149, plans/mkt2-marketing-hub-2026-10-06.md): хаб «Маркетинг» и совместимость с сайтом. Группа меню
 * «Маркетинг» отдельно от «Продаж», первый пункт «Сайт и SEO» ведёт в хаб `/marketing`; карточка «Сайт и SEO»
 * главной кнопкой открывает конструктор сайта (MKT9.2), `/website` осталось вторичной ссылкой, адреса `/website/*` не менялись и подсвечивают «Маркетинг». Будущие продукты
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
  await expect(salesList.locator('a')).toHaveText(['Анализ конкурентов', 'Каналы продаж', 'ИИ-продавцы']);
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

test('хаб Marketing 2.0: три модуля с кнопкой «Открыть», у «Сайта и SEO» конструктор и меню действий, реклама и контент «Скоро», результаты без выдуманных чисел, ни одного запроса данных', async ({
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
    'Привлекайте гостей, автоматизируйте рекламу и развивайте бренд с помощью ИИ.',
  );
  // три модуля одного вида, по порядку
  const modules = hub.getByTestId('marketing-module');
  await expect(modules).toHaveCount(3);
  await expect(modules.getByRole('heading', { level: 2 })).toHaveText(['Сайт и SEO', 'Реклама', 'Контент']);

  // «Сайт и SEO»: рабочий модуль, главная кнопка ведёт в конструктор, остальное в меню «⋯»
  const site = hub.getByTestId('marketing-site');
  await expect(site.getByTestId('marketing-site-status')).toHaveText('Доступно');
  await expect(site.getByRole('listitem')).toHaveText(['ИИ-конструктор сайта', 'Онлайн-бронирование', 'SEO-оптимизация']);
  const builder = site.getByRole('link', { name: 'Открыть: Сайт и SEO', exact: true });
  await expect(builder).toHaveAttribute('href', '/marketing/site/editor');
  await expect(builder).toHaveClass(/^btn$/);
  const more = site.getByRole('button', { name: 'Ещё действия: Сайт и SEO', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  const menu = site.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Публикация', 'Изображения', 'Бронирование и аналитика']);
  await expect(menu.getByRole('menuitem', { name: 'Публикация' })).toHaveAttribute('href', '/marketing/site');
  await expect(menu.getByRole('menuitem', { name: 'Изображения' })).toHaveAttribute('href', '/marketing/site/assets');
  await expect(menu.getByRole('menuitem', { name: 'Бронирование и аналитика' })).toHaveAttribute('href', '/website');
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();

  // реклама и контент ещё не построены: «Скоро», одна кнопка «Открыть» на свой экран, без «Подключено» и меню
  for (const [testId, title, href] of [
    ['marketing-ads', 'Реклама', '/marketing/ads'],
    ['marketing-content', 'Контент', '/marketing/content'],
  ] as const) {
    const card = hub.getByTestId(testId);
    await expect(card.getByTestId(`${testId}-status`)).toHaveText('Скоро');
    await expect(card.locator('a, button')).toHaveCount(1);
    await expect(card.getByRole('link', { name: `Открыть: ${title}`, exact: true })).toHaveAttribute('href', href);
    await expect(card).not.toContainText('Подключено');
    await expect(card.getByRole('listitem')).toHaveCount(3);
  }
  // подсказка справа ведёт к сайту, а не «подключает всё»
  await expect(hub.getByRole('link', { name: 'Начать с сайта', exact: true })).toHaveAttribute(
    'href',
    '/marketing/site/editor',
  );

  // результаты: источник есть только у сайта, и хаб его не читает; вместо нулей «Нет данных» с причиной
  const results = hub.getByTestId('marketing-results');
  await expect(results.getByRole('heading', { level: 2 })).toHaveText('Результаты за 30 дней');
  const rows = results.getByTestId('marketing-result');
  await expect(rows).toHaveCount(4);
  await expect(rows.locator('dt')).toHaveText(['Переходы на сайт', 'Заявки на бронирование', 'Потрачено на рекламу', 'Доход с рекламы']);
  await expect(rows.locator('dd')).toHaveText(Array(4).fill('Нет данных'));
  await expect(results.locator('dl')).not.toContainText(/\d/);
  await expect(results.getByRole('link', { name: 'Аналитика сайта', exact: true })).toHaveAttribute('href', '/website/analytics');

  // вторичный путь в прежний раздел сайта работает и подсвечивает «Маркетинг»
  await more.click();
  await menu.getByRole('menuitem', { name: 'Бронирование и аналитика' }).click();
  await expect(page).toHaveURL(/\/website$/);
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Сайт и онлайн-бронирование');
  await expect(menuOf(page).getByRole('button', { name: 'Маркетинг', exact: true })).toHaveClass(/has-current-page/);
});

test('экраны «Реклама» и «Контент»: вкладки как в макете, пустые состояния, кнопки неактивны, ни чисел, ни запросов данных', async ({
  page,
  request,
}) => {
  await page.goto('/marketing');
  await main(page).getByRole('link', { name: 'Открыть: Реклама', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing\/ads$/);
  const ads = main(page);
  await expect(ads.getByRole('heading', { level: 1 })).toHaveText('Реклама');
  await expect(menuOf(page).getByRole('button', { name: 'Маркетинг', exact: true })).toHaveClass(/has-current-page/);
  await expect(ads.getByTestId('marketing-ads-soon')).toContainText('Скоро');
  await expect(ads.getByRole('tab')).toHaveText(['Кампании', 'Аудитории', 'Креативы', 'Аналитика', 'Настройки']);
  const metrics = ads.getByTestId('marketing-ads-metrics');
  await expect(metrics.locator('.stat__label')).toHaveText(['Потрачено', 'Заявки', 'Стоимость заявки', 'Доход с рекламы']);
  await expect(metrics.locator('.stat__value')).toHaveText(Array(4).fill('Нет данных'));
  await expect(metrics).not.toContainText(/\d/);
  await expect(ads.getByTestId('marketing-ads-campaigns').locator('tbody')).toContainText('Кампаний пока нет');
  for (const name of ['Подключить кабинет', 'Создать кампанию']) {
    const button = ads.getByRole('button', { name, exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-describedby', 'marketing-ads-soon');
  }
  await ads.getByRole('tab', { name: 'Аудитории', exact: true }).click();
  await expect(ads.getByRole('tabpanel')).toContainText('Пока пусто');
  await ads.getByRole('link', { name: 'Назад к модулям', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing$/);

  await main(page).getByRole('link', { name: 'Открыть: Контент', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing\/content$/);
  const content = main(page);
  await expect(content.getByRole('heading', { level: 1 })).toHaveText('Контент');
  await expect(content.getByRole('tab')).toHaveText(['Идеи', 'Генерация', 'Медиатека', 'План публикаций', 'Статистика']);
  await expect(content.getByRole('button', { name: 'Создать контент', exact: true })).toBeDisabled();
  const formats = content.getByTestId('marketing-content-formats').getByRole('listitem');
  await expect(formats).toHaveCount(8);
  await expect(formats.first()).toContainText('Создать с ИИ');
  const week = content.getByTestId('marketing-content-week').getByRole('listitem');
  await expect(week).toHaveCount(7);
  await expect(week).toContainText(Array(7).fill('Пусто'));
  // медиатека живая: ведёт в изображения сайта (MKT8)
  await content.getByRole('tab', { name: 'Медиатека', exact: true }).click();
  await expect(content.getByRole('link', { name: 'Открыть изображения', exact: true })).toHaveAttribute(
    'href',
    '/marketing/site/assets',
  );

  // ни один экран не спрашивает данных, кроме запросов оболочки
  await request.post(`${fixture}/__test/reset`);
  for (const path of ['/marketing/ads', '/marketing/content']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  const hits = (await (await request.get(`${fixture}/__test/hits`)).json()) as {
    byPath: Record<string, number>;
  };
  expect(Object.keys(hits.byPath).filter((path) => !SHELL.has(path))).toEqual([]);
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
  for (const path of ['/marketing', '/website', '/marketing/ads', '/marketing/content']) {
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
      // главная кнопка сайта: цель нажатия не меньше 44 px (DESIGN.md §11)
      const open = await main(page)
        .getByRole('link', { name: 'Открыть: Сайт и SEO', exact: true })
        .boundingBox();
      expect(open!.height).toBeGreaterThanOrEqual(width === 390 ? 44 : 32);
      const audit = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: `${SHOTS}/hub-${theme}-${width}.png`, fullPage: true });
      // экраны рекламы и контента: без горизонтальной прокрутки и нарушений доступности
      for (const screen of ['ads', 'content'] as const) {
        await page.goto(`/marketing/${screen}`);
        await expect(main(page).getByTestId(`marketing-${screen}-screen`)).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        const screenAudit = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(screenAudit.violations).toEqual([]);
        await page.screenshot({ path: `${SHOTS}/${screen}-${theme}-${width}.png`, fullPage: true });
      }
      await page.goto('/marketing');
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

test('MKT3: хаб «Маркетинг» только для гостиницы, салон уводится на свой «Сегодня»', async ({ page }) => {
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
  // MV8: стартовая страница всех направлений `/today`
  await page.waitForURL('**/today');
  await page.goto('/marketing');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByTestId('beauty-today')).toBeVisible();
});
