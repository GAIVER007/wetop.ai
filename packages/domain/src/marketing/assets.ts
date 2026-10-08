import { plainTextProblem } from './site-spec';

/**
 * Изображения управляемого сайта (MKT8, `DATA_MODEL.md` §29.5, `docs/marketing/site-assets-v0.md`). Здесь только
 * чистые правила без хранилища и декодера: какие ассеты нужны документу и какого вида, тип файла по сигнатуре, подсказка
 * ALT и ключ объекта. Поставщика хранилища домен не знает (Q-270): ключ непрозрачный и выводится из строки ассета.
 */
export type SiteAssetKind = 'IMAGE' | 'LOGO' | 'FAVICON';
export const SITE_ASSET_KINDS: readonly SiteAssetKind[] = ['IMAGE', 'LOGO', 'FAVICON'];

/** Пределы ТЗ MKT8: вход до 10 МиБ (двоичных), 40 млн точек и 12 000 по стороне; выход WebP 82 до 2400 / 1600, PNG 512 */
export const SITE_ASSET_LIMITS = Object.freeze({
  maxUploadBytes: 10 * 1024 * 1024,
  maxInputPixels: 40_000_000,
  maxInputSide: 12_000,
  imageMaxSide: 2400,
  logoMaxSide: 1600,
  faviconSide: 512,
  webpQuality: 82,
});

export interface SiteSpecAssetRef {
  assetId: string;
  expectedKind: SiteAssetKind;
  /** Путь в документе для сообщения об ошибке, как у валидатора SiteSpec */
  path: string;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Секции с одной картинкой `image` (§8 SiteSpec): герой, «о нас», призыв */
const SINGLE_IMAGE_SECTIONS = new Set(['hero', 'about', 'cta']);

/**
 * Ссылки документа на ассеты по известным местам схемы SiteSpec v0, не по любому ключу: логотип → `LOGO`, фавиконка →
 * `FAVICON`, картинка соцсетей страницы и картинки секций → `IMAGE`. Тот же ассет в двух местах даёт две ссылки (у
 * каждой свой путь). Id приводится к нижнему регистру: в базе это UUID, сравнение без учёта регистра
 */
export function siteSpecAssetRefs(spec: unknown): SiteSpecAssetRef[] {
  const refs: SiteSpecAssetRef[] = [];
  const add = (value: unknown, expectedKind: SiteAssetKind, path: string) => {
    if (typeof value === 'string' && UUID_RE.test(value)) refs.push({ assetId: value.toLowerCase(), expectedKind, path });
  };
  const image = (value: unknown, path: string) => {
    if (isRec(value)) add(value['assetId'], 'IMAGE', `${path}.assetId`);
  };
  const images = (value: unknown, path: string) => list(value).forEach((img, i) => image(img, `${path}[${i}]`));
  if (!isRec(spec)) return refs;
  const site = isRec(spec['site']) ? spec['site'] : {};
  const brand = isRec(site['brand']) ? site['brand'] : {};
  if (isRec(brand['logo'])) add(brand['logo']['assetId'], 'LOGO', 'site.brand.logo.assetId');
  add(brand['faviconAssetId'], 'FAVICON', 'site.brand.faviconAssetId');
  list(spec['pages']).forEach((page, p) => {
    if (!isRec(page)) return;
    const seo = isRec(page['seo']) ? page['seo'] : {};
    if (isRec(seo['og'])) add(seo['og']['imageAssetId'], 'IMAGE', `pages[${p}].seo.og.imageAssetId`);
    list(page['sections']).forEach((section, s) => {
      if (!isRec(section)) return;
      const at = `pages[${p}].sections[${s}]`;
      const type = section['type'];
      if (typeof type === 'string' && SINGLE_IMAGE_SECTIONS.has(type)) image(section['image'], `${at}.image`);
      else if (type === 'gallery') images(section['images'], `${at}.images`);
      else if (type === 'accommodations')
        list(section['items']).forEach((item, i) => {
          if (isRec(item)) images(item['images'], `${at}.items[${i}].images`);
        });
    });
  });
  return refs;
}

export type SniffedImage = 'jpeg' | 'png' | 'webp';

const startsWith = (b: Uint8Array, sig: number[], at = 0) => b.length >= at + sig.length && sig.every((x, i) => b[at + i] === x);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/**
 * Тип файла только по содержимому, не по имени и не по `Content-Type` браузера. Принимаются JPEG, PNG и WebP; SVG,
 * GIF, AVIF, HEIC, TIFF, BMP, PDF, HTML и XML не узнаются вовсе (null). Окончательное слово за декодером: формат,
 * который он увидит, обязан совпасть с сигнатурой
 */
export function sniffImageType(b: Uint8Array): SniffedImage | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8)) return 'webp';
  return null;
}

export function parseAssetKind(value: unknown): SiteAssetKind | null {
  return typeof value === 'string' && (SITE_ASSET_KINDS as readonly string[]).includes(value) ? (value as SiteAssetKind) : null;
}

const ALT_LOCALES = ['ru', 'kk', 'en'];
export const SITE_ASSET_ALT_MAX = 150;

export type DefaultAltResult = { ok: true; value: Record<string, string> | null } | { ok: false; message: string };

/**
 * Подсказка ALT ассета: те же языки и правила обычного текста, что у SiteSpec, до 150 знаков. Пустой объект и пустые
 * строки снимают подсказку (null). В документе явный `ImageRef.alt` всегда главнее
 */
export function parseDefaultAlt(value: unknown): DefaultAltResult {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (!isRec(value)) return { ok: false, message: 'ALT: объект вида { "ru": "…" }' };
  const out: Record<string, string> = {};
  for (const [locale, raw] of Object.entries(value)) {
    if (!ALT_LOCALES.includes(locale)) return { ok: false, message: `ALT: язык «${locale}» не поддерживается` };
    if (typeof raw !== 'string') return { ok: false, message: 'ALT: ожидается строка' };
    const problem = plainTextProblem(raw);
    if (problem) return { ok: false, message: `ALT: ${problem}` };
    const trimmed = raw.trim();
    if ([...trimmed].length > SITE_ASSET_ALT_MAX) return { ok: false, message: `ALT: не длиннее ${SITE_ASSET_ALT_MAX} знаков` };
    if (trimmed) out[locale] = trimmed;
  }
  return { ok: true, value: Object.keys(out).length ? out : null };
}

/** Ключ объекта: филиал, id ассета и sha256 готовых байтов; имя файла пользователя в ключ не попадает никогда */
export function siteAssetStorageKey(locationId: string, assetId: string, sha256: string, kind: SiteAssetKind): string {
  return `site-assets/${locationId}/${assetId}/${sha256}.${kind === 'FAVICON' ? 'png' : 'webp'}`;
}
