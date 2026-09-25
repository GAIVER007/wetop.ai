import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная wetop.ai на статической сборке: страницы открываются, доступность без нарушений, на телефоне
 * нет горизонтальной прокрутки, ссылка в мессенджере показывает карточку с картинкой, и в sitemap.xml
 * нет адресов, которых на сайте нет. Данных владельца тесты не требуют: пустые поля `site.config.ts`
 * прячут блоки, и это проверяется отдельно — «TODO» на странице быть не должно ни в каком виде.
 */
const PAGES = ['/', '/blog/'];
/** Адрес ИИ-помощника (Q-180, ADR-081) — `assistantUrl` в `apps/site/src/site.config.ts` */
const ASSISTANT = 'https://assistant.wetop.ai';

// Скрипт чата — чужой: тесты главной его не грузят, чтобы проверять страницу, а не бота и его доступность
test.beforeEach(async ({ page }) => {
  await page.route(`${ASSISTANT}/**`, (route) => route.abort());
});

test('чат ИИ-помощника: анонимный тег по адресу помощника (ТЗ П2, ADR-081)', async ({ page }) => {
  await page.goto('/');
  const tag = page.locator(`script[src="${ASSISTANT}/widget/widget.js"]`);
  await expect(tag).toHaveCount(1);
  // на главной человек не вошёл: подписи в теге нет
  expect(await tag.getAttribute('data-identity')).toBeNull();
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
 * «Как начать» говорит то, что есть на самом деле. E2–E3 (20.09.2026, С1–С3 по `plans/site-refresh-2026-09-20.md`)
 * обещали регистрацию, код из письма и 7 дней в демо-объекте; тем же днём ADR-056 снял все три обещания: ни одного
 * из них в системе нет, первый шаг — заявка, систему разворачивают для объекта, учётные записи заводит владелец.
 * Кнопка «Оставить заявку» без ссылки владельца (`trialHref` пуст) ведёт в этот же раздел, на `/register` сайт не
 * ссылается. Пункт «Блог» в шапке, меню и подвале не показывается, пока опубликованных статей нет (страница `/blog/`
 * остаётся по адресу); подсказка «Новая бронь» на макете не выходит за карточку на 1440 px; в текстах сайта нет « · »
 * (тот же голос, что у стойки, §14). 22.09.2026: тест отставал от ADR-056 и ждал снятые обещания.
 */
test('главная: шаги под заявку без снятых обещаний, блог скрыт без статей, подсказка макета внутри карточки, без « · »', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(' · ');
  const start = page.locator('#start');
  await expect(start.getByRole('heading', { level: 3 })).toHaveText([
    /^Заявка$/,
    /^Перенос данных и сверка$/, // `typo()` может ставить неразрывные пробелы — regex их пропускает
    /^Работа$/,
    /./, // заголовок призыва «Посмотрим WETOP на вашем объекте»
  ]);
  // три обещания, снятые ADR-056: регистрация, код из письма, дни в демо-объекте
  await expect(start).not.toContainText(/Регистрац|код из письма|\d+ дн(ей|я) /);
  expect(await page.locator('a[href*="register"]').count(), 'ссылка на /register').toBe(0);
  await expect(page.getByRole('link', { name: 'Оставить заявку' }).first()).toHaveAttribute(
    'href',
    /#start$/,
  );
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
