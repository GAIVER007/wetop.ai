import { LEAD_PATH, PRICES_PATH } from '../assets';
import { renderHead, type SeoSettings } from '../seo';
import type { Cta } from '../types';
import {
  bookingHref,
  leadLive,
  localHref,
  pagePath,
  resolvedImages,
  sectionVisible,
  targetHref,
  usesHotelWidget,
  usesLeadScript,
  type RenderContext,
} from './context';
import { INTL_LOCALE, PRICE_LABEL } from './price-format';
import { ctaLink, leadLabel, renderSections } from './sections';
import { themeClasses } from './theme';
import { esc, tx, ui, whatsappHref } from './text';

/**
 * Страница целиком: `SiteSpec + publicFacts + решение рантайма → HTML`. Чистая функция без сети и времени. Скрипты в
 * разметке только WETOP: виджет брони и счётчик с ключом связанного сайта счётчика, и только когда они включены.
 */
export function renderPage(ctx: RenderContext, seo: SeoSettings, cssHref: string): string {
  const main = renderSections(ctx);
  return documentHtml(ctx, seo, cssHref, main);
}

/** 404 сайта по неизвестному пути: та же оболочка, без индексации */
export function renderNotFound(ctx: RenderContext, seo: SeoSettings, cssHref: string): string {
  const s = ui(ctx.locale);
  const main = `<div class="wrap not-found"><h1>${esc(s.notFoundTitle)}</h1><p>${esc(s.notFoundText)}</p><p><a class="btn" href="${esc(localHref('/', ctx))}">${esc(s.home)}</a></p></div>`;
  const page = { ...ctx.page, seo: { ...ctx.page.seo, index: false, title: { [ctx.locale]: s.notFoundTitle } } };
  return documentHtml({ ...ctx, page }, seo, cssHref, main);
}

function documentHtml(ctx: RenderContext, seo: SeoSettings, cssHref: string, main: string): string {
  const { spec, locale } = ctx;
  const strings = ui(locale);
  const name = esc(tx(spec.site.displayName, locale));
  const nav = spec.navigation.header
    .map((item) => {
      const target = targetHref(item.target, ctx);
      if (!target) return '';
      const current = !target.external && target.href === localHref(pagePath(ctx.page), ctx) ? ' aria-current="page"' : '';
      const rel = target.external ? ' rel="noopener noreferrer"' : '';
      return `<a href="${esc(target.href)}"${rel}${current}>${esc(tx(item.label, locale))}</a>`;
    })
    .filter(Boolean)
    .join('');
  const headerCta = ctaLink(spec.navigation.headerCta as Cta | undefined, ctx);
  const footerLinks = spec.navigation.footer
    .map((item) => {
      const target = targetHref(item.target, ctx);
      if (!target) return '';
      const rel = target.external ? ' rel="noopener noreferrer"' : '';
      return `<a href="${esc(target.href)}"${rel}>${esc(tx(item.label, locale))}</a>`;
    })
    .filter(Boolean)
    .join('');
  const privacyPage = spec.site.legal?.privacyPageId
    ? spec.pages.find((p) => p.id === spec.site.legal?.privacyPageId)
    : undefined;
  const privacyHref = privacyPage ? localHref(pagePath(privacyPage), ctx) : '';
  const privacy =
    privacyPage && !footerLinks.includes(`href="${esc(privacyHref)}"`)
      ? `<a href="${esc(privacyHref)}">${esc(strings.privacy)}</a>`
      : '';
  const operator = tx(spec.site.legal?.operatorName, locale);
  const tagline = tx(spec.site.brand?.tagline, locale);
  const footer = `<footer class="site-footer"><div class="wrap">${footerLinks || privacy ? `<nav aria-label="${esc(strings.footerNav)}">${footerLinks}${privacy}</nav>` : ''}<p><strong>${name}</strong>${tagline ? `. ${esc(tagline)}` : ''}</p>${operator ? `<p>${esc(operator)}</p>` : ''}<p>${esc(strings.madeWith)}</p></div></footer>`;
  const [logo] = resolvedImages(spec.site.brand?.logo ? [spec.site.brand.logo] : [], ctx.assets);
  const logoImg = logo ? `<img class="brand__logo" src="${esc(logo.src)}" alt="" decoding="async">` : '';
  const header = `<header class="site-header"><div class="wrap"><a class="brand" href="${esc(localHref('/', ctx))}">${logoImg}${name}</a>${nav ? `<nav class="nav" aria-label="${esc(strings.menu)}">${nav}</nav>` : ''}${headerCta}</div></header>`;
  const bar = mobileBar(ctx);
  const bodyClass = `${themeClasses(spec.theme as unknown as Record<string, unknown>)}${bar ? ' has-mobile-bar' : ''}`;
  return `<!doctype html><html lang="${esc(locale)}"><head>${renderHead(ctx, seo, cssHref)}</head><body class="${bodyClass}"><a class="skip" href="#main">${esc(strings.skip)}</a>${header}<main id="main">${main}</main>${footer}${bar}${scripts(ctx)}</body></html>`;
}

/**
 * SITE-2: закреплённая внизу экрана на телефоне кнопка заявки и WhatsApp (план §1 шаг 4, п. 9). Только ссылки, без
 * скрипта; на широком экране скрыта стилем. Кнопка заявки ведёт к форме или виджету брони; WhatsApp только с номером
 */
function mobileBar(ctx: RenderContext): string {
  const bar = ctx.spec.navigation.mobileBar;
  if (!bar) return '';
  const strings = ui(ctx.locale);
  const links: string[] = [];
  const book = bar.book ? bookingHref(ctx) : null;
  if (book) links.push(`<a class="btn" href="${esc(book)}">${esc(leadLabel(ctx))}</a>`);
  const wa = bar.whatsapp ? whatsappHref(ctx.spec.site.contacts?.whatsapp) : null;
  if (wa) links.push(`<a class="btn btn--ghost" href="${esc(wa)}" rel="noopener noreferrer">${esc(strings.writeWhatsapp)}</a>`);
  return links.length ? `<nav class="mobile-bar" aria-label="${esc(strings.quickActions)}">${links.join('')}</nav>` : '';
}

/** На странице форма заявки салона, ресторана или «перезвоните», и сайт может её отправить */
export function pageNeedsLead(ctx: RenderContext): boolean {
  return leadLive(ctx) && ctx.page.sections.some((s) => usesLeadScript(s) && sectionVisible(s, ctx));
}

/** На странице есть место под живую цену «от»: карточки с `showFromPrice` или видимая секция цен (Q-276) */
export function pageNeedsPrices(ctx: RenderContext): boolean {
  if (!ctx.bookingLive || !ctx.apiOrigin || !ctx.publicKey) return false;
  return ctx.page.sections.some(
    (s) =>
      (s.type === 'accommodations' && s['showFromPrice'] === true && sectionVisible(s, ctx)) ||
      (s.type === 'pricing' && sectionVisible(s, ctx)),
  );
}

/** Только скрипты WETOP с публичным ключом связанного сайта счётчика; ни одного своего встроенного скрипта */
function scripts(ctx: RenderContext): string {
  if (!ctx.apiOrigin || !ctx.publicKey) return '';
  const key = esc(ctx.publicKey);
  const api = esc(ctx.apiOrigin);
  const parts: string[] = [];
  const analytics = ctx.spec.integrations.analytics;
  if (analytics.mode === 'WETOP_TRACKER') {
    const consent = analytics.consent === 'WAIT_FOR_CONSENT' ? ' data-consent="wait"' : '';
    parts.push(`<script async src="${api}/a/pms.js" data-site="${key}"${consent}></script>`);
  }
  const bookingOnPage = ctx.page.sections.some(usesHotelWidget);
  if (ctx.bookingLive && bookingOnPage) parts.push(`<script async src="${api}/w/widget.js" data-site="${key}"></script>`);
  if (pageNeedsLead(ctx))
    parts.push(`<script defer src="${LEAD_PATH}" data-api="${api}" data-site="${key}" data-locale="${esc(ctx.locale)}"></script>`);
  if (pageNeedsPrices(ctx))
    parts.push(
      `<script defer src="${PRICES_PATH}" data-api="${api}" data-site="${key}" data-locale="${INTL_LOCALE[ctx.locale]}" data-label="${esc(PRICE_LABEL[ctx.locale])}"></script>`,
    );
  return parts.join('');
}
