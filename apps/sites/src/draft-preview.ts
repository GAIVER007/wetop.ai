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
  /**
   * MKT9.2, режим «Текст»: пути текстов, которые можно править прямо на сайте (их выбирает стойка правилом
   * `inlineTextTargets` домена). Такой текст в теле страницы оборачивается в `<span data-editor-path>`; в атрибутах,
   * заголовке вкладки и разметке поисковиков он остаётся обычным текстом. Публичный рендер меток не ставит никогда
   */
  editorPaths?: readonly string[];
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
  'main section[data-ed-selected]{outline:3px solid #2563eb;outline-offset:-3px}' +
  // MKT9.2, режим «Текст»: правится текст, а не блок; редактируемый текст обведён
  'html[data-ed-mode="text"] main section{cursor:default}' +
  'html[data-ed-mode="text"] main section:hover{outline:none}' +
  'html[data-ed-mode="text"] [data-editor-path]{cursor:text;border-radius:2px}' +
  'html[data-ed-mode="text"] [data-editor-path]:hover{outline:2px dashed #2563eb;outline-offset:2px}' +
  '[data-editor-path][contenteditable]{outline:2px solid #2563eb;outline-offset:2px;background:#eff6ff}';

const OPEN = '\uE000';
const MID = '\uE001';
const CLOSE = '\uE002';
const MARK_RE = /\uE000(\d+)\uE001([\s\S]*?)\uE002/g;

/** Узел документа по пути вида `pages[0].sections[1].heading`; нет такого: `undefined` */
function nodeAt(root: unknown, path: string): Record<string, unknown> | undefined {
  let node: unknown = root;
  for (const m of path.matchAll(/([a-zA-Z]+)|\[(\d+)\]/g)) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[m[1] ?? Number(m[2])];
  }
  return node !== null && typeof node === 'object' && !Array.isArray(node) ? (node as Record<string, unknown>) : undefined;
}

/** Метки вокруг текстов целей на языке просмотра: служебные знаки, которых не бывает в тексте документа */
function markTexts(spec: SiteSpec, locale: Locale, paths: readonly string[]): SiteSpec {
  const copy = structuredClone(spec);
  paths.forEach((path, i) => {
    const node = nodeAt(copy, path);
    const text = node?.[locale];
    if (typeof text === 'string' && text) node![locale] = `${OPEN}${i}${MID}${text}${CLOSE}`;
  });
  return copy;
}

/**
 * Разметка меток: в тексте тела страницы метка становится `<span data-editor-path>`; внутри тегов (атрибуты), скриптов
 * и `<head>` метка снимается, остаётся текст
 */
function placeMarks(html: string, paths: readonly string[]): string {
  const strip = (part: string) => part.replace(MARK_RE, '$2');
  const at = html.indexOf('<body');
  if (at < 0) return strip(html);
  const body = html
    .slice(at)
    .split(/(<script[\s\S]*?<\/script>|<[^>]+>)/)
    .map((part, i) =>
      i % 2 === 1
        ? strip(part)
        : part.replace(MARK_RE, (_m, n: string, text: string) => {
            const path = paths[Number(n)];
            return path ? `<span data-editor-path="${path}">${text}</span>` : text;
          }),
    )
    .join('');
  return strip(html.slice(0, at)) + body;
}

export function renderDraftPreview(input: DraftPreviewInput): DraftPreview {
  try {
    const original = input.spec as SiteSpec;
    if (!Array.isArray(original?.pages) || original.pages.length === 0) return { ok: false };
    const paths = input.editorPaths ?? [];
    const spec = paths.length ? markTexts(original, input.locale, paths) : original;
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
    const rendered = renderPage(ctx, SEO, CSS_PATH).replace(`<link rel="stylesheet" href="${CSS_PATH}">`, `<style>${SITE_CSS}${EDITOR_PREVIEW_CSS}</style>`);
    const html = paths.length ? placeMarks(rendered, paths) : rendered;
    return { ok: true, html, pageId: page.id };
  } catch {
    return { ok: false };
  }
}
