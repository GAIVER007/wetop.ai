/**
 * Подставной API библиотеки изображений сайта (MKT8) для UI-тестов. Только вымышленные данные (ADR-010). Правила
 * повторяют API там, где их видит стойка: тип файла по содержимому (SVG и HTML 415), предел 10 МиБ (413), повтор той же
 * картинки возвращает тот же ассет, удаление картинки опубликованной версии её удерживает, импорт Channex по кодам фото
 * без адресов. Картинки отдаются data:-адресами SVG (стенд без хранилища), ключей объектов нет.
 */
type Kind = 'IMAGE' | 'LOGO' | 'FAVICON';
interface Asset {
  id: string;
  kind: Kind;
  status: 'READY';
  source: 'UPLOAD' | 'CHANNEX_IMPORT';
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  defaultAlt: Record<string, string> | null;
  createdAt: string;
  previewUrl: string;
}

const MAX = 10 * 1024 * 1024;
const COLORS = ['#2f7d6d', '#a65f2b', '#4a5d9c', '#7b3f6e', '#5b7f2a', '#9c4a4a'];
const svg = (n: number, w: number, h: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${COLORS[n % COLORS.length]}"/><circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.12}" fill="#fff" fill-opacity="0.6"/></svg>`,
  )}`;
const hex = (n: number) => n.toString(16).padStart(8, '0');
const idOf = (n: number) => `${hex(n)}-0000-4000-8000-${hex(n).padStart(12, '0')}`;

const PHOTOS = [
  { photoId: 'a'.repeat(64), description: 'Фасад гостиницы', forRoomType: false, position: 0 },
  { photoId: 'b'.repeat(64), description: 'Двухместный номер', forRoomType: true, position: 1 },
  { photoId: 'c'.repeat(64), description: null, forRoomType: false, position: 2 },
  { photoId: 'd'.repeat(64), description: 'Ресепшн', forRoomType: false, position: 3 },
];

let counter = 0;
let assets: Asset[] = [];
/** Картинки, которые использует опубликованная версия: удаление их удерживает */
let published = new Set<string>();
let storageOff = false;
let channexState = 'READY';

function make(kind: Kind, source: Asset['source'], defaultAlt: Record<string, string> | null, seed: number): Asset {
  counter += 1;
  const [w, h] = kind === 'FAVICON' ? [512, 512] : kind === 'LOGO' ? [640, 160] : [1600, 1067];
  return {
    id: idOf(counter),
    kind,
    status: 'READY',
    source,
    mimeType: kind === 'FAVICON' ? 'image/png' : 'image/webp',
    byteSize: kind === 'FAVICON' ? 18_432 : 214_000 + seed * 1_000,
    width: w,
    height: h,
    sha256: hex(seed).repeat(8),
    defaultAlt,
    createdAt: new Date(Date.parse('2026-10-07T09:00:00.000Z') + counter * 60_000).toISOString(),
    previewUrl: svg(seed, w, h),
  };
}

/** Картинка библиотеки по id: фото категорий склеивают выбор со стендом библиотеки */
export function fixtureAssetById(id: string): Asset | undefined {
  return assets.find((a) => a.id === id);
}

export function resetSiteAssetsFixture() {
  counter = 0;
  storageOff = false;
  channexState = 'READY';
  assets = [
    make('IMAGE', 'UPLOAD', { ru: 'Фасад гостиницы вечером' }, 1),
    make('IMAGE', 'CHANNEX_IMPORT', { ru: 'Двухместный номер' }, 2),
    make('LOGO', 'UPLOAD', null, 3),
  ];
  published = new Set([assets[0]!.id]);
}
resetSiteAssetsFixture();

/** Готовые картинки библиотеки по id и виду: редактор MKT9 проверяет ссылки документа так же, как API */
export function fixtureAssetKinds(): Map<string, Kind> {
  return new Map(assets.map((a) => [a.id, a.kind]));
}

const field = (raw: string, name: string) => new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`).exec(raw)?.[1];
const view = () => ({ storage: storageOff ? 'OFF' : 'READY', limits: { maxUploadBytes: MAX }, assets: storageOff ? assets.map((a) => ({ ...a, previewUrl: null })) : assets });

export function siteAssetsFixture(
  path: string,
  method: string,
  body: Record<string, unknown>,
  raw: Buffer,
): { status: number; data: unknown } | null {
  if (path === '/__test/site-assets' && method === 'POST') {
    resetSiteAssetsFixture();
    if (body['empty'] === true) assets = [];
    if (body['storageOff'] === true) storageOff = true;
    if (typeof body['channexState'] === 'string') channexState = body['channexState'];
    return { status: 200, data: { ok: true } };
  }
  if (!path.startsWith('/marketing/site/assets')) return null;
  if (path === '/marketing/site/assets' && method === 'GET') return { status: 200, data: view() };
  if (path === '/marketing/site/assets' && method === 'POST') {
    if (storageOff) return { status: 503, data: { code: 'ASSET_STORAGE_UNAVAILABLE', message: 'Хранилище изображений не настроено' } };
    if (raw.length > MAX) return { status: 413, data: { message: 'File too large' } };
    const text = raw.toString('latin1');
    const kind = field(text, 'kind') as Kind | undefined;
    if (!kind || !['IMAGE', 'LOGO', 'FAVICON'].includes(kind)) return { status: 400, data: { message: 'kind: IMAGE, LOGO или FAVICON' } };
    if (/<svg|<!doctype|<html/i.test(text))
      return { status: 415, data: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Подходят только JPEG, PNG и WebP без анимации' } };
    // повтор по содержимому файла, а не по всему телу: имя файла у копии другое
    const start = text.indexOf('\r\n\r\n', text.indexOf('name="file"'));
    const end = text.indexOf('\r\n--', start + 4);
    const seed = (end - start) % 97;
    const again = assets.find((a) => a.kind === kind && a.sha256 === hex(seed).repeat(8));
    if (again) return { status: 200, data: { asset: again, created: false } };
    const asset = make(kind, 'UPLOAD', null, seed);
    assets = [asset, ...assets];
    return { status: 201, data: { asset, created: true } };
  }
  if (path === '/marketing/site/assets/channex' && method === 'GET')
    return { status: 200, data: { state: channexState, photos: channexState === 'READY' ? PHOTOS : [] } };
  if (path === '/marketing/site/assets/channex/import' && method === 'POST') {
    const ids = Array.isArray(body['photoIds']) ? (body['photoIds'] as string[]) : [];
    const imported: unknown[] = [];
    const failed: Array<{ photoId: string; code: string }> = [];
    for (const photoId of ids) {
      const photo = PHOTOS.find((p) => p.photoId === photoId);
      if (!photo) failed.push({ photoId, code: 'UNKNOWN_PHOTO' });
      else if (photo.position === 3) failed.push({ photoId, code: 'HOST_NOT_PUBLIC' });
      else {
        const asset = make('IMAGE', 'CHANNEX_IMPORT', photo.description ? { ru: photo.description } : null, 10 + photo.position);
        assets = [asset, ...assets];
        imported.push({ photoId, created: true, asset });
      }
    }
    return { status: 200, data: { imported, failed } };
  }
  const one = /^\/marketing\/site\/assets\/([^/]+)$/.exec(path);
  const asset = one ? assets.find((a) => a.id === one[1]) : undefined;
  if (one && !asset) return { status: 404, data: { message: 'Изображение не найдено' } };
  if (asset && method === 'PATCH') {
    const alt = body['defaultAlt'] as Record<string, string> | null;
    if (alt && Object.values(alt).some((v) => v.length > 150)) return { status: 400, data: { message: 'ALT: не длиннее 150 знаков' } };
    asset.defaultAlt = alt && Object.values(alt).some((v) => v.trim()) ? alt : null;
    return { status: 200, data: { asset } };
  }
  if (asset && method === 'DELETE') {
    assets = assets.filter((a) => a.id !== asset.id);
    return { status: 200, data: { deleted: true, retainedForPublishedHistory: published.has(asset.id) } };
  }
  return null;
}
