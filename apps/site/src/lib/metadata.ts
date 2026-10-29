import type { Metadata } from 'next';
import { getDictionary, localeInfo, type Locale } from '../i18n';

type OpenGraph = NonNullable<Metadata['openGraph']>;

type PageMeta = {
  /** Путь страницы со слешем в конце: `/`, `/blog/`, `/blog/<slug>/`. */
  path: string;
  title?: string;
  description?: string;
  /** Картинка ссылки страницы, 1200×630 (`public/og/`, обрезка фото лендинга); без неё общая `og.png`. */
  image?: string;
  /** Канонический адрес, если он не сама страница: дубль отдаёт вес основной странице. */
  canonical?: string;
  /** Язык страницы: словарь и og:locale. По умолчанию русский. */
  locale?: Locale;
  /** Пары hreflang → путь (включая x-default), если у страницы есть версия на другом языке. */
  languages?: Record<string, string>;
};

/** Разделитель названия сайта в заголовке: виден в выдаче, поэтому не длинное тире (CLAUDE.md §5). */
export const TITLE_SEPARATOR = ' | ';

/*
 * Картинка ссылки одна на весь сайт: `public/og.png`, её рисует `scripts/site/make-og-image.mjs` из настоящих
 * стилей сайта. Она перечисляется здесь, а не файлом-соглашением `opengraph-image.png`: страницы задают
 * `openGraph` целиком, и тогда Next подставляет картинку соглашения не везде — у `/blog/` её не оказалось.
 */
// `?v=` меняется при перерисовке: Telegram и WhatsApp иначе показывают старую картинку из кэша
const OG_IMAGE = { url: '/og.png?v=2', width: 1200, height: 630 };

/*
 * OpenGraph и canonical для страницы. Next сливает metadata слоёв неглубоко: `openGraph` страницы целиком
 * заменяет `openGraph` макета, поэтому название сайта, язык и картинка добавляются здесь каждый раз.
 */
function base({ path, title, description, image, locale }: PageMeta) {
  const t = getDictionary(locale);
  const full = title ? `${title}${TITLE_SEPARATOR}${t.meta.siteName}` : t.meta.title;
  return {
    siteName: t.meta.siteName,
    images: [image ? { ...OG_IMAGE, url: image, alt: full } : { ...OG_IMAGE, alt: full }],
    locale: localeInfo(locale).openGraphLocale,
    url: path,
    // Как в <title>: шаблон «%s | WETOP.AI» из макета к OpenGraph сам не применяется.
    title: full,
    description: description ?? t.meta.description,
  };
}

export function websiteOpenGraph(page: PageMeta): OpenGraph {
  return { ...base(page), type: 'website' };
}

export function articleOpenGraph(page: PageMeta & { publishedTime: string }): OpenGraph {
  return { ...base(page), type: 'article', publishedTime: page.publishedTime };
}

export function pageMetadata(page: PageMeta): Metadata {
  return {
    ...(page.title ? { title: page.title } : {}),
    ...(page.description ? { description: page.description } : {}),
    alternates: {
      canonical: page.canonical ?? page.path,
      ...(page.languages ? { languages: page.languages } : {}),
    },
    openGraph: websiteOpenGraph(page),
    // Крупная картинка в Telegram, X и мессенджерах, читающих twitter:*; заголовок и описание те же
    twitter: {
      card: 'summary_large_image',
      images: [page.image ?? OG_IMAGE.url],
    },
  };
}
