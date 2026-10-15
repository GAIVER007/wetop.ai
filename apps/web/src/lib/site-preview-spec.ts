import { applyDesignDirection, type DesignDirection } from '@pms/domain';
import { formatMoney } from './money';
import { catalogPrice, type SiteFacts } from './site-facts';
import { verticalCopy } from './vertical-copy';

/**
 * Документ мини-превью карточки дизайна (SITE-1): первый экран сайта филиала тем же рендером, что у опубликованного
 * сайта (`apps/sites`), только из фактов филиала и без ИИ: название, город, кнопка «Записаться / Забронировать» и три
 * первые позиции каталога. Документ живёт только в браузере и никуда не сохраняется; сайт создаёт сервер.
 *
 * `site.vertical` здесь HOSPITALITY для всех направлений: в SiteSpec v0 других значений нет (SITE-2 добавит), а
 * рендер по нему ничего не выбирает.
 */
const t = (ru: string) => ({ ru });
const cut = (s: string, n: number) => ([...s].length > n ? `${[...s].slice(0, n - 1).join('')}…` : s);

export function previewSpec(facts: SiteFacts, direction: DesignDirection): Record<string, unknown> {
  const copy = verticalCopy(facts.vertical);
  const name = cut(facts.location.name.trim() || 'Ваш сайт', 80);
  const place = facts.location.city ?? facts.location.address;
  const top = facts.catalog.items.slice(0, 3).map((item) => ({
    title: cut(item.name, 60),
    text: cut(
      catalogPrice(item, formatMoney) ?? (item.durationMin ? `${item.durationMin} мин` : (item.category ?? copy.catalogTitle)),
      200,
    ),
  }));
  const book = { label: t(copy.bookAction), action: { kind: 'BOOK' } };
  const catalog =
    top.length >= 2
      ? [{ id: 'sec-catalog', type: 'features', variant: 'GRID', heading: t(copy.catalogTitle), items: top.map((i) => ({ icon: 'STAR', title: t(i.title), text: t(i.text) })) }]
      : top.length === 1
        ? [{ id: 'sec-catalog', type: 'about', variant: 'TEXT_ONLY', heading: t(copy.catalogTitle), paragraphs: [t(`${top[0]!.title}: ${top[0]!.text}`)] }]
        : [];
  const spec = {
    schemaVersion: 'site-spec/0',
    site: {
      vertical: 'HOSPITALITY',
      displayName: t(name),
      defaultLocale: 'ru',
      locales: ['ru'],
      seo: { robots: 'NOINDEX', structuredData: { type: 'LODGING', includeAddress: false, includeGeo: false } },
    },
    theme: { ...direction.theme },
    navigation: { header: [], footer: [], headerCta: book },
    pages: [
      {
        id: 'page-home',
        slug: '',
        isHome: true,
        title: t(name),
        seo: { index: false, includeInSitemap: false, canonical: 'SELF' },
        sections: [
          { id: 'sec-hero', type: 'hero', variant: 'TEXT_ONLY', heading: t(name), ...(place ? { subheading: t(cut(place, 200)) } : {}), primaryAction: book },
          ...catalog,
          { id: 'sec-booking', type: 'booking', variant: 'INLINE', heading: t(copy.bookAction) },
        ],
      },
    ],
    integrations: { booking: { mode: 'WETOP_WIDGET' }, analytics: { mode: 'NONE', consent: 'NOT_REQUIRED' } },
  };
  return applyDesignDirection(spec, direction);
}

/**
 * Разметка превью без фокусируемого: ссылки становятся текстом с тем же классом, ссылка «к содержимому» убирается.
 * Карточка дизайна выбирается целиком, внутри рамки нажимать нечего, и клавиатура в неё не попадает
 */
/** В превью виджета брони нет: строку «бронирование недоступно» и кнопку звонка в блоке брони не показываем */
const PREVIEW_CSS = '#sec-booking p,#sec-booking .btn{display:none}';
/**
 * Первый экран превью окрашен акцентом у глубоких пресетов (NIGHT): без фото первый экран всех трёх направлений иначе
 * выглядел бы одинаково светлым. Это только картинка карточки, документ сайта не меняется
 */
const DEEP_HERO_CSS =
  '.p-night .hero{background:var(--text);color:var(--bg)}.p-night .hero .lead{color:var(--border)}' +
  '.p-night .hero .btn{background:var(--bg);color:var(--text);border-color:var(--bg)}';

export function inertPreviewHtml(html: string): string {
  return html
    .replace('</head>', `<style>${PREVIEW_CSS}${DEEP_HERO_CSS}</style></head>`)
    .replace(/<a class="skip"[^>]*>[\s\S]*?<\/a>/, '')
    .replace(/<a\b[^>]*?(\sclass="[^"]*")?[^>]*>/g, (_m, cls: string | undefined) => `<span${cls ?? ''}>`)
    .replace(/<\/a>/g, '</span>');
}
