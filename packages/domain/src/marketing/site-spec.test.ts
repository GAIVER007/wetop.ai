/* eslint-disable @typescript-eslint/no-explicit-any -- тест портит пример документа по путям, строгий тип там только мешает */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SITE_SPEC_MAX_BYTES,
  canonicalJson,
  parseMarketingSlug,
  siteSpecHash,
  validateSiteSpec,
} from './index';

/**
 * MKT3: проверка `SiteSpec` v0 по `docs/marketing/sitespec-v0.md` §11. Корректный документ это пример из
 * `docs/marketing/sitespec-v0.example.json`; каждый тест портит одну вещь и ждёт отказа с путём к месту.
 */
const EXAMPLE = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../docs/marketing/sitespec-v0.example.json'), 'utf8'),
) as Record<string, any>;
const spec = (): Record<string, any> => structuredClone(EXAMPLE);
const home = (s: Record<string, any>) => s.pages.find((p: any) => p.isHome);
const section = (s: Record<string, any>, type: string) =>
  s.pages.flatMap((p: any) => p.sections).find((x: any) => x.type === type);

function errorsOf(input: unknown) {
  const result = validateSiteSpec(input);
  expect(result.ok, 'документ должен быть отклонён').toBe(false);
  return result.ok ? [] : result.errors;
}
function rejects(input: unknown, path: string | RegExp, code?: string) {
  const errors = errorsOf(input);
  const hit = errors.find((e) => (typeof path === 'string' ? e.path === path : path.test(e.path)));
  expect(hit, `нет ошибки по пути ${path}: ${JSON.stringify(errors)}`).toBeDefined();
  if (code) expect(hit!.code).toBe(code);
}

describe('SiteSpec v0: корректный документ', () => {
  it('пример из контракта принимается целиком', () => {
    const result = validateSiteSpec(spec());
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

describe('SiteSpec v0: отказы', () => {
  it('неизвестная версия схемы', () => {
    rejects({ ...spec(), schemaVersion: 'site-spec/1' }, 'schemaVersion', 'unknown_schema_version');
    rejects({ ...spec(), schemaVersion: undefined }, 'schemaVersion');
  });

  it('не объект', () => {
    expect(validateSiteSpec(null).ok).toBe(false);
    expect(validateSiteSpec([]).ok).toBe(false);
    expect(validateSiteSpec('site').ok).toBe(false);
  });

  it('неизвестный тип и вариант секции', () => {
    const s = spec();
    home(s).sections[1].type = 'html';
    rejects(s, /^pages\[0\]\.sections\[1\]\.type$/, 'unknown_section');
    const v = spec();
    section(v, 'faq').variant = 'CAROUSEL';
    rejects(v, /\.variant$/);
  });

  it('лишние поля отклоняются на любом уровне, включая поля с кодом и идентификаторы владельца', () => {
    rejects({ ...spec(), script: 'alert(1)' }, 'script', 'unknown_field');
    const s = spec();
    s.site.organizationId = '11111111-1111-4111-8111-111111111111';
    rejects(s, 'site.organizationId', 'unknown_field');
    const t = spec();
    t.theme.css = 'body{color:red}';
    rejects(t, 'theme.css', 'unknown_field');
    const h = spec();
    section(h, 'faq').onClick = 'steal()';
    rejects(h, /\.onClick$/, 'unknown_field');
    const c = spec();
    section(c, 'about').html = '<b>x</b>';
    rejects(c, /\.html$/, 'unknown_field');
  });

  it('словари темы не принимают произвольных значений', () => {
    const s = spec();
    s.theme.accent = '#ff0000';
    rejects(s, 'theme.accent');
  });

  it('текст на языках: нет языка по умолчанию, чужой язык, пусто, длина, разметка, шаблон', () => {
    const missing = spec();
    missing.site.displayName = { en: 'Steppe Wind' };
    rejects(missing, /^site\.displayName/);
    const foreign = spec();
    foreign.site.displayName = { ru: 'Ветер', en: 'Wind' };
    rejects(foreign, 'site.displayName.en', 'locale_not_enabled');
    const empty = spec();
    empty.site.displayName = { ru: '   ' };
    rejects(empty, 'site.displayName.ru');
    const long = spec();
    long.site.displayName = { ru: 'я'.repeat(81) };
    rejects(long, 'site.displayName.ru', 'too_long');
    const markup = spec();
    section(markup, 'about').paragraphs[0] = { ru: 'Привет <script>alert(1)</script>' };
    rejects(markup, /paragraphs\[0\]\.ru$/, 'markup');
    const handler = spec();
    section(handler, 'about').heading = { ru: '<img src=x onerror=alert(1)>' };
    rejects(handler, /\.heading\.ru$/, 'markup');
    const template = spec();
    section(template, 'about').heading = { ru: 'Привет {{user}}' };
    rejects(template, /\.heading\.ru$/, 'template');
    const dollar = spec();
    section(dollar, 'about').heading = { ru: 'Привет ${user}' };
    rejects(dollar, /\.heading\.ru$/, 'template');
    const notObject = spec();
    notObject.site.displayName = 'Ветер';
    rejects(notObject, 'site.displayName');
  });

  it('повтор идентификаторов страниц и секций', () => {
    const pages = spec();
    pages.pages[1].id = pages.pages[0].id;
    rejects(pages, /^pages\[1\]\.id$/, 'duplicate_id');
    const sections = spec();
    home(sections).sections[1].id = home(sections).sections[0].id;
    rejects(sections, /sections\[1\]\.id$/, 'duplicate_id');
    const across = spec();
    across.pages[1].sections[0].id = home(across).sections[0].id;
    rejects(across, /^pages\[1\]\.sections\[0\]\.id$/, 'duplicate_id');
  });

  it('внутренние ссылки: страница, секция, контакт для действия', () => {
    const page = spec();
    page.navigation.footer[0].target.pageId = 'page-missing';
    rejects(page, 'navigation.footer[0].target.pageId', 'unknown_reference');
    const sectionRef = spec();
    sectionRef.navigation.header[0].target.sectionId = 'sec-missing';
    rejects(sectionRef, 'navigation.header[0].target.sectionId', 'unknown_reference');
    const phone = spec();
    delete phone.site.contacts.phone;
    phone.navigation.headerCta = { label: { ru: 'Позвонить' }, action: { kind: 'PHONE' } };
    rejects(phone, 'navigation.headerCta.action', 'missing_contact');
    const privacy = spec();
    privacy.site.legal.privacyPageId = 'page-missing';
    rejects(privacy, 'site.legal.privacyPageId', 'unknown_reference');
  });

  it('страницы: ровно одна главная с пустым адресом, адреса уникальны и не зарезервированы', () => {
    const twoHomes = spec();
    twoHomes.pages[1].isHome = true;
    rejects(twoHomes, 'pages', 'home_page');
    const homeSlug = spec();
    home(homeSlug).slug = 'main';
    rejects(homeSlug, /^pages\[\d+\]\.slug$/);
    const reserved = spec();
    reserved.pages[1].slug = 'api';
    rejects(reserved, 'pages[1].slug', 'reserved_slug');
    const dup = spec();
    dup.pages.push({ ...structuredClone(dup.pages[1]), id: 'page-copy', sections: [] });
    dup.pages[2].sections = [{ ...structuredClone(dup.pages[1].sections[0]), id: 'sec-copy' }];
    rejects(dup, 'pages[2].slug', 'duplicate_slug');
  });

  it('документ больше 256 КБ', () => {
    const s = spec();
    const faq = section(s, 'faq');
    faq.items = Array.from({ length: 30 }, (_, i) => ({
      question: { ru: `Вопрос ${i}` },
      answer: { ru: 'ж'.repeat(1000) },
    }));
    for (let i = 0; i < 6; i++)
      s.pages.push({
        ...structuredClone(s.pages[1]),
        id: `page-big-${i}`,
        slug: `big-${i}`,
        sections: [{ ...structuredClone(faq), id: `sec-big-${i}` }],
      });
    expect(Buffer.byteLength(canonicalJson(s), 'utf8')).toBeGreaterThan(SITE_SPEC_MAX_BYTES);
    rejects(s, '', 'too_large');
  });

  it('адреса: только https без логина, порта, IP и localhost; javascript: и data: не проходят', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://example.com',
      'https://user:pass@example.com',
      'https://example.com:8443/',
      'https://127.0.0.1/',
      'https://localhost/',
    ]) {
      const s = spec();
      s.navigation.footer.push({ label: { ru: 'Внешняя' }, target: { kind: 'EXTERNAL', url } });
      rejects(s, /^navigation\.footer\[\d+\]\.target\.url$/, 'invalid_url');
    }
    const social = spec();
    social.site.contacts.social[0].url = 'https://evil.example/stepnoy';
    rejects(social, 'site.contacts.social[0].url', 'social_host');
  });

  it('бронь: секция требует виджет WETOP, одна на странице, заголовок обязателен', () => {
    const off = spec();
    off.integrations.booking.mode = 'NONE';
    rejects(off, /\.sections\[\d+\]$/, 'booking_disabled');
    const two = spec();
    const booking = section(two, 'booking');
    home(two).sections.push({ ...structuredClone(booking), id: 'sec-booking-2' });
    rejects(two, /\.sections\[\d+\]$/, 'duplicate_booking');
    const noHeading = spec();
    delete section(noHeading, 'booking').heading;
    rejects(noHeading, /\.heading$/, 'required');
    const variant = spec();
    section(variant, 'booking').variant = 'POPUP';
    rejects(variant, /\.variant$/);
  });

  it('первая секция героя: только одна и только первой', () => {
    const second = spec();
    const hero = section(second, 'hero');
    home(second).sections.push({ ...structuredClone(hero), id: 'sec-hero-2' });
    rejects(second, /\.sections\[\d+\]$/, 'hero_position');
  });

  it('SEO: шаблон заголовка с одним %s, карта сайта без индекса запрещена, robots и canonical из словаря', () => {
    const none = spec();
    none.site.seo.titleTemplate = { ru: 'Гостиница' };
    rejects(none, 'site.seo.titleTemplate.ru', 'title_template');
    const twice = spec();
    twice.site.seo.titleTemplate = { ru: '%s и %s' };
    rejects(twice, 'site.seo.titleTemplate.ru', 'title_template');
    const sitemap = spec();
    home(sitemap).seo.index = false;
    home(sitemap).seo.includeInSitemap = true;
    rejects(sitemap, /seo\.includeInSitemap$/, 'sitemap_noindex');
    const robots = spec();
    robots.site.seo.robots = 'ALL';
    rejects(robots, 'site.seo.robots');
    const canonical = spec();
    home(canonical).seo.canonical = 'https://other.example/';
    rejects(canonical, /seo\.canonical$/);
    const description = spec();
    home(description).seo.description = { ru: 'о'.repeat(161) };
    rejects(description, /seo\.description\.ru$/, 'too_long');
  });

  it('направление v0 только Hospitality', () => {
    const s = spec();
    s.site.vertical = 'BEAUTY';
    rejects(s, 'site.vertical');
  });

  it('ассет: только форма UUID (наличие ассета проверит MKT8)', () => {
    const s = spec();
    s.site.brand.logo.assetId = 'logo.png';
    rejects(s, 'site.brand.logo.assetId', 'invalid_asset_id');
  });
});

describe('SiteSpec v0: категория в секции цен ссылается на карточку размещения', () => {
  const allCardCodes = (s: Record<string, any>) =>
    s.pages
      .flatMap((p: any) => p.sections)
      .filter((x: any) => x.type === 'accommodations')
      .flatMap((x: any) => x.items.map((i: any) => i.categoryCode));

  it('код цены без карточки размещения отклоняется: название строки взять негде', () => {
    const s = spec();
    expect(allCardCodes(s)).not.toContain('pricing-only');
    section(s, 'pricing').categoryCodes.push('pricing-only');
    rejects(s, 'pages[0].sections[5].categoryCodes[2]', 'pricing_category_without_card');
  });

  it('карточка с тем же кодом на другой странице документа делает его корректным', () => {
    const s = spec();
    section(s, 'pricing').categoryCodes.push('pricing-only');
    const card = structuredClone(section(s, 'accommodations').items[0]);
    card.categoryCode = 'pricing-only';
    const rooms = section(s, 'accommodations');
    s.pages[1].sections.push({ id: 'sec-rooms-more', type: 'accommodations', variant: 'ROWS', heading: rooms.heading, items: [card] });
    const result = validateSiteSpec(s);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});

describe('каноническая запись и хэш', () => {
  it('порядок ключей не влияет, в том числе во вложенных объектах', () => {
    const a = { b: 1, a: { d: [1, 2], c: 'x' } };
    const b = { a: { c: 'x', d: [1, 2] }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"a":{"c":"x","d":[1,2]},"b":1}');
    expect(siteSpecHash(a)).toBe(siteSpecHash(b));
  });

  it('порядок массивов влияет', () => {
    expect(siteSpecHash({ a: [1, 2] })).not.toBe(siteSpecHash({ a: [2, 1] }));
  });

  it('Юникод записывается детерминированно', () => {
    expect(canonicalJson({ t: 'Степной ветер ✓', e: 'é' })).toBe('{"e":"é","t":"Степной ветер ✓"}');
    expect(siteSpecHash({ t: 'ветер' })).toBe(siteSpecHash(JSON.parse('{"t":"ветер"}')));
  });

  it('ключи упорядочены по кодовым точкам, не по языку', () => {
    expect(canonicalJson({ b: 1, B: 2, a: 3 })).toBe('{"B":2,"a":3,"b":1}');
  });

  it('хэш: 64 символа нижнего регистра, меняется вместе со значением', () => {
    const hash = siteSpecHash(spec());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(siteSpecHash(spec())).toBe(hash);
    const changed = spec();
    changed.site.displayName.ru += '!';
    expect(siteSpecHash(changed)).not.toBe(hash);
  });
});

describe('адрес сайта (slug)', () => {
  it('нормальный адрес принимается в нижнем регистре и без пробелов по краям', () => {
    expect(parseMarketingSlug('  Stepnoy-Veter ')).toEqual({ ok: true, slug: 'stepnoy-veter' });
    expect(parseMarketingSlug('abc')).toEqual({ ok: true, slug: 'abc' });
  });
  it.each([
    ['ab', 'короче трёх знаков'],
    ['-abc', 'начинается с дефиса'],
    ['abc-', 'кончается дефисом'],
    ['ab c', 'пробел'],
    ['ветер', 'не латиница'],
    ['a'.repeat(41), 'длиннее 40'],
  ])('%s отклоняется (%s)', (raw) => {
    expect(parseMarketingSlug(raw).ok).toBe(false);
  });
  it.each(['www', 'app', 'api', 'admin', 'wetop', 'preview', 'support'])(
    'зарезервированный %s отклоняется',
    (raw) => {
      expect(parseMarketingSlug(raw)).toMatchObject({ ok: false, code: 'reserved_slug' });
    },
  );
  it('не строка отклоняется', () => {
    expect(parseMarketingSlug(42).ok).toBe(false);
  });
});
