// Обход собранного сайта (apps/site/out): реестр страниц, SEO-поля, ссылки, sitemap. Только чтение.
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import console from 'node:console';

const OUT = process.argv[2];
const SITE = 'https://wetop.ai';
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) files.push(p);
  }
})(OUT);

const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
const metas = (html) => [...html.matchAll(/<meta [^>]*>/g)].map((m) => m[0]);
const meta = (html, key) => {
  const t = metas(html).find((m) => attr(m, 'name') === key || attr(m, 'property') === key);
  return t ? decode(attr(t, 'content') ?? '') : undefined;
};
const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;|\u00a0/g, ' ');
const text = (s) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

const pathOf = (f) => {
  let r = '/' + relative(OUT, f).replace(/index\.html$/, '').replace(/\.html$/, '/');
  return r;
};
const exists = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '' ) return true;
  const fp = join(OUT, clean);
  return existsSync(fp) && statSync(fp).isFile() ? true : existsSync(join(fp, 'index.html'));
};

const sitemap = [...readFileSync(join(OUT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, ''));
const lastmods = [...readFileSync(join(OUT, 'sitemap.xml'), 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({ loc: m[1].match(/<loc>([^<]+)/)[1].replace(SITE, ''), lastmod: m[1].match(/<lastmod>([^<]+)/)?.[1] }));
const rows = [];
const problems = [];
const inbound = new Map();
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  const path = pathOf(f);
  const title = text(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
  const canonical = attr(html.match(/<link rel="canonical"[^>]*>/)?.[0] ?? '', 'href');
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
  const lang = html.match(/<html[^>]*lang="([^"]+)"/)?.[1];
  const hreflang = [...html.matchAll(/hreflang="([^"]+)"/g)].map((m) => m[1]);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => {
    try {
      const j = JSON.parse(m[1]);
      return (j['@graph'] ?? [j]).map((x) => x['@type']).join('+');
    } catch {
      problems.push([path, 'JSON-LD не разбирается']);
      return 'BAD';
    }
  });
  const robots = meta(html, 'robots');
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => decode(m[1]));
  const imgs = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
  for (const l of links) {
    if (l.startsWith('/') && !l.startsWith('//')) {
      const target = l.split('#')[0];
      if (target && !exists(target)) problems.push([path, `битая внутренняя ссылка ${l}`]);
      if (target && !target.endsWith('/') && !/\.\w+$/.test(target)) problems.push([path, `ссылка без слеша (редирект) ${l}`]);
      if (target && target !== path) inbound.set(target, (inbound.get(target) ?? new Set()).add(path));
    } else if (/localhost|127\.0\.0\.1|pages\.dev/.test(l)) problems.push([path, `ссылка на стенд ${l}`]);
  }
  for (const i of imgs) if (attr(i, 'alt') === undefined) problems.push([path, `img без alt ${attr(i, 'src')}`]);
  const ogImage = meta(html, 'og:image');
  const ogUrl = meta(html, 'og:url');
  for (const [k, v] of [['og:image', ogImage], ['og:url', ogUrl], ['canonical', canonical]])
    if (v && /localhost|127\.0\.0\.1|pages\.dev/.test(v)) problems.push([path, `${k} на стенд ${v}`]);
  const row = {
    path,
    title,
    description: meta(html, 'description'),
    canonical: canonical?.replace(SITE, ''),
    robots,
    h1: h1s,
    lang,
    hreflang,
    ld,
    ogTitle: meta(html, 'og:title'),
    ogUrl: ogUrl?.replace(SITE, ''),
    ogImage: ogImage?.replace(SITE, ''),
    twImage: meta(html, 'twitter:image')?.replace(SITE, ''),
    inSitemap: sitemap.includes(path),
    links: links.length,
  };
  rows.push(row);
  if (h1s.length !== 1) problems.push([path, `h1: ${h1s.length}`]);
  if (!row.description) problems.push([path, 'нет description']);
  if (row.canonical && row.canonical !== path && !robots?.includes('noindex')) problems.push([path, `canonical на другой адрес ${row.canonical}`]);
  if (!row.canonical && !robots?.includes('noindex')) problems.push([path, 'нет canonical']);
  if (row.ogUrl && row.canonical && row.ogUrl !== row.canonical) problems.push([path, `og:url ${row.ogUrl} != canonical ${row.canonical}`]);
  if (row.ogTitle && row.ogTitle !== title) problems.push([path, `og:title != title: «${row.ogTitle}»`]);
  if (title.length > 65) problems.push([path, `title длинный (${title.length}): ${title}`]);
  if ((row.description ?? '').length > 170) problems.push([path, `description длинный (${row.description.length})`]);
  if (robots?.includes('noindex') && row.inSitemap) problems.push([path, 'noindex в sitemap']);
}
for (const s of sitemap) if (!rows.find((r) => r.path === s)) problems.push([s, 'в sitemap, но страницы нет']);
for (const r of rows) {
  if (!r.inSitemap && !r.robots?.includes('noindex') && r.path !== '/404/') problems.push([r.path, 'индексируемая, но не в sitemap']);
  if (r.path !== '/' && !inbound.get(r.path)) problems.push([r.path, 'нет входящих ссылок']);
}
const dup = (k) => {
  const m = new Map();
  for (const r of rows) if (r[k]) m.set(r[k], [...(m.get(r[k]) ?? []), r.path]);
  for (const [v, ps] of m) if (ps.length > 1) problems.push([ps.join(', '), `одинаковый ${k}: ${v.slice(0, 80)}`]);
};
dup('title');
dup('description');
dup('ogImage');
const noLastmod = lastmods.filter((x) => !x.lastmod).map((x) => x.loc);
writeFileSync(process.argv[3], JSON.stringify({ rows, problems, sitemapCount: sitemap.length, noLastmod }, null, 2));
console.log(`pages ${rows.length}, sitemap ${sitemap.length}, problems ${problems.length}`);
const byKind = new Map();
for (const [p, k] of problems) {
  const kind = k.replace(/[:(].*/, '').trim();
  byKind.set(kind, [...(byKind.get(kind) ?? []), `${p} :: ${k}`]);
}
for (const [k, v] of byKind) {
  console.log(`\n## ${k} (${v.length})`);
  for (const x of v.slice(0, 12)) console.log('  ' + x);
}
console.log('\nбез lastmod в sitemap:', noLastmod.length);
