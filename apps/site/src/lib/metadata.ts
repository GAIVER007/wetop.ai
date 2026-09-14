import type { Metadata } from 'next';
import { getDictionary, localeInfo } from '../i18n';

type OpenGraph = NonNullable<Metadata['openGraph']>;

type PageMeta = {
  /** Путь страницы со слешем в конце: `/`, `/blog/`, `/blog/<slug>/`. */
  path: string;
  title?: string;
  description?: string;
};

/*
 * OpenGraph и canonical для страницы. Next сливает metadata слоёв неглубоко: `openGraph` страницы целиком
 * заменяет `openGraph` макета, поэтому название сайта и язык добавляются здесь каждый раз.
 */
function base({ path, title, description }: PageMeta) {
  const t = getDictionary();
  return {
    siteName: t.meta.siteName,
    locale: localeInfo().openGraphLocale,
    url: path,
    // Как в <title>: шаблон «%s — WETOP» из макета к OpenGraph сам не применяется.
    title: title ? `${title} — ${t.meta.siteName}` : t.meta.title,
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
    alternates: { canonical: page.path },
    openGraph: websiteOpenGraph(page),
  };
}
