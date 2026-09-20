import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Главная wetop.ai на статической сборке: страницы открываются, доступность без нарушений, на телефоне
 * нет горизонтальной прокрутки, ссылка в мессенджере показывает карточку с картинкой, и в sitemap.xml
 * нет адресов, которых на сайте нет. Данных владельца тесты не требуют: пустые поля `site.config.ts`
 * прячут блоки, и это проверяется отдельно — «TODO» на странице быть не должно ни в каком виде.
 */
const PAGES = ['/', '/blog/'];

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
 * E2–E3 (20.09.2026, решения владельца С1–С3 по `plans/site-refresh-2026-09-20.md`): тексты «Как начать» говорят
 * то же, что делает кнопка — регистрацию с пробным периодом, а не заявку и звонок; пункт «Блог» в шапке, меню и подвале
 * не показывается, пока опубликованных статей нет (страница `/blog/` остаётся по адресу); подсказка «Новая бронь» на
 * макете не выходит за карточку на 1440 px; в текстах сайта нет « · » (тот же голос, что у стойки, §14).
 */
test('главная: шаги под регистрацию, блог скрыт без статей, подсказка макета внутри карточки, без « · »', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const body = await page.locator('body').innerText();
  expect(body).not.toContain(' · ');
  expect(body).not.toMatch(/Оставьте заявку|мы свяжемся/);
  const start = page.locator('#start');
  await expect(start.getByRole('heading', { level: 3 }).first()).toHaveText('Регистрация');
  await expect(start).toContainText('7 дней');
  await expect(start.getByRole('link', { name: /Попробовать бесплатно/ })).toHaveAttribute(
    'href',
    /register/,
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
