import { expect, test } from '@playwright/test';

/*
 * Блог (10.10.2026): по одной статье на направление по правилам `apps/site/content/blog/README.md`.
 * Одна статья отвечает на один вопрос, ведёт на лендинг направления, служебный черновик не публикуется.
 */
const POSTS = [
  { slug: 'kak-vybrat-pms-dlya-khostela', landing: '/for/hostels/' },
  { slug: 'kak-vesti-zapisi-v-salone-krasoty', landing: '/for/salons/' },
  { slug: 'kak-prinimat-broni-stolov-v-restorane', landing: '/for/restaurants/' },
];

test('список статей: три опубликованы, черновика нет', async ({ page }) => {
  await page.goto('/blog/');
  for (const post of POSTS) await expect(page.locator(`a[href="/blog/${post.slug}/"]`).first()).toBeVisible();
  await expect(page.locator('a[href="/blog/kak-dobavit-statyu/"]')).toHaveCount(0);
});

for (const post of POSTS) {
  test(`статья ${post.slug}: один H1, ссылка на лендинг, внутренние ссылки живые`, async ({ page }) => {
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
    for (const href of new Set(hrefs)) expect((await page.request.get(href)).status(), href).toBe(200);
    expect(await article.innerText()).not.toContain('—');
  });
}
