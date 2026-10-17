import { readFileSync } from 'node:fs';
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
    check((await page.locator('meta[name="twitter:card"]').count()) === 1, `${path}: нет twitter:card`);
    // Длинное тире видно в выдаче и выдаёт текст ИИ (CLAUDE.md §5)
    const ogTitle = (await page.locator('meta[property="og:title"]').getAttribute('content')) ?? '';
    check(!/\u2014/.test(title + description + ogTitle), `${path}: длинное тире в title или description`);
    // Уровни заголовков без пропусков вниз: после h2 сразу h4 читалка и поисковик видят дыру в структуре
    const levels = await page
      .locator('main h1, main h2, main h3, main h4, main h5, main h6')
      .evaluateAll((nodes) => nodes.map((n) => Number(n.tagName[1])));
    levels.forEach((level, i) => {
      if (i > 0 && level > levels[i - 1]! + 1)
        problems.push(`${path}: заголовок h${level} сразу после h${levels[i - 1]}`);
    });
    type LdNode = { '@type'?: string; mainEntity?: Array<{ name: string }> };
    const ldNodes: LdNode[] = [];
    for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
      try {
        const data = JSON.parse(raw) as LdNode & { '@context'?: string; '@graph'?: LdNode[] };
        check(data['@context'] === 'https://schema.org', `${path}: JSON-LD без @context`);
        ldNodes.push(...(data['@graph'] ?? [data]));
      } catch {
        problems.push(`${path}: JSON-LD не разбирается`);
      }
    }
    // Сущности, которые у страницы одни: шаблон и страница не должны выводить их оба (16.10.2026: FAQPage
    // выходил дважды на 30 лендингах). Другие типы могут повторяться, если их несколько по смыслу.
    for (const type of ['FAQPage', 'BreadcrumbList', 'Organization', 'WebSite', 'BlogPosting']) {
      const count = ldNodes.filter((n) => n['@type'] === type).length;
      check(count <= 1, `${path}: ${type} выведен ${count} раза`);
    }
    // Вопросы разметки те же, что видит посетитель: один владелец вывода, список не расходится со страницей
    const faq = ldNodes.find((n) => n['@type'] === 'FAQPage');
    if (faq) {
      const norm = (v: string) => v.replace(/\s+/g, ' ').trim();
      const visible = (
        await page.locator('.faq details summary > span:first-child').allTextContents()
      ).map(norm);
      const marked = (faq.mainEntity ?? []).map((q) => norm(q.name));
      check(
        JSON.stringify(marked) === JSON.stringify(visible),
        `${path}: вопросы FAQPage не совпадают с видимыми (${marked.length} против ${visible.length})`,
      );
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

test('/restaurants/ слита в /for/restaurants/: постоянный редирект и нет в sitemap', async ({ page }) => {
  // Правило читает Cloudflare Pages; местный статический сервер его не исполняет, поэтому проверяем файл
  const rules = readFileSync('apps/site/public/_redirects', 'utf8');
  expect(rules).toMatch(/^\/restaurants\/ \/for\/restaurants\/ 301$/m);
  expect(rules).toMatch(/^\/restaurants \/for\/restaurants\/ 301$/m);
  const xml = await (await page.request.get('/sitemap.xml')).text();
  expect(xml).not.toContain('wetop.ai/restaurants/<');
  expect(await page.request.get('/for/restaurants/').then((r) => r.status())).toBe(200);
});

test('лендинги: видимые крошки, своя картинка ссылки', async ({ page }) => {
  await page.goto('/for/barbershops/');
  const crumbs = page.getByRole('navigation', { name: 'Где вы на сайте' });
  await expect(crumbs.getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/');
  await expect(crumbs.getByRole('link', { name: 'Для салонов красоты' })).toHaveAttribute('href', '/for/salons/');
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText('Барбершопы');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toContain('/og/barbershop.jpg');
});

test('IndexNow: файл ключа отдаётся сайтом и совпадает с ключом скрипта', async ({ page }) => {
  const key = readFileSync('scripts/site/indexnow.mjs', 'utf8').match(/const KEY = '([0-9a-f]{32})'/)?.[1];
  expect(key, 'ключ в scripts/site/indexnow.mjs').toBeTruthy();
  const res = await page.request.get(`/${key}.txt`);
  expect(res.status()).toBe(200);
  expect((await res.text()).trim()).toBe(key);
});
