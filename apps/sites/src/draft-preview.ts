import { CSS_PATH } from './assets';
import type { RenderContext } from './render/context';
import { renderPage } from './render/page';
import { SITE_CSS } from './render/theme';
import type { SeoSettings } from './seo';
import type { Locale, SiteSpec } from './types';

/**
 * Живой просмотр черновика в редакторе стойки (MKT9.1, `plans/mkt9-1-editor-live-preview-2026-10-07.md`). Тот же рендер,
 * что у Worker, но по документу на экране, без сохранения: без ключа сайта, брони, счётчика, цен «от» и токена превью;
 * стили рантайма внутри страницы, потому что рамка `srcdoc` их файла не видит; `noindex`. Чистая функция: ни сети, ни
 * времени. Документ, который рендер не может нарисовать, даёт `ok: false`, стойка держит прошлый кадр.
 */
export interface DraftPreviewInput {
  spec: unknown;
  /** Страница просмотра; неизвестная или `null`: главная */
  pageId: string | null;
  locale: Locale;
  /** `assetId → адрес` из библиотеки филиала; нет адреса, нет и картинки */
  assets: Record<string, string>;
}

export type DraftPreview = { ok: true; html: string; pageId: string } | { ok: false };

const SEO: SeoSettings = { indexable: false, canonicalOrigin: null, sitemapOrigin: 'https://preview.invalid' };

/**
 * Подсветка блоков только в редакторе: наведённая секция обведена пунктиром, выбранная (атрибут ставит стойка) сплошной
 * рамкой. На опубликованный сайт и превью MKT7 не попадает.
 */
export const EDITOR_PREVIEW_CSS =
  'main section{cursor:pointer}' +
  'main section:hover{outline:2px dashed #2563eb;outline-offset:-2px}' +
  'main section[data-ed-selected]{outline:3px solid #2563eb;outline-offset:-3px}';

export function renderDraftPreview(input: DraftPreviewInput): DraftPreview {
  try {
    const spec = input.spec as SiteSpec;
    if (!Array.isArray(spec?.pages) || spec.pages.length === 0) return { ok: false };
    const page = spec.pages.find((p) => p.id === input.pageId) ?? spec.pages.find((p) => p.isHome) ?? spec.pages[0]!;
    const ctx: RenderContext = {
      spec,
      locale: input.locale,
      page,
      facts: null,
      publicKey: null,
      bookingLive: false,
      apiOrigin: null,
      assets: input.assets,
      previewToken: null,
    };
    const html = renderPage(ctx, SEO, CSS_PATH).replace(`<link rel="stylesheet" href="${CSS_PATH}">`, `<style>${SITE_CSS}${EDITOR_PREVIEW_CSS}</style>`);
    return { ok: true, html, pageId: page.id };
  } catch {
    return { ok: false };
  }
}
