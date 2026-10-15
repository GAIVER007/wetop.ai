import { expect, test } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/*
 * Блог (10.10.2026): по одной статье на направление по правилам `apps/site/content/blog/README.md`.
 * Одна статья отвечает на один вопрос, ведёт на лендинг направления, служебный черновик не публикуется.
 */
const POSTS = [
  { slug: 'kak-vybrat-pms-dlya-khostela', landing: '/for/hostels/' },
  { slug: 'kak-vesti-zapisi-v-salone-krasoty', landing: '/for/salons/' },
  { slug: 'kak-prinimat-broni-stolov-v-restorane', landing: '/for/restaurants/' },
  { slug: 'kak-upravlyat-mini-otelem', landing: '/for/mini-hotels/' },
  { slug: 'kak-vesti-apart-otel', landing: '/for/apart-hotels/' },
  { slug: 'kak-vesti-gostevoy-dom', landing: '/for/guest-houses/' },
  { slug: 'kak-vesti-bazu-otdyha', landing: '/for/resorts/' },
  { slug: 'kak-sdavat-kvartiry-posutochno', landing: '/for/daily-rentals/' },
  { slug: 'kak-vesti-glemping', landing: '/for/glamping/' },
  { slug: 'kak-vesti-razmeshchenie-v-sanatorii', landing: '/for/sanatoriums/' },
  { slug: 'kak-vesti-kapsulnyy-otel', landing: '/for/capsule-hotels/' },
  { slug: 'kak-vesti-zapisi-v-barbershope', landing: '/for/barbershops/' },
  { slug: 'kak-vesti-zapisi-v-spa', landing: '/for/spa/' },
  { slug: 'kak-vesti-zapisi-nogtevoy-studii', landing: '/for/nail-studios/' },
  { slug: 'kak-vesti-zapisi-v-parikmaherskoy', landing: '/for/hair-salons/' },
  { slug: 'kak-vesti-zapisi-massazhnogo-salona', landing: '/for/massage/' },
  { slug: 'kak-vesti-zapisi-v-kosmetologii', landing: '/for/cosmetology/' },
  { slug: 'kak-vesti-zapisi-studii-brovey-i-resnic', landing: '/for/brows-lashes/' },
  { slug: 'kak-vesti-zapisi-studii-epilyacii', landing: '/for/epilation/' },
  { slug: 'kak-vesti-zapisi-tatu-studii', landing: '/for/tattoo/' },
  { slug: 'kak-vesti-uchet-v-kafe', landing: '/for/cafes/' },
  { slug: 'kak-vesti-uchet-bara', landing: '/for/bars/' },
  { slug: 'kak-vesti-uchet-kofeyni', landing: '/for/coffee-shops/' },
  { slug: 'kak-vesti-broni-v-kalyannoy', landing: '/for/hookah-lounges/' },
  { slug: 'kak-vesti-broni-komnat-v-karaoke', landing: '/for/karaoke/' },
  { slug: 'kak-vesti-uchet-piccerii', landing: '/for/pizzerias/' },
  { slug: 'kak-vesti-uchet-stolovoy', landing: '/for/canteens/' },
  { slug: 'kak-vesti-broni-banketnogo-zala', landing: '/for/banquet-halls/' },
];

/** Все страницы типов бизнеса: у каждой должна быть своя статья в блоге (SEO-перелинковка). */
const SUBTYPE_LANDINGS = [
  '/for/hostels/',
  '/for/mini-hotels/',
  '/for/apart-hotels/',
  '/for/guest-houses/',
  '/for/resorts/',
  '/for/daily-rentals/',
  '/for/glamping/',
  '/for/sanatoriums/',
  '/for/capsule-hotels/',
  '/for/beauty-salons/',
  '/for/barbershops/',
  '/for/spa/',
  '/for/nail-studios/',
  '/for/hair-salons/',
  '/for/massage/',
  '/for/cosmetology/',
  '/for/brows-lashes/',
  '/for/epilation/',
  '/for/tattoo/',
  '/for/cafes/',
  '/for/bars/',
  '/for/coffee-shops/',
  '/for/hookah-lounges/',
  '/for/karaoke/',
  '/for/pizzerias/',
  '/for/canteens/',
  '/for/banquet-halls/',
];

test('каждая страница типа бизнеса закрыта статьёй блога', () => {
  const dir = 'apps/site/content/blog';
  const bodies = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .map((f) => readFileSync(path.join(dir, f), 'utf8'))
    .filter((body) => !/^draft\s*:\s*true$/m.test(body));
  for (const landing of SUBTYPE_LANDINGS)
    expect(
      bodies.some((body) => body.includes(`](${landing})`)),
      `нет статьи со ссылкой на ${landing}`,
    ).toBe(true);
});

test('список статей: все опубликованы, черновика нет', async ({ page }) => {
  await page.goto('/blog/');
  for (const post of POSTS)
    await expect(page.locator(`a[href="/blog/${post.slug}/"]`).first()).toBeVisible();
  await expect(page.locator('a[href="/blog/kak-dobavit-statyu/"]')).toHaveCount(0);
});

for (const post of POSTS) {
  test(`статья ${post.slug}: один H1, ссылка на лендинг, внутренние ссылки живые`, async ({
    page,
  }) => {
    await page.goto(`/blog/${post.slug}/`);
    await expect(page.locator('h1')).toHaveCount(1);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description?.length ?? 0).toBeGreaterThan(50);
    expect(description?.length ?? 0).toBeLessThanOrEqual(155);
    const article = page.locator('main');
    await expect(article.locator(`a[href="${post.landing}"]`).first()).toBeVisible();
    const hrefs = await article
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    for (const href of new Set(hrefs))
      expect((await page.request.get(href)).status(), href).toBe(200);
    expect(await article.innerText()).not.toContain('—');
  });
}
