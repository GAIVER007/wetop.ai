import { SITE_CSS } from './theme';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from '../headers';
import { renderDraftPreview } from '../draft-preview';
import { LEAD_PATH } from '../assets';
import { structuredData, type SeoSettings } from '../seo';
import { ctx, DISH_IMAGE, MASTER_ID, verticalSpec } from '../test/fixtures';
import type { Section, SiteSpec } from '../types';
import { formatMoney, moneyDecimal } from './price-format';
import { renderPage } from './page';
import { renderSections } from './sections';

/** SITE-2: салон и ресторан рисуются тем же рантаймом; цены снимком, форма заявки без своего встроенного скрипта */
const SEO: SeoSettings = { indexable: true, canonicalOrigin: 'https://salon.example.test', sitemapOrigin: 'https://salon.example.test' };
const home = (spec: SiteSpec) => spec.pages.find((p) => p.isHome)!;
const sec = (spec: SiteSpec, type: string) => home(spec).sections.find((s) => s.type === type)! as Section;
const salonCtx = (patch: Parameters<typeof ctx>[0] = {}) => {
  const spec = patch.spec ?? verticalSpec('BEAUTY');
  return ctx({ spec, page: home(spec), facts: null, bookingLive: false, ...patch });
};
const cafeCtx = (patch: Parameters<typeof ctx>[0] = {}) => {
  const spec = patch.spec ?? verticalSpec('FOOD_SERVICE');
  return ctx({ spec, page: home(spec), facts: null, bookingLive: false, ...patch });
};
const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('цены снимком: minor units без float', () => {
  it('KZT: 800000 → 8 000 ₸, 550050 → 5 500,50 ₸', () => {
    expect(nbsp(formatMoney({ minor: '800000', currency: 'KZT' }, 'ru')!)).toBe('8 000 ₸');
    expect(nbsp(formatMoney({ minor: '550050', currency: 'KZT' }, 'ru')!)).toBe('5 500,50 ₸');
    expect(formatMoney({ minor: '1.5', currency: 'KZT' }, 'ru')).toBeNull();
    expect(formatMoney({ minor: '100', currency: 'kzt' }, 'ru')).toBeNull();
  });
  it('для schema.org десятичная строка', () => {
    expect(moneyDecimal({ minor: '250000', currency: 'KZT' })).toEqual({ price: '2500.00', currency: 'KZT' });
    expect(moneyDecimal({ minor: '5', currency: 'KZT' })).toEqual({ price: '0.05', currency: 'KZT' });
    expect(moneyDecimal({ minor: '1500', currency: 'JPY' })).toEqual({ price: '1500', currency: 'JPY' });
  });
});

describe('салон', () => {
  const html = nbsp(renderSections(salonCtx()));

  it('услуги по группам с длительностью и ценой, кнопка «Записаться» ведёт к форме', () => {
    expect(html).toContain('<h3 class="group-title">Ногти</h3>');
    expect(html).toContain('<h3>Маникюр</h3>');
    expect(html).toContain('<span>60 мин</span><strong class="price">8 000 ₸</strong>');
    expect(html).toContain('<strong class="price">5 500,50 ₸</strong>');
    expect(html).toContain('<a class="btn btn--ghost" href="#sec-form" data-book>Записаться</a>');
    // одна кнопка на весь список услуг, не у каждой строки (владелец 29.10.2026)
    const catalog = html.slice(html.indexOf('class="catalog"'));
    const list = catalog.slice(0, catalog.indexOf('</section>'));
    expect(list.match(/>Записаться</g)?.length).toBe(1);
    expect(list).not.toMatch(/<div class="item-side">(?:(?!<\/div>).)*<a class="btn/s);
    expect(list).toMatch(/<\/ul><div class="actions"><a class="btn btn--ghost" href="#sec-form" data-book>Записаться<\/a><\/div>/);
  });

  it('мастера карточками', () => {
    expect(html).toContain('<li class="card person"><h3>Мастер Айгерим</h3><p class="muted">Маникюр</p></li>');
  });

  it('форма записи: услуги и мастера документа, дата, время, имя, телефон, ловушка; отправка на /w/beauty/book', () => {
    expect(html).toContain('data-mode="BEAUTY_APPOINTMENT" data-endpoint="/w/beauty/book"');
    expect(html).toContain('<option value="svc-1">Маникюр</option>');
    expect(html).toContain(`<option value="${MASTER_ID}">Мастер Айгерим</option>`);
    expect(html).toContain('<option value="">Любой мастер</option>');
    expect(html).toMatch(/name="date" type="date" required/);
    expect(html).toMatch(/name="phone" type="tel"/);
    expect(html).toContain('<input name="website" type="text" tabindex="-1" autocomplete="off">');
    // ни одного встроенного скрипта и обработчика в разметке
    expect(html).not.toMatch(/<script|onsubmit|onclick/);
  });

  it('форма живая: скрыта до скрипта, запасная строка с телефоном видна', () => {
    expect(html).toMatch(/<form id="sec-form-form" class="lead-form" data-lead-form [^>]*hidden>/);
    expect(html).toContain('<div class="actions" data-lead-fallback="sec-form-form"><a class="btn" href="tel:+77000000001">');
  });

  it('часы: таблица с понедельника, только дни из данных', () => {
    expect(html).toContain('<tr><th scope="row">Понедельник</th><td>10:00–20:00</td></tr>');
    expect(html).toContain('<tr><th scope="row">Суббота</th><td>11:00–18:00</td></tr>');
    expect(html).not.toContain('Воскресенье');
  });

  it('коротко: одинаковые дни подряд одной строкой', () => {
    const spec = verticalSpec('BEAUTY');
    sec(spec, 'hours').variant = 'COMPACT';
    const out = renderSections(salonCtx({ spec }));
    expect(out).toContain('<li><b>Пн–Пт</b> 10:00–20:00</li><li><b>Сб</b> 11:00–18:00</li>');
  });

  it('страница: закреплённая кнопка и WhatsApp, скрипт формы своим файлом с ключом сайта', () => {
    const page = renderPage(salonCtx(), SEO, '/x.css');
    expect(page).toContain('<nav class="mobile-bar" aria-label="Быстрые действия"><a class="btn" href="#sec-form">Записаться</a><a class="btn btn--ghost" href="https://wa.me/77000000002" rel="noopener noreferrer">WhatsApp</a></nav>');
    expect(page).toContain(`<script defer src="${LEAD_PATH}" data-api="https://api.example.test" data-site="pms_0123456789ab" data-locale="ru"></script>`);
    expect(page).not.toContain('/w/widget.js');
    expect(page).toContain('class="p-calm a-graphite');
    expect(page).toContain('has-mobile-bar');
  });

  it('владелец 29.10.2026 «че так много кнопок записаться»: на телефоне одна закреплённая внизу, остальные помечены и скрыты', () => {
    const page = renderPage(salonCtx(), SEO, '/x.css');
    const marked = page.match(/<a class="btn[^"]*" href="[^"]*" data-book>/g) ?? [];
    // шапка, первый экран, услуги, полоса призыва: все ведут к той же форме и на телефоне дублируют нижнюю кнопку
    expect(marked.length).toBeGreaterThanOrEqual(2);
    expect(page).toContain('<nav class="mobile-bar" aria-label="Быстрые действия"><a class="btn" href="#sec-form">Записаться</a>');
    expect(SITE_CSS).toContain('@media (max-width:799px){body.has-mobile-bar a[data-book]{display:none}}');
  });

  it('без ключа сайта (превью, черновик): формы-скрипта нет, поля выключены, форма видна', () => {
    const page = renderPage(salonCtx({ publicKey: null }), SEO, '/x.css');
    expect(page).not.toContain(LEAD_PATH);
    expect(page).toMatch(/<form id="sec-form-form"[^>]*><fieldset disabled>/);
    expect(page).not.toMatch(/data-lead-form [^>]*hidden/);
  });

  it('schema.org: BeautySalon, часы работы и услуги с ценой', () => {
    const [business] = structuredData(salonCtx(), SEO) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(business!['@type']).toBe('BeautySalon');
    expect(business!['openingHoursSpecification'][0]).toEqual({ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Monday', opens: '10:00', closes: '20:00' });
    expect(business!['hasOfferCatalog'].itemListElement[0]).toEqual({ '@type': 'Offer', price: '8000.00', priceCurrency: 'KZT', itemOffered: { '@type': 'Service', name: 'Маникюр' } });
    expect(business!['telephone']).toBe('+77000000001');
  });

  it('CSP формы: свой файл, API и Turnstile; без unsafe-inline для скриптов', () => {
    const csp = contentSecurityPolicy({ apiOrigin: 'https://api.example.test', analytics: true, booking: false, lead: true });
    const scripts = csp.split('; ').find((d) => d.startsWith('script-src '))!;
    expect(scripts).toBe("script-src 'self' https://api.example.test https://challenges.cloudflare.com");
    expect(csp).toContain('frame-src https://challenges.cloudflare.com');
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });
});

describe('ресторан', () => {
  const html = nbsp(renderSections(cafeCtx()));

  it('меню по разделам: выход, цена из снимка', () => {
    expect(html).toContain('<h3 class="group-title">Супы</h3>');
    expect(html).toContain('<li class="row dish"><div><h4>Борщ</h4><span class="muted">300 г</span></div><strong class="price">2 500 ₸</strong></li>');
  });

  it('фото блюда только при showPhotos и с адресом из карты ассетов', () => {
    const spec = verticalSpec('FOOD_SERVICE');
    const menu = sec(spec, 'menu');
    ((menu['categories'] as Array<{ items: Array<Record<string, unknown>> }>)[0]!.items[0]!)['image'] = { assetId: DISH_IMAGE, alt: { ru: 'Борщ в тарелке' } };
    const withPhoto = renderSections(cafeCtx({ spec, assets: { [DISH_IMAGE]: 'https://img.example.test/a.webp' } }));
    expect(withPhoto).toContain('<img src="https://img.example.test/a.webp" alt="Борщ в тарелке" loading="lazy"');
    menu['showPhotos'] = false;
    expect(renderSections(cafeCtx({ spec, assets: { [DISH_IMAGE]: 'https://img.example.test/a.webp' } }))).not.toContain('<img');
  });

  it('форма брони стола: дата, время, число гостей; /w/food/reserve', () => {
    expect(html).toContain('data-mode="TABLE_RESERVATION" data-endpoint="/w/food/reserve"');
    expect(html).toMatch(/name="partySize" type="number" min="1" max="50"/);
    expect(html).not.toContain('name="serviceCode"');
  });

  it('schema.org: Restaurant с hasMenu (Menu, MenuSection, MenuItem с Offer)', () => {
    const [business] = structuredData(cafeCtx(), SEO) as Array<Record<string, any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(business!['@type']).toBe('Restaurant');
    expect(business!['hasMenu']['@type']).toBe('Menu');
    expect(business!['hasMenu'].hasMenuSection[0]).toEqual({
      '@type': 'MenuSection',
      name: 'Супы',
      hasMenuItem: [{ '@type': 'MenuItem', name: 'Борщ', offers: { '@type': 'Offer', price: '2500.00', priceCurrency: 'KZT' } }],
    });
    expect(business!['openingHoursSpecification']).toHaveLength(6);
  });
});

describe('экранирование XSS в новых секциях', () => {
  it('названия, мастер, раздел меню, подпись кнопки и коды не становятся разметкой', () => {
    const spec = verticalSpec('BEAUTY');
    const items = sec(spec, 'services')['items'] as Array<Record<string, unknown>>;
    items[0]!['title'] = { ru: '"><img src=x onerror=alert(1)>' };
    items[0]!['serviceCode'] = 'x"><script>alert(1)</script>';
    (sec(spec, 'staff')['items'] as Array<Record<string, unknown>>)[0]!['name'] = { ru: "</h3><script>alert('m')</script>" };
    sec(spec, 'leadForm')['submitLabel'] = { ru: '<b>Жми</b>' };
    const html = renderSections(salonCtx({ spec }));
    expect(html).not.toMatch(/<script|<img src=x|<b>Жми/);
    expect(html).toContain('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('value="x&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"');
    expect(html).toContain('&lt;b&gt;Жми&lt;/b&gt;');
  });

  it('JSON-LD: знак < в названии блюда не закрывает тег', () => {
    const spec = verticalSpec('FOOD_SERVICE');
    ((sec(spec, 'menu')['categories'] as Array<{ items: Array<Record<string, unknown>> }>)[0]!.items[0]!)['title'] = { ru: '</script><script>alert(1)</script>' };
    const page = renderPage(cafeCtx({ spec }), SEO, '/x.css');
    expect(page).not.toContain('</script><script>alert(1)');
    expect(page).toContain('\\u003c/script>');
  });
});

describe('превью редактора и стойки', () => {
  it('renderDraftPreview рисует салон без скриптов и с выключенной формой', () => {
    const r = renderDraftPreview({ spec: verticalSpec('BEAUTY'), pageId: null, locale: 'ru', assets: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.html).not.toMatch(/<script(?! type="application\/ld\+json")/);
    expect(r.html).toContain('<fieldset disabled>');
    expect(r.html).toContain('<style>');
  });
});
