import { describe, expect, it } from 'vitest';
import { ctx, exampleSpec, facts } from '../test/fixtures';
import { PRICES_PATH } from '../assets';
import { renderPage } from './page';
import { formatFromPrice, INTL_LOCALE, PRICE_LABEL } from './price-format';
import { PRICES_JS } from './prices-script';
import { renderSections } from './sections';
import { seoSettings } from '../seo';
import type { Section } from '../types';

/**
 * Q-276: цена «от» живая. В HTML страницы только места `data-from-price` (скрытые), число туда ставит скрипт WETOP по
 * ответу `/w/from-prices`. Секция `pricing` скрыта, пока скрипт не покажет хотя бы одну строку с ценой.
 */
const SEO = seoSettings('dev', null, 'http://stepnoy.localhost');
const home = (spec = exampleSpec()) => spec.pages.find((p) => p.isHome)!;
const section = (spec: ReturnType<typeof exampleSpec>, type: string) => home(spec).sections.find((s) => s.type === type)! as Section;
const nbsp = (s: string | null) => s?.replace(/[\u00a0\u202f]/g, ' ') ?? null;

describe('подпись цены: ru, kk, en', () => {
  it.each([
    ['ru', 'от 25 000 ₸ / ночь'],
    ['kk', '25 000 ₸ бастап / түн'],
    ['en', 'from ₸25,000 / night'],
  ] as const)('%s', (locale, text) => {
    expect(nbsp(formatFromPrice('2500000', 'KZT', INTL_LOCALE[locale], PRICE_LABEL[locale]))).toBe(text);
  });

  it('тиыны показываются, если они есть', () => {
    expect(nbsp(formatFromPrice('2500050', 'KZT', 'ru-RU', PRICE_LABEL.ru))).toBe('от 25 000,50 ₸ / ночь');
  });

  it.each([['abc'], [''], [null], ['-100'], ['1e9'], [2500000]])('не число %s: цены нет', (minor) => {
    expect(formatFromPrice(minor, 'KZT', 'ru-RU', PRICE_LABEL.ru)).toBeNull();
  });

  it('неверная валюта: цены нет', () => {
    expect(formatFromPrice('2500000', 'kzt', 'ru-RU', PRICE_LABEL.ru)).toBeNull();
    expect(formatFromPrice('2500000', null, 'ru-RU', PRICE_LABEL.ru)).toBeNull();
  });
});

describe('карточки номеров', () => {
  it('showFromPrice=true: скрытое место под цену, без числа в HTML', () => {
    const html = renderSections(ctx());
    expect(html).toContain('<p class="from-price" data-from-price="standard-double" hidden></p>');
    expect(html).not.toMatch(/₸|от \d/);
  });

  it('showFromPrice=false: места под цену нет', () => {
    const spec = exampleSpec();
    section(spec, 'accommodations')['showFromPrice'] = false;
    const html = renderSections(ctx({ spec, page: home(spec) }));
    const rooms = html.slice(html.indexOf('id="sec-rooms"'), html.indexOf('id="sec-amenities"'));
    expect(rooms).not.toContain('data-from-price');
  });

  it('цены не могут работать (бронь сайта выключена): места под цену нет', () => {
    expect(renderSections(ctx({ bookingLive: false }))).not.toContain('data-from-price');
  });
});

describe('секция pricing', () => {
  it('строки по категориям секции, скрыты до ответа цен; секция скрыта; названия из карточек номеров', () => {
    const html = renderSections(ctx());
    expect(html).toMatch(/<section id="sec-pricing" aria-labelledby="sec-pricing-title" class="pricing" data-price-section hidden>/);
    expect(html).toContain('<li class="row" data-price-row hidden>');
    expect(html).toContain('data-from-price="dorm-bed"');
    const titles = (section(exampleSpec(), 'accommodations')['items'] as Array<{ title: { ru: string } }>).map((i) => i.title.ru);
    for (const t of titles) expect(html).toContain(`<h3>${t}</h3>`);
  });

  it('неактивная категория (B-CATEGORY) строки не получает; все неактивны: секции нет', () => {
    const html = renderSections(ctx({ facts: facts({ categories: [{ code: 'standard-double', active: true, capacityAdults: 2 }, { code: 'dorm-bed', active: false }] }) }));
    const pricing = html.slice(html.indexOf('id="sec-pricing"'));
    expect(pricing).toContain('data-from-price="standard-double"');
    expect(pricing).not.toContain('data-from-price="dorm-bed"');
    expect(renderSections(ctx({ facts: facts({ categories: [] }) }))).not.toContain('sec-pricing');
  });

  it('название строки берётся из карточки размещения на другой странице; код категории как название не выводится', () => {
    const spec = exampleSpec();
    const rooms = section(spec, 'accommodations');
    const card = { ...(rooms['items'] as Array<Record<string, unknown>>)[0]!, categoryCode: 'pricing-only', title: { ru: 'Семейный номер' } };
    spec.pages.find((p) => !p.isHome)!.sections.push({ id: 'sec-rooms-more', type: 'accommodations', variant: 'ROWS', heading: rooms['heading'], items: [card] } as Section);
    (section(spec, 'pricing')['categoryCodes'] as string[]).push('pricing-only');
    const categories = [
      { code: 'standard-double', active: true, capacityAdults: 2 },
      { code: 'dorm-bed', active: true, capacityAdults: 1 },
      { code: 'pricing-only', active: true, capacityAdults: 3 },
    ];
    const html = renderSections(ctx({ spec, page: home(spec), facts: facts({ categories }) }));
    const pricing = html.slice(html.indexOf('id="sec-pricing"'));
    expect(pricing).toContain('data-from-price="pricing-only"');
    expect(pricing).toContain('<h3>Семейный номер</h3>');
    expect(pricing).not.toContain('<h3>pricing-only</h3>');
  });

  it('цены не могут работать: секции нет вовсе', () => {
    expect(renderSections(ctx({ bookingLive: false }))).not.toContain('sec-pricing');
  });

  it('пункт меню на секцию цен не выводится: до ответа цен она скрыта', () => {
    const spec = exampleSpec();
    spec.navigation.header.push({ label: { ru: 'Цены' }, target: { kind: 'SECTION', pageId: 'page-home', sectionId: 'sec-pricing' } });
    expect(renderPage(ctx({ spec, page: home(spec) }), SEO, '/x.css')).not.toContain('href="#sec-pricing"');
  });
});

describe('скрипт цен на странице', () => {
  it('внешний файл WETOP с ключом, адресом API, языком и подписью; без встроенного скрипта', () => {
    const html = renderPage(ctx(), SEO, '/x.css');
    expect(html).toContain(
      `<script defer src="${PRICES_PATH}" data-api="https://api.example.test" data-site="pms_0123456789ab" data-locale="ru-RU" data-label="от {price} / ночь"></script>`,
    );
  });

  it('на странице без мест под цену скрипта нет', () => {
    const spec = exampleSpec();
    const privacy = spec.pages.find((p) => !p.isHome)!;
    expect(renderPage(ctx({ spec, page: privacy }), SEO, '/x.css')).not.toContain(PRICES_PATH);
  });

  it('скрипт ходит только в /w/from-prices, цену не кэширует и подставляет её через ту же функцию формата', () => {
    expect(PRICES_JS).toContain("'/w/from-prices?k='");
    expect(PRICES_JS).not.toMatch(/localStorage|sessionStorage|caches\./);
    expect(PRICES_JS).toContain('function formatFromPrice');
    expect(() => new Function(PRICES_JS)).not.toThrow();
  });
});
