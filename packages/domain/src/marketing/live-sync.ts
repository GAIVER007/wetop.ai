import type { SiteFacts, SiteFactsCatalogItem } from './site-facts';
import { starterPhone, starterText } from './starter';
import { validateSiteSpec } from './site-spec';
import { AUTO_FAQ_ID, autoFaqItems, autoFaqQuestionSet, type AutoSeoInput, type SeoLocale } from './seo-auto';

/**
 * Живые данные на опубликованном сайте (SITE-1, поручение владельца 15.10.2026: «сайт сам обновляется от WETOP»).
 * Сайт строится из шаблона по фактам филиала один раз, а потом владелец меняет цены, услуги, мастеров, меню и часы
 * в WETOP. Рантайм перед выдачей накладывает свежие факты на опубликованный документ: списки услуг, мастеров и меню,
 * часы работы и контакты берутся из WETOP, а то, что владелец добавил на сайте сам (описание услуги, фото мастера,
 * фото и описание блюда, заголовки, порядок и оформление блоков), остаётся. Без сети и времени: те же документ и
 * факты дают тот же результат. Итог не прошёл валидатор, значит выдаётся документ как опубликован.
 */
type Rec = Record<string, unknown>;

const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MINOR_RE = /^(?:0|[1-9][0-9]{0,14})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Те же пределы, что у заготовки сайта (`starter.ts`) */
const LIMIT = { services: 60, staff: 30, menuCategories: 30, menuPerCategory: 80, menuTotal: 300 } as const;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const money = (i: SiteFactsCatalogItem) =>
  i.price && MINOR_RE.test(i.price.minor) && /^[A-Z]{3}$/.test(i.price.currency) ? { minor: i.price.minor, currency: i.price.currency } : undefined;
/** Текст на языке сайта из WETOP, переводы на другие языки остаются */
const text = (old: unknown, locale: string, value: string) => ({ ...(isRec(old) ? old : {}), [locale]: value });

function services(section: Rec, facts: SiteFacts, locale: string): Rec | null {
  if (facts.catalog.kind !== 'services') return null;
  const items = facts.catalog.items.filter((i) => CODE_RE.test(i.code) && starterText(i.name, 80)).slice(0, LIMIT.services);
  if (!items.length) return null;
  const old = new Map(((section['items'] as Rec[] | undefined) ?? []).filter(isRec).map((i) => [String(i['serviceCode']), i]));
  const next = items.map((i) => {
    const prev = old.get(i.code) ?? {};
    const price = money(i);
    const category = starterText(i.category, 60);
    const out: Rec = { serviceCode: i.code, title: text(prev['title'], locale, starterText(i.name, 80)!) };
    if (typeof prev['description'] !== 'undefined') out['description'] = prev['description'];
    if (category) out['category'] = text(prev['category'], locale, category);
    if (typeof i.durationMin === 'number' && Number.isInteger(i.durationMin) && i.durationMin > 0 && i.durationMin <= 1440) out['durationMin'] = i.durationMin;
    if (price) out['price'] = price;
    if (price && prev['priceFrom'] === true) out['priceFrom'] = true;
    return out;
  });
  return { ...section, items: next };
}

function staff(section: Rec, facts: SiteFacts, locale: string): Rec | null {
  const people = facts.staff.filter((s) => UUID_RE.test(s.id) && starterText(s.name, 80)).slice(0, LIMIT.staff);
  if (!people.length) return null;
  const old = new Map(((section['items'] as Rec[] | undefined) ?? []).filter(isRec).map((i) => [String(i['employeeId']).toLowerCase(), i]));
  const next = people.map((s) => {
    const id = s.id.toLowerCase();
    const prev = old.get(id) ?? {};
    const spec = starterText(s.specialization, 120);
    const out: Rec = { employeeId: id, name: text(prev['name'], locale, starterText(s.name, 80)!) };
    // специализацию, которую владелец написал на сайте сам, не затираем списком услуг
    if (prev['specialization'] !== undefined) out['specialization'] = prev['specialization'];
    else if (spec) out['specialization'] = text(undefined, locale, spec);
    if (prev['image'] !== undefined) out['image'] = prev['image'];
    return out;
  });
  return { ...section, items: next };
}

function menu(section: Rec, facts: SiteFacts, locale: string): Rec | null {
  if (facts.catalog.kind !== 'menu') return null;
  const old = new Map<string, Rec>();
  const oldCats = new Map<string, Rec>();
  for (const cat of ((section['categories'] as Rec[] | undefined) ?? []).filter(isRec)) {
    const title = isRec(cat['title']) ? String(cat['title'][locale] ?? '') : '';
    if (title) oldCats.set(title, cat);
    for (const i of ((cat['items'] as Rec[] | undefined) ?? []).filter(isRec)) old.set(String(i['itemCode']), i);
  }
  const cats: Array<{ title: Rec; items: Rec[] }> = [];
  const byTitle = new Map<string, { title: Rec; items: Rec[] }>();
  let total = 0;
  for (const i of facts.catalog.items) {
    if (total >= LIMIT.menuTotal) break;
    if (!CODE_RE.test(i.code) || !starterText(i.name, 120)) continue;
    const title = starterText(i.category, 80) ?? 'Меню';
    let cat = byTitle.get(title);
    if (!cat) {
      if (cats.length >= LIMIT.menuCategories) continue;
      cat = { title: text(oldCats.get(title)?.['title'], locale, title), items: [] };
      byTitle.set(title, cat);
      cats.push(cat);
    }
    if (cat.items.length >= LIMIT.menuPerCategory) continue;
    const prev = old.get(i.code) ?? {};
    const price = money(i);
    const out: Rec = { itemCode: i.code, title: text(prev['title'], locale, starterText(i.name, 120)!) };
    if (prev['description'] !== undefined) out['description'] = prev['description'];
    if (typeof i.weightGrams === 'number' && Number.isInteger(i.weightGrams) && i.weightGrams > 0 && i.weightGrams <= 100_000) out['weightGrams'] = i.weightGrams;
    if (price) out['price'] = price;
    if (prev['image'] !== undefined) out['image'] = prev['image'];
    cat.items.push(out);
    total += 1;
  }
  if (!cats.length) return null;
  return { ...section, categories: cats };
}

function hours(section: Rec, facts: SiteFacts): Rec | null {
  const seen = new Set<number>();
  const days = facts.hours.days
    .filter((d) => Number.isInteger(d.weekday) && d.weekday >= 0 && d.weekday <= 6 && d.open !== d.close)
    .filter((d) => (seen.has(d.weekday) ? false : (seen.add(d.weekday), true)))
    .map((d) => ({ weekday: d.weekday, open: d.open, close: d.close }));
  return days.length ? { ...section, days } : null;
}

/**
 * «Вопросы и ответы» из фактов (S7): цены, часы, заезд и адрес в ответах следуют за WETOP, пока владелец блок не
 * переписывал (все вопросы из автоматического набора). Переписанный или свой блок остаётся как есть.
 */
function faq(section: Rec, facts: SiteFacts, locale: string, spec: Rec): Rec | null {
  if (section['id'] !== AUTO_FAQ_ID || !['ru', 'kk', 'en'].includes(locale)) return null;
  const site = isRec(spec['site']) ? spec['site'] : {};
  const name = starterText(facts.location.name, 80);
  if (!name) return null;
  const input: AutoSeoInput = {
    facts,
    locale: locale as SeoLocale,
    name,
    address: starterText(facts.location.address, 200),
    city: starterText(facts.location.city, 60),
    phone: starterPhone(facts.location.phone),
    items: facts.catalog.items.filter((i) => CODE_RE.test(i.code) && starterText(i.name, 80)),
    itemName: (i) => starterText(i.name, 80)!,
  };
  const allowed = autoFaqQuestionSet(input);
  const items = Array.isArray(section['items']) ? (section['items'] as unknown[]) : [];
  const auto = items.every((i) => isRec(i) && isRec(i['question']) && allowed.has(String((i['question'] as Rec)[locale] ?? '')));
  if (!auto || site['vertical'] !== facts.vertical) return null;
  const fresh = autoFaqItems(input);
  return fresh.length ? { ...section, items: fresh.map((i) => ({ question: { [locale]: i.question }, answer: { [locale]: i.answer } })) } : null;
}

/**
 * Документ сайта со свежими фактами WETOP. Возвращает тот же объект, если менять нечего или итог не прошёл валидатор;
 * иначе новый документ (входной не меняется)
 */
export function liveSiteSpec(spec: Rec, facts: SiteFacts): Rec {
  const site = isRec(spec['site']) ? spec['site'] : {};
  const locale = typeof site['defaultLocale'] === 'string' ? site['defaultLocale'] : 'ru';
  const pages = Array.isArray(spec['pages']) ? (spec['pages'] as unknown[]) : [];
  const nextPages = pages.map((page) => {
    if (!isRec(page) || !Array.isArray(page['sections'])) return page;
    return {
      ...page,
      sections: (page['sections'] as unknown[]).map((s) => {
        if (!isRec(s)) return s;
        const type = s['type'];
        const fresh =
          type === 'services' ? services(s, facts, locale)
          : type === 'staff' ? staff(s, facts, locale)
          : type === 'menu' ? menu(s, facts, locale)
          : type === 'hours' ? hours(s, facts)
          : type === 'faq' ? faq(s, facts, locale, spec)
          : null;
        return fresh ?? s;
      }),
    };
  });
  const contacts = isRec(site['contacts']) ? { ...site['contacts'] } : null;
  if (contacts) {
    const phone = starterPhone(facts.location.phone);
    const address = starterText(facts.location.address, 200);
    if (phone && 'phone' in contacts) contacts['phone'] = phone;
    if (address && 'address' in contacts) contacts['address'] = text(contacts['address'], locale, address);
  }
  const next: Rec = { ...spec, pages: nextPages, ...(contacts ? { site: { ...site, contacts } } : {}) };
  if (JSON.stringify(next) === JSON.stringify(spec)) return spec;
  return validateSiteSpec(next).ok ? next : spec;
}
