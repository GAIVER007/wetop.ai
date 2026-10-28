import type { Cta, LocalizedText, Section } from '../types';
import { SITE_LEAD_ENDPOINTS } from '../../../../packages/domain/src/marketing/site-lead';
import {
  actionHref,
  leadLive,
  pricingRows,
  RenderError,
  resolvedImages,
  sectionVisible,
  visibleCards,
  type RenderContext,
} from './context';
import { icon } from './icons';
import { formatMoney } from './price-format';
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
  const pic = image(s['image'], ctx, true);
  // вариант с фото даёт свой класс: на весь экран с затемнением или фото сбоку; без фото обычный первый экран
  const cls = pic && s.variant !== 'TEXT_ONLY' ? `hero hero--${String(s.variant).toLowerCase()}` : 'hero';
  return `${open(s, ` class="${cls}"`)}${heading(s, ctx, h1)}${sub}${actions ? `<div class="actions">${actions}</div>` : ''}${pic}${close}`;
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
      const text = `<h3>${t(item['title'], ctx)}</h3><p>${t(item['description'], ctx)}</p>${capacity}${price}${chips}${action ? `<div class="actions">${action}</div>` : ''}`;
      // строкой: фото слева крупно, текст справа; без фото строка остаётся одной колонкой
      if (s.variant === 'ROWS') return pics ? `<li class="row room-row"><div class="room-row__pics">${pics}</div><div>${text}</div></li>` : `<li class="row"><div>${text}</div></li>`;
      return `<li class="card">${pics}${text}</li>`;
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


// ---------- SITE-2: салон, ресторан, часы, форма заявки ----------

/** Подпись кнопки заявки по направлению и режиму формы документа */
export function leadLabel(ctx: RenderContext): string {
  const strings = ui(ctx.locale);
  const form = ctx.spec.pages.flatMap((p) => p.sections).find((s) => s.type === 'leadForm');
  const mode = form?.['mode'];
  if (mode === 'BEAUTY_APPOINTMENT') return strings.appoint;
  if (mode === 'TABLE_RESERVATION') return strings.bookTable;
  if (mode === 'CALLBACK') return strings.callback;
  return strings.book;
}

const bookCta = (ctx: RenderContext): Cta => ({ label: { [ctx.locale]: leadLabel(ctx) }, action: { kind: 'BOOK' } });

/** Цена снимком из данных: точная или «от»; нет или битая: строки цены нет */
function priceText(money: unknown, from: boolean, ctx: RenderContext): string {
  const formatted = formatMoney(money, ctx.locale);
  if (!formatted) return '';
  return esc(from ? ui(ctx.locale).priceFrom(formatted) : formatted);
}

const priceTag = (money: unknown, from: boolean, ctx: RenderContext) => {
  const text = priceText(money, from, ctx);
  return text ? `<strong class="price">${text}</strong>` : '';
};

const services: Renderer = (s, ctx, { h1 }) => {
  const strings = ui(ctx.locale);
  const items = list<Record<string, unknown>>(s['items']);
  const action = ctaLink((s['itemAction'] as Cta | undefined) ?? bookCta(ctx), ctx, true);
  const item = (i: Record<string, unknown>) => {
    const meta = [
      s['showDuration'] === true && typeof i['durationMin'] === 'number' ? `<span>${esc(strings.minutes(i['durationMin']))}</span>` : '',
      s['showPrices'] === true ? priceTag(i['price'], i['priceFrom'] === true, ctx) : '',
    ].filter(Boolean);
    const desc = i['description'] ? `<p class="muted">${t(i['description'], ctx)}</p>` : '';
    const body = `<div><h3>${t(i['title'], ctx)}</h3>${desc}</div><div class="item-side">${meta.length ? `<p class="item-meta">${meta.join('')}</p>` : ''}${action}</div>`;
    return s.variant === 'CARDS' ? `<li class="card catalog-item">${body}</li>` : `<li class="row catalog-item">${body}</li>`;
  };
  const cls = s.variant === 'CARDS' ? 'list grid' : 'list';
  let body: string;
  if (s['groupByCategory'] === true) {
    const groups: Array<{ title: unknown; items: Array<Record<string, unknown>> }> = [];
    for (const i of items) {
      const key = tx(i['category'] as LocalizedText | undefined, ctx.locale);
      let g = groups.find((x) => tx(x.title as LocalizedText | undefined, ctx.locale) === key);
      if (!g) groups.push((g = { title: i['category'], items: [] }));
      g.items.push(i);
    }
    body = groups
      .map((g) => `${g.title ? `<h3 class="group-title">${t(g.title, ctx)}</h3>` : ''}<ul class="${cls}">${g.items.map(item).join('')}</ul>`)
      .join('');
  } else body = `<ul class="${cls}">${items.map(item).join('')}</ul>`;
  return `${open(s, ' class="catalog"')}${heading(s, ctx, h1)}${body}${close}`;
};

const staff: Renderer = (s, ctx, { h1 }) => {
  const cards = list<Record<string, unknown>>(s['items'])
    .map((i) => {
      const spec = i['specialization'] ? `<p class="muted">${t(i['specialization'], ctx)}</p>` : '';
      // строкой: фото слева, имя и специализация столбиком справа
      const text = `<div><h3>${t(i['name'], ctx)}</h3>${spec}</div>`;
      const body = s.variant === 'CARDS' ? `${image(i['image'], ctx)}<h3>${t(i['name'], ctx)}</h3>${spec}` : `${image(i['image'], ctx)}${text}`;
      return s.variant === 'CARDS' ? `<li class="card person">${body}</li>` : `<li class="row person">${body}</li>`;
    })
    .join('');
  return `${open(s)}${heading(s, ctx, h1)}<ul class="${s.variant === 'CARDS' ? 'list grid' : 'list'}">${cards}</ul>${close}`;
};

const menu: Renderer = (s, ctx, { h1 }) => {
  const strings = ui(ctx.locale);
  const photos = s['showPhotos'] === true;
  const cats = list<Record<string, unknown>>(s['categories'])
    .map((c) => {
      const items = list<Record<string, unknown>>(c['items'])
        .map((i) => {
          const weight = typeof i['weightGrams'] === 'number' ? `<span class="muted">${esc(strings.grams(i['weightGrams']))}</span>` : '';
          const price = priceText(i['price'], false, ctx);
          const desc = i['description'] ? `<p class="muted">${t(i['description'], ctx)}</p>` : '';
          const pic = photos ? image(i['image'], ctx) : '';
          const cls = s.variant === 'CARDS' ? 'card dish' : 'row dish';
          return `<li class="${cls}">${pic}<div><h4>${t(i['title'], ctx)}</h4>${desc}${weight}</div>${price ? `<strong class="price">${price}</strong>` : ''}</li>`;
        })
        .join('');
      return `<h3 class="group-title">${t(c['title'], ctx)}</h3><ul class="${s.variant === 'CARDS' ? 'list grid' : 'list'}">${items}</ul>`;
    })
    .join('');
  return `${open(s, ' class="catalog"')}${heading(s, ctx, h1)}${cats}${close}`;
};

/** Дни с понедельника, как читают расписание; дней нет в документе: строки нет (о выходных ничего не утверждаем) */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const hours: Renderer = (s, ctx, { h1 }) => {
  const strings = ui(ctx.locale);
  const days = list<{ weekday: number; open: string; close: string }>(s['days']);
  const byDay = new Map(days.map((d) => [d.weekday, d]));
  const span = (d: { open: string; close: string }) => `${esc(d.open)}–${esc(d.close)}`;
  let body: string;
  if (s.variant === 'COMPACT') {
    const runs: Array<{ from: number; to: number; text: string }> = [];
    for (const w of WEEK_ORDER) {
      const d = byDay.get(w);
      if (!d) continue;
      const text = span(d);
      const last = runs.at(-1);
      if (last && last.text === text && WEEK_ORDER.indexOf(last.to) === WEEK_ORDER.indexOf(w) - 1) last.to = w;
      else runs.push({ from: w, to: w, text });
    }
    body = `<ul class="hours-compact">${runs
      .map((r) => `<li><b>${esc(strings.weekdaysShort[r.from]!)}${r.to !== r.from ? `–${esc(strings.weekdaysShort[r.to]!)}` : ''}</b> ${r.text}</li>`)
      .join('')}</ul>`;
  } else
    body = `<table class="hours"><tbody>${WEEK_ORDER.filter((w) => byDay.has(w))
      .map((w) => `<tr><th scope="row">${esc(strings.weekdays[w]!)}</th><td>${span(byDay.get(w)!)}</td></tr>`)
      .join('')}</tbody></table>`;
  const note = s['note'] ? `<p class="muted">${t(s['note'], ctx)}</p>` : '';
  return `${open(s)}${heading(s, ctx, h1)}${body}${note}${close}`;
};

function field(id: string, label: string, control: string): string {
  return `<p class="field"><label for="${esc(id)}">${esc(label)}</label>${control}</p>`;
}

/** Запасной путь без скрипта: позвонить или написать; без контактов строки нет */
function leadFallback(ctx: RenderContext, formId: string, visible: boolean): string {
  const c = ctx.spec.site.contacts ?? {};
  const strings = ui(ctx.locale);
  const phone = phoneHref(c.phone);
  const wa = whatsappHref(c.whatsapp);
  const links = [
    phone ? `<a class="btn" href="${esc(phone)}">${esc(strings.callUs)}</a>` : '',
    wa ? `<a class="btn btn--ghost" href="${esc(wa)}" rel="noopener noreferrer">${esc(strings.writeWhatsapp)}</a>` : '',
  ].filter(Boolean);
  if (!links.length) return '';
  return `<div class="actions" data-lead-fallback="${esc(formId)}"${visible ? '' : ' hidden'}>${links.join('')}</div>`;
}

const leadForm: Renderer = (s, ctx, { h1 }) => {
  const strings = ui(ctx.locale);
  const mode = String(s['mode']);
  const note = s['note'] ? `<p class="booking-note">${t(s['note'], ctx)}</p>` : '';
  const formId = `${s.id}-form`;
  if (mode === 'HOTEL_BOOKING') {
    // гостиница: тот же виджет `/w/book`, что у секции `booking`
    const body = ctx.bookingLive ? '<div id="pms-booking"></div>' : `<p>${esc(strings.bookingUnavailable)}</p>${leadFallback(ctx, formId, true)}`;
    return `${open(s)}${heading(s, ctx, h1)}${note}${body}${close}`;
  }
  const live = leadLive(ctx);
  const id = (name: string) => `${s.id}-${name}`;
  const controls: string[] = [];
  if (mode === 'BEAUTY_APPOINTMENT') {
    const all = ctx.spec.pages.flatMap((p) => p.sections);
    const serviceOptions = all
      .filter((x) => x.type === 'services')
      .flatMap((x) => list<Record<string, unknown>>(x['items']))
      .map((i) => `<option value="${esc(String(i['serviceCode']))}">${t(i['title'], ctx)}</option>`)
      .join('');
    const staffOptions = all
      .filter((x) => x.type === 'staff')
      .flatMap((x) => list<Record<string, unknown>>(x['items']))
      .map((i) => `<option value="${esc(String(i['employeeId']))}">${t(i['name'], ctx)}</option>`)
      .join('');
    // SiteSpec keeps the existing serviceCode catalog field; the public booking wire calls that UUID serviceId.
    controls.push(field(id('service'), strings.formService, `<select id="${esc(id('service'))}" name="serviceId" required>${serviceOptions}</select>`));
    controls.push(field(id('master'), strings.formMaster, `<select id="${esc(id('master'))}" name="employeeId"><option value="">${esc(strings.formAnyMaster)}</option>${staffOptions}</select>`));
  }
  if (mode === 'BEAUTY_APPOINTMENT' || mode === 'TABLE_RESERVATION') {
    controls.push(field(id('date'), strings.formDate, `<input id="${esc(id('date'))}" name="date" type="date" required>`));
    if (mode === 'TABLE_RESERVATION')
      controls.push(field(id('time'), strings.formTime, `<input id="${esc(id('time'))}" name="time" type="time" step="900" required>`));
    else {
      controls.push(field(id('time'), strings.formTime, `<select id="${esc(id('time'))}" name="startsAt" required disabled><option value=""></option></select>`));
      controls.push('<p data-beauty-details aria-live="polite"></p><p><button type="button" data-beauty-refresh></button></p>');
    }
  }
  if (mode === 'TABLE_RESERVATION')
    controls.push(field(id('party'), strings.formParty, `<input id="${esc(id('party'))}" name="partySize" type="number" min="1" max="50" value="2" inputmode="numeric" required>`));
  controls.push(field(id('name'), strings.formName, `<input id="${esc(id('name'))}" name="name" type="text" maxlength="${mode === 'BEAUTY_APPOINTMENT' ? 100 : 120}" autocomplete="name" required>`));
  controls.push(field(id('phone'), strings.formPhone, `<input id="${esc(id('phone'))}" name="phone" type="tel" maxlength="32" autocomplete="tel" inputmode="tel" required>`));
  if (s['showComment'] === true)
    controls.push(field(id('comment'), strings.formComment, `<textarea id="${esc(id('comment'))}" name="comment" rows="3" maxlength="1000"></textarea>`));
  // ловушка для ботов: человек её не видит и не достаёт табом
  controls.push('<p class="hp" aria-hidden="true"><input name="website" type="text" tabindex="-1" autocomplete="off"></p>');
  const submit = s['submitLabel'] ? t(s['submitLabel'], ctx) : esc(strings.formSend);
  const endpoint = SITE_LEAD_ENDPOINTS[mode as keyof typeof SITE_LEAD_ENDPOINTS] ?? '';
  const attrs = [
    `id="${esc(formId)}"`,
    'class="lead-form"',
    'data-lead-form',
    `data-mode="${esc(mode)}"`,
    `data-endpoint="${esc(endpoint)}"`,
    `data-sending="${esc(strings.formSending)}"`,
    `data-done="${esc(strings.formDone)}"`,
    `data-error="${esc(strings.formError)}"`,
    // форму показывает скрипт; без скрипта видна запасная строка с телефоном. Превью и сайт без ключа: форма видна,
    // но выключена, чтобы было видно, как она выглядит
    live ? 'hidden' : '',
  ].filter(Boolean);
  const inner = `${controls.join('')}<div data-lead-captcha></div><p><button class="btn" type="submit">${submit}</button></p><p class="lead-status" role="status" aria-live="polite" data-lead-status></p>`;
  const form = `<form ${attrs.join(' ')}>${live ? inner : `<fieldset disabled>${inner}</fieldset>`}</form>`;
  return `${open(s, s.variant === 'CARD' ? ' class="lead lead--card"' : ' class="lead"')}${heading(s, ctx, h1)}${note}${form}${leadFallback(ctx, formId, live)}${close}`;
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
  services: { LIST: services, CARDS: services },
  staff: { CARDS: staff, LIST: staff },
  menu: { LIST: menu, CARDS: menu },
  hours: { TABLE: hours, COMPACT: hours },
  leadForm: { INLINE: leadForm, CARD: leadForm },
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
