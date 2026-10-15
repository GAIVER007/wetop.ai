import type { Action, Locale, Page, PublicFacts, Section, SiteSpec, Target } from '../types';
import { mailHref, phoneHref, safeHttps, whatsappHref } from './text';

/** Всё, что нужно рендеру: документ, живые факты и то, что решил рантайм (бронь, счётчик, ассеты) */
export interface RenderContext {
  spec: SiteSpec;
  locale: Locale;
  page: Page;
  facts: PublicFacts | null;
  /** Ключ связанного `TrackedSite`; без него ни брони, ни счётчика */
  publicKey: string | null;
  /** Бронь реально работает: документ просит виджет, сайт счётчика её включил и тариф задан */
  bookingLive: boolean;
  apiOrigin: string | null;
  /**
   * Карта `assetId → подписанный адрес` (MKT8): только ссылки этой версии и только безопасные адреса (Worker уже отсеял
   * негодные). Нет адреса, нет и картинки; секция без картинок прячется
   */
  assets: Record<string, string>;
  /**
   * Превью (MKT7): токен разрешает одну версию целиком, со всеми её страницами, поэтому переход внутри превью несёт тот
   * же токен. У публичного сайта поля нет, адреса прежние
   */
  previewToken?: string | null;
}

export class RenderError extends Error {}

export const pagePath = (page: Page) => (page.isHome ? '/' : `/${page.slug}`);

/**
 * Внутренний адрес сайта для разметки: у превью к пути добавляется токен до фрагмента (`/privacy?token=…#faq`), фрагмент
 * той же страницы (`#faq`) не трогается, браузер сам оставляет текущий адрес с токеном. Внешние адреса сюда не попадают
 */
export function localHref(path: string, ctx: Pick<RenderContext, 'previewToken'>): string {
  if (!ctx.previewToken || path.startsWith('#')) return path;
  const hash = path.indexOf('#');
  const base = hash < 0 ? path : path.slice(0, hash);
  const fragment = hash < 0 ? '' : path.slice(hash);
  return `${base}?token=${encodeURIComponent(ctx.previewToken)}${fragment}`;
}

/**
 * Строки секции цен: категории секции, действующие по `B-CATEGORY` (факты не загрузились: все), с названием из карточек
 * номеров документа. Служебного имени категории у рантайма нет, поэтому строка без карточки не выводится.
 */
export function pricingRows(
  section: Section,
  ctx: Pick<RenderContext, 'spec' | 'facts'>,
): Array<{ code: string; title: unknown }> {
  const codes = Array.isArray(section['categoryCodes']) ? (section['categoryCodes'] as unknown[]) : [];
  const titles = new Map<string, unknown>();
  for (const s of ctx.spec.pages.flatMap((p) => p.sections))
    if (s.type === 'accommodations' && Array.isArray(s['items']))
      for (const item of s['items'] as Array<Record<string, unknown>>)
        if (typeof item['categoryCode'] === 'string' && !titles.has(item['categoryCode']))
          titles.set(item['categoryCode'], item['title']);
  return codes
    .filter((code): code is string => typeof code === 'string' && titles.has(code))
    .filter((code) => !ctx.facts || ctx.facts.categories.some((c) => c.code === code && c.active))
    .map((code) => ({ code, title: titles.get(code) }));
}

/** Секции, которые рантайм покажет: без картинок часть секций прячется (план MKT4 §8) */
export function sectionVisible(
  section: Section,
  ctx: Pick<RenderContext, 'spec' | 'facts' | 'assets' | 'bookingLive'>,
): boolean {
  switch (section.type) {
    case 'gallery':
      return resolvedImages(section['images'], ctx.assets).length > 0;
    case 'pricing':
      // Q-276: цена живая и приходит только по тарифу брони сайта; без брони цен нет, без строк секции нет
      return ctx.bookingLive && pricingRows(section, ctx).length > 0;
    case 'accommodations':
      return visibleCards(section, ctx.facts).length > 0;
    default:
      return true;
  }
}

export function resolvedImages(images: unknown, assets: Record<string, string>): Array<{ src: string; alt: unknown }> {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => {
      // id в документе может быть в любом регистре, карта API в нижнем (UUID)
      const id = String((img as { assetId?: string })?.assetId ?? '');
      return { src: assets[id] ?? assets[id.toLowerCase()], alt: (img as { alt?: unknown })?.alt };
    })
    .filter((img): img is { src: string; alt: unknown } => typeof img.src === 'string');
}

/** Карточка категории видна, если факты не загрузились (живые поля прячутся) или категория у объекта действует */
export function visibleCards(section: Section, facts: PublicFacts | null): Array<Record<string, unknown>> {
  const items = Array.isArray(section['items']) ? (section['items'] as Array<Record<string, unknown>>) : [];
  if (!facts) return items;
  return items.filter((item) => facts.categories.some((c) => c.code === item['categoryCode'] && c.active));
}

function findSection(spec: SiteSpec, pageId: string, sectionId?: string) {
  const page = spec.pages.find((p) => p.id === pageId);
  if (!page) return null;
  if (sectionId === undefined) return { page, section: null };
  const section = page.sections.find((s) => s.id === sectionId);
  return section ? { page, section } : null;
}

/** Адрес пункта меню; ссылка на скрытую секцию это `null`, пункт не выводится */
export function targetHref(target: Target, ctx: RenderContext): { href: string; external: boolean } | null {
  if (target.kind === 'EXTERNAL') {
    const href = safeHttps(target.url);
    return href ? { href, external: true } : null;
  }
  const found = findSection(ctx.spec, target.pageId, target.kind === 'SECTION' ? target.sectionId : undefined);
  if (!found) return null;
  // секция цен скрыта, пока скрипт не покажет строку с ценой: ссылка на неё вела бы в пустоту
  if (found.section && (found.section.type === 'pricing' || !sectionVisible(found.section, ctx))) return null;
  const path = pagePath(found.page);
  if (!found.section) return { href: localHref(path, ctx), external: false };
  return {
    href: found.page.id === ctx.page.id ? `#${found.section.id}` : localHref(`${path}#${found.section.id}`, ctx),
    external: false,
  };
}

/** Куда ведёт кнопка `BOOK`: секция брони этой страницы, иначе главной; брони нет вовсе, кнопки нет */
function bookingHref(ctx: RenderContext): string | null {
  const here = ctx.page.sections.find((s) => s.type === 'booking');
  if (here) return `#${here.id}`;
  const home = ctx.spec.pages.find((p) => p.isHome);
  const there = home?.sections.find((s) => s.type === 'booking');
  return home && there ? localHref(`/#${there.id}`, ctx) : null;
}

export function actionHref(action: Action, ctx: RenderContext): { href: string; external: boolean } | null {
  const contacts = ctx.spec.site.contacts ?? {};
  const local = (href: string | null) => (href ? { href, external: false } : null);
  switch (action.kind) {
    case 'BOOK':
      return local(bookingHref(ctx));
    case 'PHONE':
      return local(phoneHref(contacts.phone));
    case 'WHATSAPP': {
      const href = whatsappHref(contacts.whatsapp);
      return href ? { href, external: true } : null;
    }
    case 'EMAIL':
      return local(mailHref(contacts.email));
    case 'PAGE':
      return targetHref({ kind: 'PAGE', pageId: action.pageId }, ctx);
    case 'SECTION':
      return targetHref({ kind: 'SECTION', pageId: action.pageId, sectionId: action.sectionId }, ctx);
    case 'EXTERNAL':
      return targetHref({ kind: 'EXTERNAL', url: action.url }, ctx);
    default:
      throw new RenderError(`action:${String((action as { kind?: unknown }).kind)}`);
  }
}
