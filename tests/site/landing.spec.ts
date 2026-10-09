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
  '/privacy/',
  '/terms/',
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

/** Публичная страница предлагает регистрацию без обещаний trial или оплаты. */
test('главная: регистрация открыта, маркетинговых обещаний trial нет', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(' · ');
  const start = page.locator('#start');
  await expect(start.getByRole('heading', { level: 3 })).toHaveText([
    /^Создайте аккаунт$/,
    /^Настройте бизнес$/,
    /^Пригласите команду$/,
    /^Начните работу$/,
  ]);
  await expect(start).not.toContainText(/14\sдней\sбесплатно|карта\sне\sнужна|пробн/i);
  await expect(start).not.toContainText(/7\sдней|подключаем партнёров вручную|заведём аккаунт/i);
  await expect(start).not.toContainText(/код из письма/);
  // «Регистрация» (27.09.2026, ADR-100, ADR-102) без JavaScript , прямо на форму стойки, «Войти» , на экран входа;
  // с JavaScript обе открывают окно поверх главной (tests/site/auth-dialog.spec.ts)
  const header = page.locator('.site-header');
  await expect(header.getByRole('link', { name: 'Войти', exact: true })).toHaveAttribute(
    'href',
    'https://wetop.ai/#login',
  );
  await expect(header.getByRole('link', { name: 'Регистрация', exact: true })).toHaveAttribute(
    'href',
    'https://wetop.ai/#register',
  );
  const hero = page.locator('.public-intro');
  await expect(hero.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    'https://wetop.ai/#register',
  );
  await expect(hero.getByRole('link', { name: /Посмотреть возможности/ })).toBeVisible();
  await expect(hero).not.toContainText(/14\sдней\sбесплатно|карта\sне\sнужна|пробн/i);
  // регистрация после шагов живёт в карточке призыва #get-started
  await expect(
    page.locator('#get-started [data-auth="register"]'),
  ).toHaveAttribute('href', 'https://wetop.ai/#register');
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
  await expect(hero.locator('.dash')).toBeVisible();
  await expect(hero).toContainText(/Пример интерфейса/);
  await expect(hero).not.toContainText(/248[\s\u00a0]?500|Алина|Марат/);
});

test('первый экран объясняет платформу, направления и зрелость', async ({ page }) => {
  // LAND2 v2: заголовок и карточки по снимку владельца
  await page.goto('/');
  const hero = page.locator('.public-intro');
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(
    'Управляйте бронированиями, клиентами и командой из одного окна',
  );
  await expect(hero).toContainText('операционную работу, продажи и аналитику');
  await expect(hero).not.toContainText(/пилот/i);
  const audience = page.locator('#audience');
  await expect(audience.getByRole('heading', { level: 2 })).toHaveText(
    'Три направления. Одна платформа',
  );
  await expect(audience).toContainText('Хостелы');
  await expect(audience).toContainText('Салоны красоты');
  await expect(audience).toContainText('Рестораны');
});
