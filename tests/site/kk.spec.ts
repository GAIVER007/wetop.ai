import { expect, test } from '@playwright/test';

/*
 * Казахские версии раздела «для кого» (21.10.2026, фаза 1): /kk/for/<направление|тип>/ для всех 30 страниц.
 * Русский остаётся без префикса; hreflang связывает пары в обе стороны, x-default ведёт на русскую.
 * Главная, блог и калькулятор в фазе 1 только на русском: с казахских страниц на них ведут обычные ссылки.
 */
const DIRECTIONS = ['hotels', 'salons', 'restaurants'];
const SUBTYPES = [
  'hostels',
  'mini-hotels',
  'apart-hotels',
  'guest-houses',
  'resorts',
  'daily-rentals',
  'glamping',
  'sanatoriums',
  'capsule-hotels',
  'beauty-salons',
  'barbershops',
  'spa',
  'nail-studios',
  'hair-salons',
  'massage',
  'cosmetology',
  'brows-lashes',
  'epilation',
  'tattoo',
  'cafes',
  'bars',
  'coffee-shops',
  'hookah-lounges',
  'karaoke',
  'pizzerias',
  'canteens',
  'banquet-halls',
];
const ALL = [...DIRECTIONS, ...SUBTYPES];
/** Буквы, которых нет в русском: страница действительно на казахском, а не копия. */
const KK_LETTERS = /[әғқңөұүһі]/i;

for (const slug of ALL) {
  const ru = `/for/${slug}/`;
  const kk = `/kk/for/${slug}/`;
  test(`казахская страница ${kk}: текст, hreflang, переключатель`, async ({ page }) => {
    await page.goto(kk);
    // Заголовок и лид по-казахски, а не русская копия
    const h1 = await page.locator('h1').innerText();
    expect(h1, 'h1 на казахском').toMatch(KK_LETTERS);
    expect(await page.locator('main').innerText()).toMatch(KK_LETTERS);
    // Пара hreflang в обе стороны и x-default на русскую
    for (const [lang, href] of [
      ['ru', ru],
      ['kk', kk],
      ['x-default', ru],
    ])
      await expect(page.locator(`link[rel="alternate"][hreflang="${lang}"]`)).toHaveAttribute(
        'href',
        `https://wetop.ai${href}`,
      );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://wetop.ai${kk}`,
    );
    // Переключатель ведёт на русскую пару, и наоборот
    await expect(page.locator(`main a[href="${ru}"][data-lang-switch]`)).toBeVisible();
    // Разметка FAQPage есть и на казахской странице
    const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(
      '',
    );
    expect(ld).toContain('"FAQPage"');
    expect(await page.locator('body').innerText()).not.toContain('—');
  });

  test(`русская страница ${ru}: hreflang на казахскую пару`, async ({ page }) => {
    await page.goto(ru);
    await expect(page.locator('link[rel="alternate"][hreflang="kk"]')).toHaveAttribute(
      'href',
      `https://wetop.ai${kk}`,
    );
    await expect(page.locator(`main a[href="${kk}"][data-lang-switch]`)).toBeVisible();
  });
}

test('sitemap содержит казахские страницы раздела', async ({ page }) => {
  const xml = await (await page.request.get('/sitemap.xml')).text();
  for (const slug of ALL) expect(xml).toContain(`https://wetop.ai/kk/for/${slug}/`);
});

test('каркас /kk/for/*: шапка, меню и подвал по-казахски, ссылки подвала на казахские страницы (P1-12)', async ({
  page,
}) => {
  await page.goto('/kk/for/hotels/');
  const header = page.locator('.site-header');
  for (const ru of ['Продукт', 'Для кого', 'Войти', 'Регистрация']) await expect(header).not.toContainText(ru);
  await expect(header.getByRole('link', { name: 'Кіру', exact: true })).toBeVisible();
  const footer = page.locator('footer');
  await expect(footer).toContainText('Құпиялылық саясаты');
  await expect(footer).not.toContainText('Политика конфиденциальности');
  await expect(footer.locator('a[href="/kk/for/salons/"]')).toHaveCount(1);
  // ни одной ссылки на несуществующую казахскую главную
  await expect(page.locator('a[href="/kk"], a[href="/kk/"]')).toHaveCount(0);
  // русская страница остаётся с русской шапкой
  await page.goto('/for/hotels/');
  await expect(page.locator('.site-header')).toContainText('Войти');
  await expect(page.locator('footer a[href="/for/salons/"]')).toHaveCount(1);
});

test('/kk/for/hotels/ на 390: кнопки героя не шире экрана (P1-12)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/kk/for/hotels/');
  const widths = await page
    .locator('.hotel-hero__actions .btn')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  expect(widths.length).toBeGreaterThan(1);
  for (const right of widths) expect(right).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
