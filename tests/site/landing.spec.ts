import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная wetop.ai на статической сборке: страницы открываются, доступность без нарушений, на телефоне
 * нет горизонтальной прокрутки, ссылка в мессенджере показывает карточку с картинкой, и в sitemap.xml
 * нет адресов, которых на сайте нет. Данных владельца тесты не требуют: пустые поля `site.config.ts`
 * прячут блоки, и это проверяется отдельно — «TODO» на странице быть не должно ни в каком виде.
 */
const PAGES = [
  '/',
  '/blog/',
  '/for/hostels/',
  '/for/mini-hotels/',
  '/for/apart-hotels/',
  '/calculator/',
];
test('чат ИИ-помощника: тег отсутствует, пока публичный сервис не подключён', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[src*="/widget/widget.js"]')).toHaveCount(0);
});

for (const path of PAGES) {
  test(`${path} — открывается, доступна и без «TODO» на экране`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status(), `страница ${path}`).toBe(200);

    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page).toHaveTitle(/WETOP/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toMatch(/TODO|заполнить|placeholder/i);

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });

  test(`${path} — на телефоне нет горизонтальной прокрутки`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    // Выражение строкой, а не стрелкой: в корневом tsconfig нет библиотеки DOM, и `document` тут не типизирован
    const overflow = Number(
      await page.evaluate(
        'document.documentElement.scrollWidth - document.documentElement.clientWidth',
      ),
    );
    expect(overflow, 'ширина страницы больше экрана').toBeLessThanOrEqual(1);
  });
}

test('ссылка в мессенджере: заголовок, описание и картинка 1200×630', async ({ page, request }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const meta = async (property: string) =>
      page.locator(`meta[property="${property}"]`).getAttribute('content');
    expect(await meta('og:title'), `og:title на ${path}`).toContain('WETOP');
    expect(await meta('og:description'), `og:description на ${path}`).toBeTruthy();
    expect(await meta('og:image:width')).toBe('1200');
    expect(await meta('og:image:height')).toBe('630');
    const image = (await meta('og:image'))!;
    const file = await request.get(new URL(image).pathname);
    expect(file.status(), `картинка ссылки ${image} не отдаётся`).toBe(200);
    expect((await file.body()).length, 'картинка ссылки подозрительно мала').toBeGreaterThan(
      10_000,
    );
  }
});

test('в sitemap.xml только живые адреса, robots.txt на него ссылается', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    const res = await request.get(new URL(url).pathname);
    expect(res.status(), `в sitemap.xml адрес, которого нет: ${url}`).toBe(200);
  }
  expect(await (await request.get('/robots.txt')).text()).toContain('sitemap.xml');
});

/**
 * «Как начать» говорит то, что есть на самом деле. 20.09.2026 ADR-056 снял обещания регистрации и пробных дней —
 * тогда их в системе не было. 26.09.2026 владелец открыл самостоятельную регистрацию с 14 днями пробного периода
 * (ADR-098; `TRIAL_DAYS` в `packages/domain/src/accounts/trial.ts`): на главной «Войти» и «Регистрация» — в шапке,
 * на первом экране и в призыве «Как начать»; «Регистрация» ведёт прямо на форму стойки `/register`. Кода из письма
 * по-прежнему нет — подтверждение идёт ссылкой. Пункт «Блог» не показывается, пока опубликованных статей нет
 * (страница `/blog/` остаётся по адресу); подсказка на макете первого экрана не выходит за карточку на 1440 px;
 * в текстах сайта нет « · » (тот же голос, что у стойки, §14).
 */
test('главная: «Войти» и «Регистрация», шаги под регистрацию с 14 днями, блог скрыт без статей, подсказка макета внутри карточки, без « · »', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(' · ');
  const start = page.locator('#start');
  await expect(start.getByRole('heading', { level: 3 })).toHaveText([
    /^Создайте аккаунт$/,
    /^Подтвердите почту$/,
    /^Настройте объект$/,
    /^Начните работу$/,
    /./, // заголовок призыва
  ]);
  await expect(start).toContainText(/14\sдней/);
  await expect(start).not.toContainText(/7\sдней|подключаем партнёров вручную|заведём аккаунт/i);
  await expect(start).not.toContainText(/код из письма/);
  // «Получить доступ» (27.09.2026, ADR-100, ADR-102) без JavaScript — прямо на форму стойки, «Войти» — на экран входа;
  // с JavaScript обе открывают окно поверх главной (tests/site/auth-dialog.spec.ts)
  const header = page.locator('.site-header');
  await expect(header.getByRole('link', { name: 'Войти', exact: true })).toHaveAttribute(
    'href',
    'https://wetop.ai/#login',
  );
  await expect(header.getByRole('link', { name: 'Получить доступ', exact: true })).toHaveAttribute(
    'href',
    'https://wetop.ai/#register',
  );
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: /Получить доступ/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/#register',
  );
  await expect(hero.getByRole('link', { name: /Смотреть возможности/ })).toBeVisible();
  await expect(hero).toContainText(/14\sдней бесплатно/);
  await expect(start.getByRole('link', { name: /Получить доступ/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/#register',
  );
  expect(await page.locator('a[href$="#start"]').filter({ hasText: /заявк/i }).count()).toBe(0);
  // блог: статей нет — пункта нет ни в шапке, ни в подвале; сама страница отдаётся
  await expect(
    page
      .getByRole('navigation', { name: 'Основная навигация' })
      .getByRole('link', { name: 'Блог' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Ссылки' }).getByRole('link', { name: 'Блог' }),
  ).toHaveCount(0);
  expect((await page.request.get('/blog/')).status()).toBe(200);
  // Карта разделов на первом экране (01.10.2026): схема продукта, а не снимок системы и не выдуманные показатели
  await expect(hero.locator('.product-map')).toBeVisible();
  await expect(hero).toContainText(/Схема разделов/);
  await expect(hero).not.toContainText(/248[\s\u00a0]?500|\+12%|Алина|Марат/);
});

/**
 * Позиционирование 29.09.2026 (решение владельца, ADR-104: WETOP — платформа для сервисного бизнеса).
 * Первый экран говорит о платформе, а не о гостинице: общий операционный экран «Сегодня» с клиентами, филиалами,
 * задачами, продажами и финансами; ни номеров, ни койко-мест, ни каналов OTA. Hospitality показан ниже как
 * работающее направление, Beauty — как следующее, с явной пометкой, что подключить его пока нельзя.
 */
test('первый экран — центр управления сервисным бизнесом; Hospitality работает, Beauty — следующее', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page).toHaveTitle(/центр управления сервисным бизнесом/i);
  const hero = page.locator('.hero');
  await expect(hero.getByRole('heading', { level: 1 })).toContainText(
    /Центр управления сервисным бизнесом/,
  );
  await expect(hero).toContainText(
    /Клиенты,\sрасписание,\sпродажи,\sкоманда,\sфинансы\sи\sаналитика\sв\sодном\sрабочем\sпространстве/,
  );
  // Первый экран 29.09.2026, вечер (владелец: «сделай лучше, профессиональней, понятней»): главная фраза — заголовок,
  // одна плашка, без круглой печати. С 01.10.2026 справа карта разделов: шесть областей платформы ссылками на блоки
  // страницы (plans/site-home-clear-blocks-2026-10-01.md), без вымышленных имён и сумм.
  await expect(hero.locator('.hero__seal')).toHaveCount(0);
  await expect(hero.locator('.hero__word')).toHaveCount(0);
  await expect(hero.locator('.hero__status')).toHaveText(/Регистрация открыта/);
  const map = hero.getByRole('list', { name: /Разделы WETOP/ });
  await expect(map).toBeVisible();
  for (const section of ['Операции', 'Продажи', 'Команда', 'Финансы', 'Аналитика', 'ИИ-продавцы']) {
    await expect(map).toContainText(section);
  }

  const verticals = page.locator('#audience');
  await expect(verticals.getByRole('heading', { level: 2 })).toContainText(/Hospitality/);
  await expect(verticals).toContainText(/Хостелы/);
  const beauty = verticals.locator('.vertical-next');
  await expect(beauty).toContainText(/Beauty/);
  await expect(beauty).toContainText(/Следующее направление/);
  await expect(beauty).toContainText(/пока нельзя/);
  // Первый экран идёт раньше разделов про гостиницу
  const order = await page
    .locator('main section')
    .evaluateAll((els) => els.map((el) => el.getAttribute('id') ?? el.className));
  expect(order.indexOf('audience')).toBeLessThan(order.indexOf('features'));
  expect(order.indexOf('features')).toBeLessThan(order.indexOf('sales'));
});
