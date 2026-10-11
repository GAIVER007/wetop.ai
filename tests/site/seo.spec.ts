import { expect, test } from '@playwright/test';

/*
 * SEO всех страниц из sitemap.xml (11.10.2026): то, по чему поисковик собирает выдачу. Сторож нужен, чтобы
 * новая страница не ушла без заголовка, описания, canonical или с разметкой, которую нельзя разобрать.
 */
test('каждая страница sitemap: h1, title, description, canonical, og:image, JSON-LD; без дублей', async ({
  page,
}) => {
  const xml = await (await page.request.get('/sitemap.xml')).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
  expect(paths.length).toBeGreaterThan(15);
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  // Все нарушения списком: так в отчёте видно сразу всё, что надо поправить, а не первое
  const problems: string[] = [];
  const check = (ok: boolean, message: string) => {
    if (!ok) problems.push(message);
  };
  for (const path of paths) {
    const res = await page.goto(path);
    check(res?.status() === 200, `${path}: статус ${res?.status()}`);
    const h1 = await page.locator('h1').count();
    check(h1 === 1, `${path}: h1 ${h1} шт.`);
    const title = await page.title();
    check(title.length > 10 && title.length <= 70, `${path}: title ${title.length} знаков «${title}»`);
    const description =
      (await page.locator('meta[name="description"]').getAttribute('content')) ?? '';
    check(
      description.length >= 50 && description.length <= 160,
      `${path}: description ${description.length} знаков`,
    );
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    check(new URL(canonical ?? '', 'https://wetop.ai').pathname === path, `${path}: canonical ${canonical}`);
    check((await page.locator('meta[property="og:image"]').count()) === 1, `${path}: нет og:image`);
    for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      try {
        check((JSON.parse(raw) as Record<string, unknown>)['@context'] === 'https://schema.org', `${path}: JSON-LD без @context`);
      } catch {
        problems.push(`${path}: JSON-LD не разбирается`);
      }
    }
    check(!titles.has(title), `${path}: title как у ${titles.get(title)}`);
    check(!descriptions.has(description), `${path}: description как у ${descriptions.get(description)}`);
    titles.set(title, path);
    descriptions.set(description, path);
  }
  expect(problems).toEqual([]);
});

test('лендинги: FAQPage и хлебные крошки в разметке', async ({ page }) => {
  for (const path of ['/for/salons/', '/for/barbershops/', '/for/bars/', '/for/hostels/']) {
    await page.goto(path);
    const types = (await page.locator('script[type="application/ld+json"]').allTextContents())
      .map((raw) => JSON.parse(raw) as { '@type'?: string; '@graph'?: Array<{ '@type': string }> })
      .flatMap((d) => (d['@graph'] ? d['@graph'].map((g) => g['@type']) : [d['@type']]));
    expect(types, path).toEqual(expect.arrayContaining(['Organization', 'FAQPage', 'BreadcrumbList']));
  }
});
