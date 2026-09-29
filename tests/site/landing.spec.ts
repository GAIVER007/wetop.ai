import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная wetop.ai на статической сборке: страницы открываются, доступность без нарушений, на телефоне
 * нет горизонтальной прокрутки, ссылка в мессенджере показывает карточку с картинкой, и в sitemap.xml
 * нет адресов, которых на сайте нет. Данных владельца тесты не требуют: пустые поля `site.config.ts`
 * прячут блоки, и это проверяется отдельно — «TODO» на странице быть не должно ни в каком виде.
 */
const PAGES = ['/', '/blog/'];
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

    // Axe судит страницу в покое: вводные анимации (появление брони в макете — 0,9 с) дают полупрозрачный
    // текст с ложным «контрастом 1,57». Ждём конечные анимации, бесконечные (вращение печати) не ждём.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished.catch(() => undefined)),
      ),
    );
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
 * тогда их в системе не было. 26.09.2026 владелец открыл самостоятельную регистрацию с 7 днями пробного периода
 * (ADR-098; с 27.09 срок 14 дней — ADR-102, `TRIAL_DAYS` в `packages/domain/src/accounts/trial.ts`): на главной «Войти» и «Регистрация» — в шапке,
 * на первом экране и в призыве «Как начать»; «Регистрация» ведёт прямо на форму стойки `/register`. Кода из письма
 * по-прежнему нет — подтверждение идёт ссылкой. Пункт «Блог» не показывается, пока опубликованных статей нет
 * (страница `/blog/` остаётся по адресу); подсказка «Новая бронь» на макете не выходит за карточку на 1440 px;
 * в текстах сайта нет « · » (тот же голос, что у стойки, §14).
 */
test('главная: безопасные вход и trial, блог скрыт без статей, подсказка макета внутри карточки', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const start = page.locator('#start');
  await expect(start.getByRole('heading', { level: 3 })).toHaveText([
    /^Создаём объект$/,
    /^Настраиваем фонд и тарифы$/,
    /^Переносим данные$/,
    /^Подключаем продажи$/,
    /^Начинаете работу$/,
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
    'https://app.wetop.ai/login',
  );
  await expect(
    header.getByRole('link', { name: 'Попробовать бесплатно', exact: true }),
  ).toHaveAttribute('href', 'https://app.wetop.ai/register');
  const hero = page.locator('.hero');
  await expect(hero.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    'https://app.wetop.ai/register',
  );
  await expect(hero.getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
  await expect(hero).toContainText(/14\sдней бесплатно/);
  await expect(start.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    'https://app.wetop.ai/register',
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
  // подсказка «Новая бронь» — внутри карточки макета (после анимации появления: она сдвигает на 14 px)
  await page
    .locator('.mockup__toast')
    .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const card = await page.locator('.mockup__window').boundingBox();
  const toast = await page.locator('.mockup__toast').boundingBox();
  expect(card && toast && toast.x + toast.width <= card.x + card.width + 1).toBe(true);
  expect(card && toast && toast.y + toast.height <= card.y + card.height + 1).toBe(true);
});

test('главная: B2B-позиционирование, честные обещания и утверждённая структура', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Управляйте отелем из одного окна',
  );
  await expect(page.locator('.hero')).toContainText(
    'Брони, гости, номерной фонд, продажи, финансы и аналитика',
  );

  const navigation = page.getByRole('navigation', { name: 'Основная навигация' });
  await expect(navigation.getByRole('link')).toHaveText([
    'Продукт',
    'Возможности',
    'Для кого',
    'Интеграции',
    'Тарифы',
  ]);

  const headings = await page.locator('main h2').allTextContents();
  expect(headings).toEqual([
    'Вся смена перед глазами',
    'Всё, что нужно для ежедневной работы',
    'Рабочие экраны WETOP',
    'Подходит разным форматам размещения',
    'Всё необходимое для работы объекта',
    'Работает с каналами, которыми вы уже пользуетесь',
    'Принимайте больше прямых бронирований',
    'AI-продавец WETOP',
    'Понимайте не только загрузку, но и деньги',
    'Почему WETOP',
    'Поможем перейти с другой PMS',
    'Запустить WETOP можно за несколько шагов',
    'Простой тариф для всей команды',
    'Управляйте объектом из одной системы',
  ]);

  await expect(page.locator('#showcase').getByRole('heading', { level: 3 })).toHaveText([
    'Сегодня',
    'Шахматка',
    'Брони',
  ]);
  await expect(page.locator('#integrations')).toContainText('через Channex');
  await expect(page.locator('#pricing')).toContainText('49 900 ₸');
  await expect(page.locator('#pricing')).toContainText('Более 100 единиц — индивидуальные условия');
  await expect(page.getByRole('link', { name: 'Попробовать бесплатно' }).first()).toHaveAttribute(
    'href',
    'https://app.wetop.ai/register',
  );

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/за секунды|всегда мгновенно|Сторож системы/i);
});

test('главная: 375 px без горизонтального скролла, mobile menu работает с клавиатуры', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(
    await page.evaluate('document.documentElement.scrollWidth - window.innerWidth'),
  ).toBeLessThanOrEqual(1);

  const menu = page.getByRole('button', { name: 'Меню' });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
});

test('главная: prefers-reduced-motion убирает декоративные анимации', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate('document.getAnimations().length')).toBe(0);
});
