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
  /** Карта `assetId → адрес`; в MKT4 пуста (SiteAsset нет), картинки не выводятся */
  assets: Record<string, string>;
}

export class RenderError extends Error {}

export const pagePath = (page: Page) => (page.isHome ? '/' : `/${page.slug}`);

/** Секции, которые рантайм покажет: без картинок и без цены «от» часть секций прячется (план MKT4 §7, §8) */
export function sectionVisible(section: Section, ctx: Pick<RenderContext, 'facts' | 'assets'>): boolean {
  switch (section.type) {
    case 'gallery':
      return resolvedImages(section['images'], ctx.assets).length > 0;
    case 'pricing':
      // Q-276: правила цены «от» без дат нет, цена не показывается, секция целиком скрыта
      return false;
    case 'accommodations':
      return visibleCards(section, ctx.facts).length > 0;
    default:
      return true;
  }
}

export function resolvedImages(images: unknown, assets: Record<string, string>): Array<{ src: string; alt: unknown }> {
  if (!Array.isArray(images)) return [];
  return images
    .map((img) => ({ src: assets[(img as { assetId?: string })?.assetId ?? ''], alt: (img as { alt?: unknown })?.alt }))
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
  if (found.section && !sectionVisible(found.section, ctx)) return null;
  const path = pagePath(found.page);
  if (!found.section) return { href: path, external: false };
  return { href: found.page.id === ctx.page.id ? `#${found.section.id}` : `${path}#${found.section.id}`, external: false };
}

/** Куда ведёт кнопка `BOOK`: секция брони этой страницы, иначе главной; брони нет вовсе, кнопки нет */
function bookingHref(ctx: RenderContext): string | null {
  const here = ctx.page.sections.find((s) => s.type === 'booking');
  if (here) return `#${here.id}`;
  const home = ctx.spec.pages.find((p) => p.isHome);
  const there = home?.sections.find((s) => s.type === 'booking');
  return home && there ? `/#${there.id}` : null;
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
