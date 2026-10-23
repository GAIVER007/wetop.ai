import { FIXTURE_API, expect, test, devNoise, type Page, sideNav, openSection } from './fixtures';
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

const menuOf = (page: Page) => sideNav(page);
const main = (page: Page) => page.getByRole('main').filter({ visible: true });

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`);
});

test('меню: «Маркетинг» своя группа, в «Продажах» сайта нет, клавиатура как у других групп', async ({
  page,
}) => {
  // клавиатура панели кнопки ☰: она живёт до 1280 px (решение владельца 18.10.2026)
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/finance');
  const menu = menuOf(page);
  const trigger = menu.locator('.sidenav__current');
  // левое меню (ADR-161): ↓ открывает панель на текущем разделе, «Продвижение» пятый
  await expect(async () => {
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await expect(menu.locator('.sidenav__section', { hasText: /^Продвижение$/ })).toBeFocused();
  // МКТ-В1/В2: в группе три пункта, поэтому → уводит фокус в подразделы, как у остальных групп меню
  await page.keyboard.press('ArrowRight');
  const item = menu.locator('.sidenav__section', { hasText: /^Продвижение$/ });
  const items = menu.locator('.sidenav__items');
  const siteLink = items.getByRole('link', { name: 'Обзор', exact: true });
  await expect(item).toHaveAttribute('aria-expanded', 'true');
  await expect(siteLink).toBeFocused();
  await expect(siteLink).toHaveAttribute('href', '/marketing');
  // ADR-184 и верхнее меню 17.10.2026: «Продвижение» вместе с бывшими «Продажами»
  await expect(menu.locator('.sidenav__items:not([hidden]) a')).toHaveText([
    'Обзор',
    'Реклама',
    'Контент',
    'ИИ-продавец',
    'Анализ конкурентов',
    'Обзор продаж',
    'Бюджет',
    'Аналитика маркетинга',
  ]);
  await expect(items.getByRole('link', { name: 'Бюджет', exact: true })).toHaveAttribute(
    'href',
    '/marketing/budget',
  );
  await expect(items.getByRole('link', { name: 'Аналитика маркетинга', exact: true })).toHaveAttribute(
    'href',
    '/marketing/analytics',
  );
  // Escape закрывает панель и возвращает фокус на кнопку
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  // Группа открывает подраздел с клавиатуры.
  await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect(siteLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/marketing$/);
  await expect(trigger).toHaveText('Продвижение');
  await expect(menu.locator('.sidenav__items [aria-current="page"]')).toHaveText('Обзор');
  // отдельных «Продаж» нет, сайт пунктом меню не стоит
  await expect(menu.locator('.sidenav__section', { hasText: /^Продажи$/ })).toHaveCount(0);
  await expect(
    menu.getByRole('link', { name: 'Сайт и онлайн-бронирование', includeHidden: true }),
  ).toHaveCount(0);
});

test('/website/* подсвечивает «Маркетинг», а не «Продажи»; страница сайта знает, что она в «Маркетинге»', async ({
  page,
}) => {
  for (const path of WEBSITE) {
    await page.goto(path);
    const menu = menuOf(page);
    await expect(menu.locator('.sidenav__current')).toHaveText('Продвижение');
    await expect(menu.locator('.sidenav__items [aria-current="page"]')).toHaveCount(1);
    await expect(menu.locator('.sidenav__items [aria-current="page"]')).toHaveText('Обзор');
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

test('хаб Marketing 2.0: четыре модуля с кнопкой «Открыть», живые «Сайт и SEO» и «Бюджет», живые реклама и контент, из данных только бюджет месяца', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/marketing');
  await page.waitForLoadState('networkidle');
  const hits = (await (await request.get(`${fixture}/__test/hits`)).json()) as {
    byPath: Record<string, number>;
  };
  // единая система (14.10.2026): хаб читает один источник, бюджет филиала за месяц («Потрачено на рекламу»)
  const business = Object.keys(hits.byPath).filter((path) => !SHELL.has(path));
  expect(business, `хаб спросил данные: ${JSON.stringify(hits.byPath)}`).toEqual(['/marketing/budget']);

  const hub = main(page);
  await expect(hub.getByRole('heading', { level: 1 })).toHaveText('Продвижение');
  await expect(hub.locator('.page__subtitle')).toHaveText(
    'Привлекайте гостей, ведите рекламный бюджет и развивайте бренд гостиницы с помощью ИИ.',
  );
  // пять модулей одного вида, по порядку (ADR-184: «Конкуренты» в «Продвижении»)
  const modules = hub.getByTestId('marketing-module');
  await expect(modules).toHaveCount(5);
  await expect(modules.getByRole('heading', { level: 2 })).toHaveText(['Сайт и SEO', 'Бюджет', 'Реклама', 'Конкуренты', 'Контент']);
  const competitors = hub.getByTestId('marketing-competitors');
  await expect(competitors.getByTestId('marketing-competitors-status')).toHaveText('Доступно');
  await expect(competitors.getByRole('link', { name: 'Открыть: Конкуренты', exact: true })).toHaveAttribute('href', '/market');

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

  // «Бюджет»: живой модуль учёта расходов, главная кнопка в раздел, в меню «⋯» журнал и аналитика
  const budget = hub.getByTestId('marketing-budget');
  await expect(budget.getByTestId('marketing-budget-status')).toHaveText('Доступно');
  await expect(budget.getByRole('link', { name: 'Открыть: Бюджет', exact: true })).toHaveAttribute(
    'href',
    '/marketing/budget',
  );
  const budgetMore = budget.getByRole('button', { name: 'Ещё действия: Бюджет', exact: true });
  await budgetMore.click();
  const budgetMenu = budget.getByRole('menu');
  await expect(budgetMenu.getByRole('menuitem')).toHaveText(['Расходы', 'Аналитика маркетинга']);
  await page.keyboard.press('Escape');

  // реклама (кампании, кабинет Meta) и контент (черновики постов) живые: одна кнопка «Открыть» на свой экран, без меню
  // (аудит 21.10.2026 п. 5: «Скоро» рядом с живой кнопкой у рекламы сбивал с толку)
  for (const [testId, title, href, status] of [
    ['marketing-ads', 'Реклама', '/marketing/ads', 'Доступно'],
    ['marketing-content', 'Контент', '/marketing/content', 'Доступно'],
  ] as const) {
    const card = hub.getByTestId(testId);
    await expect(card.getByTestId(`${testId}-status`)).toHaveText(status);
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

  // результаты: расход из бюджета месяца (пустой бюджет это 0 ₸), остальное без источника: «Нет данных»
  const results = hub.getByTestId('marketing-results');
  await expect(results.getByRole('heading', { level: 2 })).toHaveText(/^Результаты за [а-я]+$/);
  const rows = results.getByTestId('marketing-result');
  await expect(rows).toHaveCount(4);
  await expect(rows.locator('dt')).toHaveText(['Переходы на сайт', 'Заявки на бронирование', 'Потрачено на рекламу', 'Доход с рекламы']);
  await expect(rows.locator('dd')).toHaveText(['Нет данных', 'Нет данных', /^0\s₸$/, 'Нет данных']);
  await expect(results.getByRole('link', { name: 'Аналитика сайта', exact: true })).toHaveAttribute('href', '/website/analytics');

  // вторичный путь в прежний раздел сайта работает и подсвечивает «Маркетинг»
  await more.click();
  await menu.getByRole('menuitem', { name: 'Бронирование и аналитика' }).click();
  await expect(page).toHaveURL(/\/website$/);
  await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Сайт и онлайн-бронирование');
  await expect(menuOf(page).locator('.sidenav__current')).toHaveText('Продвижение');
});

test('экраны «Реклама» и «Контент»: вкладки как в макете; кампании живые (ADR-MKT-B3), кабинет и контент пока пустые', async ({
  page,
  request,
}) => {
  await page.goto('/marketing');
  await main(page).getByRole('link', { name: 'Открыть: Реклама', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing\/ads$/);
  const ads = main(page);
  // аудит 21.10.2026 пп. 14, 15, 34: одно имя «Реклама», пустых вкладок нет, итоги строкой вместо плиток
  await expect(ads.getByRole('heading', { level: 1 })).toHaveText('Реклама');
  await expect(menuOf(page).locator('.sidenav__current')).toHaveText('Продвижение');
  await expect(ads.getByTestId('marketing-ads-soon')).toContainText('Скоро');
  await expect(ads.getByRole('tab')).toHaveCount(0);
  const metrics = ads.getByTestId('marketing-ads-metrics');
  await expect(metrics.locator('dt')).toHaveText(['Расход кампаний', 'Показы', 'Клики', 'Лиды площадки', 'CTR, CPM, CPL']);
  await expect(ads.getByTestId('ads-empty')).toContainText('Кампаний пока нет');
  // кабинет Meta подключается (ADR-MKT-META), кампанию можно создать и вручную (МКТ-В3)
  await expect(ads.getByRole('button', { name: 'Подключить кабинет через Facebook', exact: true })).toBeEnabled();
  await expect(ads.getByRole('button', { name: 'Создать кампанию', exact: true })).toBeEnabled();
  await ads.getByRole('link', { name: 'Назад к модулям', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing$/);

  await main(page).getByRole('link', { name: 'Открыть: Контент', exact: true }).click();
  await expect(page).toHaveURL(/\/marketing\/content$/);
  const content = main(page);
  await expect(content.getByRole('heading', { level: 1 })).toHaveText('Контент');
  // CONTENT-DRAFTS-20261022: живой экран, первым «Создать пост»; заглушек «Скоро» и пустой «Статистики» нет
  await expect(content.getByRole('tab')).toHaveText(['Создать пост', 'План публикаций', 'Идеи', 'Медиатека']);
  await expect(content.getByTestId('marketing-content-soon')).toHaveCount(0);
  await expect(content.getByRole('button', { name: 'Написать с ИИ', exact: true })).toBeDisabled();
  await expect(content.getByRole('button', { name: 'Написать самому', exact: true })).toBeEnabled();
  // медиатека живая: ведёт в изображения сайта (MKT8)
  await content.getByRole('tab', { name: 'Медиатека', exact: true }).click();
  await expect(content.getByRole('link', { name: 'Открыть изображения', exact: true })).toHaveAttribute(
    'href',
    '/marketing/site/assets',
  );

  // «Контент» читает только неделю черновиков; «Реклама» спрашивает кампании и последние запуски ИИ-таргетолога
  await request.post(`${fixture}/__test/reset`);
  for (const path of ['/marketing/ads', '/marketing/content']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  const hits = (await (await request.get(`${fixture}/__test/hits`)).json()) as {
    byPath: Record<string, number>;
  };
  expect(Object.keys(hits.byPath).filter((path) => !SHELL.has(path)).sort()).toEqual([
    '/marketing/ad-connections/meta',
    '/marketing/ads/launches',
    '/marketing/campaigns',
    '/marketing/content/drafts',
  ]);
});

test('контент: ИИ пишет два варианта, лишние цифры подсвечены, черновик встаёт на день и переживает перезагрузку', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/reset`);
  await page.goto('/marketing/content');
  const content = main(page);
  await content.getByRole('textbox', { name: /^Тема/ }).fill('Осенний уход за волосами');
  await content.getByRole('button', { name: 'Написать с ИИ', exact: true }).click();
  const variants = content.getByTestId('content-variants').getByRole('listitem');
  await expect(variants).toHaveCount(2);
  await expect(variants.first()).toContainText('Вариант A');
  // цифра 30% не из карточки: предупреждение; ссылку брони подставил WETOP, а не модель
  await expect(variants.first()).toContainText('Проверьте цифры: 30%');
  await expect(variants.first()).toContainText('Записаться онлайн: https://salon.example');
  await page.screenshot({ path: `${SHOTS}/content-variants-light-1440.png`, fullPage: true });
  await variants.first().getByRole('button', { name: 'Взять этот', exact: true }).click();
  const editor = content.getByTestId('content-editor');
  await expect(editor.getByTestId('content-warnings')).toContainText('30%');
  await editor.getByRole('textbox', { name: /^Текст поста/ }).fill('Осень, время ухода. Запишитесь на стрижку.');
  await editor.getByRole('combobox', { name: /^День публикации/ }).selectOption({ index: 2 });
  await editor.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  await expect(content.getByTestId('content-saved')).toBeVisible();

  await page.reload();
  await content.getByRole('tab', { name: 'План публикаций', exact: true }).click();
  const cards = content.getByTestId('content-plan').getByTestId('content-card');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Осень, время ухода. Запишитесь на стрижку.');
  await expect(cards.first()).toContainText('Instagram');
  await cards.first().getByRole('button', { name: 'Отметить опубликованным', exact: true }).click();
  await expect(cards.first()).toContainText('Опубликован');
  await page.screenshot({ path: `${SHOTS}/content-plan-light-1440.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${SHOTS}/content-plan-light-390.png`, fullPage: true });
});

test('контент: ИИ недоступен, пост пишется руками и сохраняется без дня', async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`);
  await request.post(`${fixture}/__test/content-ai`, { data: { down: true } });
  await page.goto('/marketing/content');
  const content = main(page);
  await content.getByRole('textbox', { name: /^Тема/ }).fill('Новая услуга');
  await content.getByRole('button', { name: 'Написать с ИИ', exact: true }).click();
  await expect(content.getByRole('alert')).toContainText('ИИ сейчас недоступен');
  await content.getByRole('button', { name: 'Написать самому', exact: true }).click();
  const editor = content.getByTestId('content-editor');
  await editor.getByRole('textbox', { name: /^Текст поста/ }).fill('У нас новая услуга. Приходите.');
  await editor.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  await expect(content.getByTestId('content-saved')).toBeVisible();
  await content.getByRole('tab', { name: 'План публикаций', exact: true }).click();
  await expect(content.getByRole('region', { name: 'Черновики без дня' }).getByTestId('content-card')).toHaveCount(1);
  await request.post(`${fixture}/__test/content-ai`, { data: { down: false } });
});

test('администратор (без права marketing): вкладки «Маркетинг» нет, прямой адрес не открывает хаб', async ({
  page,
  request,
}) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await request.post(`${fixture}/__test/control`, { data: { role: 'STAFF' } });
  await page.goto('/finance');
  const menu = menuOf(page);
  // верхнее меню 17.10.2026: в «Продвижении» администратору видны продавец, конкуренты (право `reports`) и обзор продаж
  await expect(menu.locator('.sidenav__section', { hasText: /^Продвижение$/ })).toHaveCount(1);
  const promo = await openSection(page, 'Продвижение');
  await expect(promo.locator('a')).toHaveText(['ИИ-продавец', 'Анализ конкурентов', 'Обзор продаж']);
  await page.keyboard.press('Escape');
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
      await expect(main(page).getByRole('heading', { level: 1 })).toHaveText('Продвижение');
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
    const group = drawer.getByRole('button', { name: 'Продвижение', exact: true });
    await expect(group).toHaveAttribute('aria-expanded', 'true');
    const item = drawer.getByRole('link', { name: 'Обзор', exact: true });
    await expect(item).toHaveAttribute('aria-current', 'page');
    for (const target of [group, item])
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${SHOTS}/drawer-${theme}-390.png` });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}

test('MKT3: салон видит маркетинг, гостиничный конструктор недоступен', async ({ page }) => {
  await page.goto('/auth/fallback');
  await page.getByLabel('Email', { exact: true }).fill('admin@wetop.test');
  await page.getByLabel('Пароль', { exact: true }).fill('ui-test-parol');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/today');
  await page.goto('/branches');
  const body = main(page);
  await body.getByRole('button', { name: 'Добавить', exact: true }).click();
  const creation = page.getByRole('dialog', { name: 'Добавить бизнес или филиал' });
  await creation.getByLabel('Новый бизнес или бренд').check();
  await creation.getByRole('radio', { name: 'Салон красоты или студия' }).check();
  await creation.getByLabel('Название бизнеса', { exact: true }).fill('Студия MKT3');
  await creation.getByRole('button', { name: /Создать бизнес/ }).click();
  await expect(creation.getByRole('status')).toContainText('Салон создан');
  await page.reload();
  await main(page).getByRole('button', { name: 'Открыть объект: Студия MKT3', exact: true }).click();
  // салон (BEAUTY) и после слияния 09.10 садится на свой `/today`; на `/finance` едет только гостиница
  await page.waitForURL('**/today');
  await expect(page.getByTestId('beauty-today')).toBeVisible();
  await page.goto('/marketing');
  await expect(page).toHaveURL(/\/marketing$/);
  const hub = main(page).getByTestId('business-marketing');
  await expect(hub).toBeVisible();
  // единая система (14.10.2026): бюджет ведётся по филиалу любого направления; SITE-1: «Сайт и SEO» открыт всем,
  // гостиничные экраны сайта (публикация, изображения, бронирование) салону не предлагаются
  // аудит 21.10.2026 п. 5: гостиничных «Конкурентов» у салона нет
  await expect(hub.getByTestId('marketing-module')).toHaveCount(4);
  await expect(hub.getByTestId('marketing-competitors')).toHaveCount(0);
  await expect(hub.getByTestId('marketing-site-status')).toHaveText('Доступно');
  await expect(hub.getByTestId('marketing-budget-status')).toHaveText('Доступно');
  await expect(
    hub.getByTestId('marketing-site').getByRole('link', { name: 'Открыть: Сайт и SEO', exact: true }),
  ).toHaveAttribute('href', '/marketing/site/editor');
  await expect(hub.locator('a[href^="/website"], a[href="/marketing/site"], a[href^="/marketing/site/assets"]')).toHaveCount(0);
  await expect(
    hub.getByTestId('marketing-budget').getByRole('link', { name: 'Открыть: Бюджет', exact: true }),
  ).toHaveAttribute('href', '/marketing/budget');
  await expect(hub).not.toContainText('гостиниц');
  for (const screen of ['ads', 'content'] as const) {
    await hub
      .getByRole('link', { name: screen === 'ads' ? 'Открыть: Реклама' : 'Открыть: Контент' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/marketing/${screen}$`));
    await expect(main(page).getByTestId(`marketing-${screen}-screen`)).toBeVisible();
    await page.goto('/marketing');
    await expect(hub).toBeVisible();
  }
});
