/**
 * Набор фото WETOP для сайтов без своих фото (владелец 29.10.2026: «подбор фото, когда у клиента нет своих»). Фото с
 * Pexels (https://www.pexels.com/license/: бесплатно, в том числе в коммерческих целях, без указания автора; автор и
 * страница сохранены здесь для порядка). Файлы не копируются к нам: адрес `images.pexels.com` идёт прямо в `<img>`,
 * поэтому хранилище картинок для них не нужно, а CSP сайта пропускает только этот origin.
 *
 * У фото набора постоянный id вида UUID с префиксом `57c0f070-0000-4000-8000-`: так документ SiteSpec не меняет схему
 * (картинка это `{ assetId, alt }`), а сервер и рантайм отличают фото набора от загруженных клиентом. Своё фото клиента
 * всегда главнее: шаблон меняет только фото набора.
 */
import type { SiteSpecAssetRef } from './assets';

export interface StockPhoto {
  templateId: string;
  assetId: string;
  url: string;
  alt: Readonly<Record<'ru' | 'kk' | 'en', string>>;
  /** Первый экран шаблона с этим фото: на весь экран или фото сбоку */
  heroVariant: 'IMAGE_FULL' | 'IMAGE_SIDE';
  photographer: string;
  source: string;
}

export const STOCK_ORIGIN = 'https://images.pexels.com';
const STOCK_PREFIX = '57c0f070-0000-4000-8000-';

export const STOCK_PHOTOS: readonly StockPhoto[] = Object.freeze([
  { templateId: 'hotel-classic', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000001', url: 'https://images.pexels.com/photos/2725675/pexels-photo-2725675.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Уютный номер с большой кроватью', kk: 'Үлкен төсегі бар жайлы нөмір', en: 'Cozy room with a large bed' }, photographer: "Engin Akyurt", source: 'https://www.pexels.com/photo/modern-style-bedroom-2725675/' },
  { templateId: 'hotel-boutique', heroVariant: 'IMAGE_FULL', assetId: '57c0f070-0000-4000-8000-000000000002', url: 'https://images.pexels.com/photos/2736388/pexels-photo-2736388.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Номер отеля с мягким светом', kk: 'Жұмсақ жарықты қонақүй нөмірі', en: 'Hotel room in soft light' }, photographer: "Engin Akyurt", source: 'https://www.pexels.com/photo/white-bed-sheet-set-2736388/' },
  { templateId: 'hotel-hostel', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000003', url: 'https://images.pexels.com/photos/7587828/pexels-photo-7587828.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Светлая гостиная апартаментов', kk: 'Пәтердің жарық қонақ бөлмесі', en: 'Bright apartment living room' }, photographer: "Max Vakhtbovych", source: 'https://www.pexels.com/photo/modern-apartment-interior-7587828/' },
  { templateId: 'beauty-studio', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000004', url: 'https://images.pexels.com/photos/7750114/pexels-photo-7750114.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Светлый зал салона красоты', kk: 'Сұлулық салонының жарық залы', en: 'Bright beauty salon hall' }, photographer: "Max Vakhtbovych", source: 'https://www.pexels.com/photo/beauty-salon-interior-design-7750114/' },
  { templateId: 'beauty-boutique', heroVariant: 'IMAGE_FULL', assetId: '57c0f070-0000-4000-8000-000000000005', url: 'https://images.pexels.com/photos/8554941/pexels-photo-8554941.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Мастер наращивает ресницы', kk: 'Шебер кірпік ұзартып жатыр', en: 'Lash artist at work' }, photographer: "Екатерина Мясоед", source: 'https://www.pexels.com/photo/close-up-of-woman-at-beautician-8554941/' },
  { templateId: 'beauty-express', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000006', url: 'https://images.pexels.com/photos/6135686/pexels-photo-6135686.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Маникюр с красным лаком', kk: 'Қызыл лакпен маникюр', en: 'Manicure with red polish' }, photographer: "Gabriel Puyén", source: 'https://www.pexels.com/photo/a-person-applying-nail-polish-6135686/' },
  { templateId: 'food-cafe', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000007', url: 'https://images.pexels.com/photos/18721982/pexels-photo-18721982.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Светлый зал кафе с зеленью', kk: 'Жасыл өсімдіктері бар жарық кафе залы', en: 'Bright cafe hall with greenery' }, photographer: "Arda Kaykısız", source: 'https://www.pexels.com/photo/plants-near-chairs-in-restaurant-18721982/' },
  { templateId: 'food-restaurant', heroVariant: 'IMAGE_FULL', assetId: '57c0f070-0000-4000-8000-000000000008', url: 'https://images.pexels.com/photos/32523798/pexels-photo-32523798.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Зал ресторана со стеной вина', kk: 'Шарап қабырғасы бар мейрамхана залы', en: 'Restaurant hall with a wine wall' }, photographer: "Diana ✨", source: 'https://www.pexels.com/photo/elegant-wine-wall-in-modern-restaurant-setting-32523798/' },
  { templateId: 'food-delivery', heroVariant: 'IMAGE_SIDE', assetId: '57c0f070-0000-4000-8000-000000000009', url: 'https://images.pexels.com/photos/5374420/pexels-photo-5374420.jpeg?auto=compress&cs=tinysrgb&w=1920', alt: { ru: 'Сочный бургер крупным планом', kk: 'Шырынды бургер жақын планда', en: 'Juicy burger close-up' }, photographer: "Engin Akyurt", source: 'https://www.pexels.com/photo/burger-sliced-in-half-5374420/' },
]);

const BY_TEMPLATE = new Map(STOCK_PHOTOS.map((p) => [p.templateId, p]));
const BY_ID = new Map(STOCK_PHOTOS.map((p) => [p.assetId, p]));

/** Фото набора для шаблона или `null` */
export function stockPhotoFor(templateId: string): StockPhoto | null {
  return BY_TEMPLATE.get(templateId) ?? null;
}

/** Это id фото набора WETOP (а не загруженного клиентом) */
export function isStockAssetId(id: unknown): boolean {
  return typeof id === 'string' && BY_ID.has(id.toLowerCase());
}

/** Картинка документа для фото набора: ALT на языках сайта (язык по умолчанию первым) */
export function stockImage(photo: StockPhoto, locales: readonly string[]): { assetId: string; alt: Record<string, string> } {
  const alt: Record<string, string> = {};
  for (const l of locales) if (l === 'ru' || l === 'kk' || l === 'en') alt[l] = photo.alt[l];
  if (!Object.keys(alt).length) alt['ru'] = photo.alt.ru;
  return { assetId: photo.assetId, alt };
}

/** Адрес фото набора по id или `undefined` (рендер: запасной путь, если в карте ассетов его нет) */
export function stockPhotoUrl(id: unknown): string | undefined {
  return typeof id === 'string' ? BY_ID.get(id.toLowerCase())?.url : undefined;
}

/** Ссылки документа без фото набора: их проверять в библиотеке филиала не нужно */
export function withoutStockRefs(refs: SiteSpecAssetRef[]): SiteSpecAssetRef[] {
  return refs.filter((r) => !isStockAssetId(r.assetId));
}

/** Карта `assetId → адрес` для фото набора из ссылок документа (только картинки секций, не логотип) */
export function stockAssetMap(refs: SiteSpecAssetRef[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const ref of refs) {
    const photo = BY_ID.get(ref.assetId.toLowerCase());
    if (photo && ref.expectedKind === 'IMAGE') map[ref.assetId] = photo.url;
  }
  return map;
}
