import { describe, expect, it } from 'vitest';
import { SITE_SPEC_SECTIONS } from '@pms/domain';
import { ctx, exampleSpec, facts } from '../test/fixtures';
import { RenderError } from './context';
import { renderSections, SECTION_RENDERERS } from './sections';
import type { Section } from '../types';

const home = (spec = exampleSpec()) => spec.pages.find((p) => p.isHome)!;
const section = (type: string, spec = exampleSpec()) => home(spec).sections.find((s) => s.type === type)! as Section;

describe('реестр рендереров совпадает с реестром валидатора SiteSpec v0', () => {
  it('у каждого типа и варианта валидатора есть рендерер, лишних нет', () => {
    const runtime = Object.fromEntries(Object.entries(SECTION_RENDERERS).map(([type, v]) => [type, Object.keys(v).sort()]));
    const validator = Object.fromEntries(Object.entries(SITE_SPEC_SECTIONS).map(([type, v]) => [type, [...v].sort()]));
    expect(runtime).toEqual(validator);
  });
});

describe('незнакомая секция или вариант: отказ, а не «как получится»', () => {
  it.each([
    ['тип', { type: 'iframe', variant: 'RAW' }],
    ['вариант', { type: 'hero', variant: 'VIDEO' }],
    ['тип из прототипа', { type: 'constructor', variant: 'TEXT_ONLY' }],
  ])('%s', (_label, patch) => {
    const spec = exampleSpec();
    home(spec).sections.push({ id: 'x', heading: { ru: 'x' }, ...patch } as Section);
    expect(() => renderSections(ctx({ spec, page: home(spec) }))).toThrow(RenderError);
  });
});

describe('каждая секция примера', () => {
  const html = renderSections(ctx());

  it('один H1: заголовок первой секции hero', () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<h1 id="sec-hero-title">Тихие номера у вокзала</h1>');
  });

  it.each(['sec-hero', 'sec-about', 'sec-features', 'sec-rooms', 'sec-amenities', 'sec-booking', 'sec-faq', 'sec-contacts', 'sec-cta'])(
    'секция %s выводится с якорем и подписанным заголовком',
    (id) => {
      expect(html).toContain(`<section id="${id}" aria-labelledby="${id}-title"`);
    },
  );

  it('pricing скрыт до Q-276: цены «от» в HTML нет', () => {
    expect(html).not.toContain('sec-pricing');
    expect(html).not.toMatch(/₸|тенге|от \d/);
  });

  it('gallery скрыта: SiteAsset нет, картинок нет вовсе', () => {
    expect(html).not.toContain('sec-gallery');
    expect(html).not.toContain('<img');
  });

  it('accommodations: живая вместимость из publicFacts', () => {
    expect(html).toContain('До 2 гостей');
    expect(html).toContain('До 1 гостя');
  });

  it('booking: строка заезда и выезда из publicFacts, точка монтирования виджета', () => {
    expect(html).toContain('Заезд с 14:00, выезд до 12:00');
    expect(html).toContain('<div id="pms-booking"></div>');
  });

  it('faq ACCORDION на details без скриптов', () => {
    expect(html).toContain('<details><summary>');
  });

  it('contacts: телефон, WhatsApp, почта и ссылка на OpenStreetMap', () => {
    expect(html).toContain('href="tel:+77010000000"');
    expect(html).toContain('href="https://wa.me/77010000000" rel="noopener noreferrer"');
    expect(html).toContain('href="mailto:hello@stepnoy-veter.example"');
    expect(html).toContain('https://www.openstreetmap.org/?mlat=51.1694&amp;mlon=71.4491');
  });

  it('features и amenities: значки из словаря WETOP, aria-hidden', () => {
    expect(html).toMatch(/<svg class="icon"[^>]*aria-hidden="true"/);
  });

  it('кнопка BOOK ведёт к секции брони этой страницы', () => {
    expect(html).toContain('href="#sec-booking"');
  });
});

describe('живые данные: неактивная категория и сбой фактов', () => {
  it('неактивная или неизвестная категория прячет карточку', () => {
    const html = renderSections(
      ctx({ facts: facts({ categories: [{ code: 'standard-double', active: true, capacityAdults: 2 }, { code: 'dorm-bed', active: false }] }) }),
    );
    expect(html).toContain('До 2 гостей');
    expect(html).not.toContain('До 1 гостя');
    const rooms = section('accommodations');
    const titles = (rooms['items'] as Array<{ title: { ru: string } }>).map((i) => i.title.ru);
    expect(html).toContain(titles[0]);
    expect(html).not.toContain(titles[1]);
  });

  it('все категории неактивны: секция номеров скрыта целиком', () => {
    const html = renderSections(ctx({ facts: facts({ categories: [] }) }));
    expect(html).not.toContain('sec-rooms');
  });

  it('факты не загрузились: карточки из снимка остаются, живая вместимость и время заезда скрыты', () => {
    const html = renderSections(ctx({ facts: null }));
    expect(html).toContain('sec-rooms');
    expect(html).not.toMatch(/До \d+ гост/);
    expect(html).not.toContain('Заезд с');
  });
});

describe('бронь не работает: формы нет, есть телефон', () => {
  it('bookingLive false', () => {
    const html = renderSections(ctx({ bookingLive: false }));
    expect(html).not.toContain('pms-booking');
    expect(html).toContain('Онлайн-бронирование сейчас недоступно.');
    expect(html).toContain('<a class="btn" href="tel:+77010000000">Позвоните нам</a>');
  });
});

describe('экранирование: текст документа не становится разметкой', () => {
  it('кавычки, амперсанд и знак меньше в тексте и атрибутах', () => {
    const spec = exampleSpec();
    const hero = section('hero', spec);
    hero.heading = { ru: `Тест "кавычек" & 'апострофа' < 3 > 2` };
    const about = section('about', spec);
    about['paragraphs'] = [{ ru: 'a < b && c > d "x"' }];
    const html = renderSections(ctx({ spec, page: home(spec) }));
    expect(html).toContain('Тест &quot;кавычек&quot; &amp; &#39;апострофа&#39; &lt; 3 &gt; 2');
    expect(html).toContain('a &lt; b &amp;&amp; c &gt; d &quot;x&quot;');
  });

  it('внешний адрес не https в ссылке не выводится', () => {
    const spec = exampleSpec();
    const cta = section('cta', spec);
    cta['action'] = { label: { ru: 'Опасно' }, action: { kind: 'EXTERNAL', url: 'javascript:alert(1)' } };
    const html = renderSections(ctx({ spec, page: home(spec) }));
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('Опасно');
  });

  it('незнакомый значок: отказ', () => {
    const spec = exampleSpec();
    (section('features', spec)['items'] as Array<Record<string, unknown>>)[0]!['icon'] = 'SKULL';
    expect(() => renderSections(ctx({ spec, page: home(spec) }))).toThrow();
  });
});

describe('страница без hero: H1 из заголовка страницы', () => {
  it('privacy', () => {
    const spec = exampleSpec();
    const page = spec.pages.find((p) => !p.isHome)!;
    const html = renderSections(ctx({ spec, page }));
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(`<h1 class="page-title">${page.title.ru}</h1>`);
  });
});
