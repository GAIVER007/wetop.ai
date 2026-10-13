import { absoluteUrl } from '../lib/site';

/*
 * Структурированные данные schema.org для поисковиков (11.10.2026). Скрипт `application/ld+json` в теле
 * страницы: Google читает его и там. `<` экранируется, чтобы текст словаря не мог закрыть тег скрипта.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export function faqLd(items: Array<{ q: string; a: string }>) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

/** Хлебные крошки: путь от главной до страницы, адреса полные. */
export function breadcrumbLd(trail: Array<{ name: string; path: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}
