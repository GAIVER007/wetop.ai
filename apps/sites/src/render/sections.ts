import type { Cta, LocalizedText, Section } from '../types';
import {
  actionHref,
  pricingRows,
  RenderError,
  resolvedImages,
  sectionVisible,
  visibleCards,
  type RenderContext,
} from './context';
import { icon } from './icons';
import { esc, mailHref, phoneHref, tx, ui, whatsappHref } from './text';

type Renderer = (section: Section, ctx: RenderContext, opts: { h1: boolean }) => string;

const t = (value: unknown, ctx: RenderContext) => esc(tx(value as LocalizedText | undefined, ctx.locale));
const heading = (section: Section, ctx: RenderContext, h1: boolean) =>
  `<${h1 ? 'h1' : 'h2'} id="${esc(section.id)}-title">${t(section.heading, ctx)}</${h1 ? 'h1' : 'h2'}>`;
const open = (section: Section, extra = '') =>
  `<section id="${esc(section.id)}" aria-labelledby="${esc(section.id)}-title"${extra}><div class="wrap">`;
const close = '</div></section>';
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function ctaLink(cta: Cta | undefined, ctx: RenderContext, ghost = false): string {
  if (!cta) return '';
  const target = actionHref(cta.action, ctx);
  if (!target) return '';
  const rel = target.external ? ' rel="noopener noreferrer"' : '';
  return `<a class="btn${ghost ? ' btn--ghost' : ''}" href="${esc(target.href)}"${rel}>${t(cta.label, ctx)}</a>`;
}

/** Картинка только с подписанным адресом из карты ассетов (MKT8); адреса нет, нет и картинки */
function image(ref: unknown, ctx: RenderContext, eager = false): string {
  const [img] = resolvedImages(ref ? [ref] : [], ctx.assets);
  if (!img) return '';
  return `<img src="${esc(img.src)}" alt="${t(img.alt, ctx)}"${eager ? '' : ' loading="lazy"'} decoding="async">`;
}

const hero: Renderer = (s, ctx, { h1 }) => {
  const sub = s['subheading'] ? `<p class="lead">${t(s['subheading'], ctx)}</p>` : '';
  const actions = [ctaLink(s['primaryAction'] as Cta, ctx), ctaLink(s['secondaryAction'] as Cta | undefined, ctx, true)]
    .filter(Boolean)
    .join('');
  return `${open(s, ' class="hero"')}${heading(s, ctx, h1)}${sub}${actions ? `<div class="actions">${actions}</div>` : ''}${image(s['image'], ctx, true)}${close}`;
};

const about: Renderer = (s, ctx, { h1 }) =>
  `${open(s)}${heading(s, ctx, h1)}${list(s['paragraphs']).map((p) => `<p>${t(p, ctx)}</p>`).join('')}${image(s['image'], ctx)}${close}`;

const features: Renderer = (s, ctx, { h1 }) => {
  const items = list<Record<string, unknown>>(s['items'])
    .map((i) => `<li class="card item">${icon(i['icon'])}<div><h3>${t(i['title'], ctx)}</h3><p class="muted">${t(i['text'], ctx)}</p></div></li>`)
    .join('');
  const cls = s.variant === 'GRID' ? 'list grid' : 'list';
  return `${open(s)}${heading(s, ctx, h1)}<ul class="${cls}">${items}</ul>${close}`;
};

const accommodations: Renderer = (s, ctx, { h1 }) => {
  const showCapacity = s['showLiveCapacity'] === true;
  const cards = visibleCards(s, ctx.facts)
    .map((item) => {
      const fact = ctx.facts?.categories.find((c) => c.code === item['categoryCode']);
      const capacity =
        showCapacity && fact?.active && typeof fact.capacityAdults === 'number'
          ? `<p class="muted">${esc(ui(ctx.locale).capacity(fact.capacityAdults))}</p>`
          : '';
      const highlights = list(item['highlights']);
      const chips = highlights.length ? `<ul class="chips">${highlights.map((h) => `<li>${t(h, ctx)}</li>`).join('')}</ul>` : '';
      const pics = resolvedImages(item['images'], ctx.assets)
        .map((img) => `<img src="${esc(img.src)}" alt="${t(img.alt, ctx)}" loading="lazy" decoding="async">`)
        .join('');
      // B-FROMPRICE (Q-276): в HTML только скрытое место, число ставит скрипт цен по живому ответу API
      const price =
        s['showFromPrice'] === true && ctx.bookingLive ? fromPricePlace(String(item['categoryCode'])) : '';
      const action = ctaLink((s['itemAction'] as Cta | undefined) ?? { label: { [ctx.locale]: ui(ctx.locale).book }, action: { kind: 'BOOK' } }, ctx);
      const body = `${pics}<h3>${t(item['title'], ctx)}</h3><p>${t(item['description'], ctx)}</p>${capacity}${price}${chips}${action ? `<div class="actions">${action}</div>` : ''}`;
      return s.variant === 'ROWS' ? `<li class="row"><div>${body}</div></li>` : `<li class="card">${body}</li>`;
    })
    .join('');
  const cls = s.variant === 'ROWS' ? 'list' : 'list grid';
  return `${open(s)}${heading(s, ctx, h1)}<ul class="${cls}">${cards}</ul>${close}`;
};

const amenities: Renderer = (s, ctx, { h1 }) => {
  const items = list<Record<string, unknown>>(s['items'])
    .map((i) => {
      const note = i['note'] ? `<br><span class="muted">${t(i['note'], ctx)}</span>` : '';
      return `<li class="item">${icon(i['icon'])}<span>${t(i['label'], ctx)}${note}</span></li>`;
    })
    .join('');
  return `${open(s)}${heading(s, ctx, h1)}<ul class="list list--cols">${items}</ul>${close}`;
};

/** Скрытое место под цену «от»: число ставит только скрипт цен, в HTML его нет никогда */
const fromPricePlace = (code: string) => `<p class="from-price" data-from-price="${esc(code)}" hidden></p>`;

/**
 * `pricing` (Q-276): строки категорий с живой ценой. Секция и строки скрыты в HTML; скрипт цен показывает строку, когда
 * пришла её цена, и секцию, когда видна хотя бы одна строка. Ответа нет: секция остаётся скрытой.
 */
const pricing: Renderer = (s, ctx, { h1 }) => {
  const action = ctaLink({ label: { [ctx.locale]: ui(ctx.locale).book }, action: { kind: 'BOOK' } }, ctx);
  const rows = pricingRows(s, ctx)
    .map(
      (row) =>
        `<li class="row" data-price-row hidden><div><h3>${t(row.title, ctx)}</h3>${fromPricePlace(row.code)}</div>${action ? `<div>${action}</div>` : ''}</li>`,
    )
    .join('');
  const note = s['note'] ? `<p class="muted">${t(s['note'], ctx)}</p>` : '';
  return `${open(s, ' class="pricing" data-price-section hidden')}${heading(s, ctx, h1)}<ul class="list">${rows}</ul>${note}${close}`;
};

const gallery: Renderer = (s, ctx, { h1 }) => {
  const imgs = resolvedImages(s['images'], ctx.assets)
    .map((img) => `<li><img src="${esc(img.src)}" alt="${t(img.alt, ctx)}" loading="lazy" decoding="async"></li>`)
    .join('');
  return `${open(s)}${heading(s, ctx, h1)}<ul class="list grid">${imgs}</ul>${close}`;
};

function checkInOut(ctx: RenderContext): string {
  const from = ctx.facts?.checkInTime;
  const to = ctx.facts?.checkOutTime;
  const strings = ui(ctx.locale);
  if (!from && !to) return '';
  const parts = [from ? strings.checkIn(from) : '', to ? strings.checkOut(to) : ''].filter(Boolean).join(', ');
  return `<p class="muted">${esc(parts.charAt(0).toUpperCase() + parts.slice(1))}</p>`;
}

const booking: Renderer = (s, ctx, { h1 }) => {
  const note = s['note'] ? `<p class="booking-note">${t(s['note'], ctx)}</p>` : '';
  const times = s['showCheckInOut'] === true ? checkInOut(ctx) : '';
  let body: string;
  if (ctx.bookingLive) {
    // точка монтирования виджета: сам виджет и его запросы `/w/*` идут из браузера прямо в API, рантайм их не проксирует
    body = '<div id="pms-booking"></div>';
  } else {
    const phone = phoneHref(ctx.spec.site.contacts?.phone);
    const strings = ui(ctx.locale);
    body = `<p>${esc(strings.bookingUnavailable)}</p>${phone ? `<p><a class="btn" href="${esc(phone)}">${esc(strings.callUs)}</a></p>` : ''}`;
  }
  return `${open(s)}${heading(s, ctx, h1)}${times}${note}${body}${close}`;
};

const contacts: Renderer = (s, ctx, { h1 }) => {
  const c = ctx.spec.site.contacts ?? {};
  const strings = ui(ctx.locale);
  const rows: string[] = [];
  const phone = phoneHref(c.phone);
  if (s['showPhone'] === true && phone) rows.push(`<li>${esc(strings.phone)}: <a href="${esc(phone)}">${esc(c.phone!)}</a></li>`);
  const wa = whatsappHref(c.whatsapp);
  if (s['showWhatsapp'] === true && wa)
    rows.push(`<li>${esc(strings.whatsapp)}: <a href="${esc(wa)}" rel="noopener noreferrer">${esc(c.whatsapp!)}</a></li>`);
  const mail = mailHref(c.email);
  if (s['showEmail'] === true && mail) rows.push(`<li>${esc(strings.email)}: <a href="${esc(mail)}">${esc(c.email!)}</a></li>`);
  if (s['showAddress'] === true && c.address) rows.push(`<li>${esc(strings.address)}: ${t(c.address, ctx)}</li>`);
  if (s.variant === 'WITH_MAP' && s['map'] && c.geo) {
    const { lat, lng } = c.geo;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
      rows.push(`<li><a href="${esc(href)}" rel="noopener noreferrer">${esc(strings.map)}</a></li>`);
    }
  }
  const directions = s['directions'] ? `<p>${t(s['directions'], ctx)}</p>` : '';
  return `${open(s)}${heading(s, ctx, h1)}${rows.length ? `<ul class="contact-list">${rows.join('')}</ul>` : ''}${directions}${close}`;
};

const faq: Renderer = (s, ctx, { h1 }) => {
  const items = list<Record<string, unknown>>(s['items']);
  const body =
    s.variant === 'ACCORDION'
      ? items.map((i) => `<details><summary>${t(i['question'], ctx)}</summary><p>${t(i['answer'], ctx)}</p></details>`).join('')
      : items.map((i) => `<h3>${t(i['question'], ctx)}</h3><p>${t(i['answer'], ctx)}</p>`).join('');
  return `${open(s, ' class="faq"')}${heading(s, ctx, h1)}${body}${close}`;
};

const cta: Renderer = (s, ctx, { h1 }) => {
  const text = s['text'] ? `<p>${t(s['text'], ctx)}</p>` : '';
  const action = ctaLink(s['action'] as Cta, ctx);
  return `${open(s, ' class="cta-band"')}${heading(s, ctx, h1)}${text}${action ? `<div class="actions">${action}</div>` : ''}${image(s['image'], ctx)}${close}`;
};

/**
 * Явный реестр рендереров: тип → вариант → функция. Ни `eval`, ни импорта по строке из документа. Тест сверяет реестр
 * с реестром валидатора `SITE_SPEC_SECTIONS`; незнакомый тип или вариант это `RenderError`, то есть 503.
 */
export const SECTION_RENDERERS: Readonly<Record<string, Readonly<Record<string, Renderer>>>> = {
  hero: { IMAGE_FULL: hero, IMAGE_SIDE: hero, TEXT_ONLY: hero },
  about: { TEXT_ONLY: about, TEXT_IMAGE: about },
  features: { GRID: features, LIST: features },
  accommodations: { CARDS: accommodations, ROWS: accommodations },
  amenities: { LIST: amenities, ICONS: amenities },
  pricing: { FROM_PRICES: pricing },
  gallery: { GRID: gallery, CAROUSEL: gallery },
  booking: { INLINE: booking },
  contacts: { PLAIN: contacts, WITH_MAP: contacts },
  faq: { ACCORDION: faq, LIST: faq },
  cta: { BANNER: cta, SPLIT: cta },
};

/** Тело страницы: H1 у первой секции `hero`, иначе отдельный H1 из заголовка страницы */
export function renderSections(ctx: RenderContext): string {
  const sections = ctx.page.sections;
  for (const s of sections) {
    const byVariant = Object.hasOwn(SECTION_RENDERERS, s.type) ? SECTION_RENDERERS[s.type] : undefined;
    if (!byVariant || !Object.hasOwn(byVariant, s.variant)) throw new RenderError(`section:${s.type}:${s.variant}`);
  }
  const heroFirst = sections[0]?.type === 'hero';
  const title = heroFirst ? '' : `<div class="wrap"><h1 class="page-title">${t(ctx.page.title, ctx)}</h1></div>`;
  const body = sections
    .filter((s) => sectionVisible(s, ctx))
    .map((s, i) => SECTION_RENDERERS[s.type]![s.variant]!(s, ctx, { h1: heroFirst && i === 0 && s.type === 'hero' }))
    .join('');
  return title + body;
}
