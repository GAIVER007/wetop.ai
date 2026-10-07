/**
 * Типы публичного рантайма (MKT4). Контракт `GET /sites-runtime/current` повторён здесь структурно: Worker не тянет
 * пакеты API и базы. Документ SiteSpec v0 уже проверен API тем же валидатором, что сохранение; рантайм держит второй
 * рубеж своим реестром секций (`render/sections.ts`).
 */
export type Locale = 'ru' | 'kk' | 'en';
export type LocalizedText = Partial<Record<Locale, string>>;

export interface PublicCategoryFact {
  code: string;
  active: boolean;
  capacityAdults?: number;
}

export interface PublicFacts {
  loadedAt: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  categories: PublicCategoryFact[];
}

export interface RuntimeCurrent {
  siteId: string;
  state: 'PUBLISHED';
  primaryHost: string | null;
  defaultLocale: Locale;
  versionId: string;
  schemaVersion: string;
  specHash: string;
  spec?: SiteSpec;
  publicKey: string | null;
  bookingEnabled: boolean;
  publicApiUrl: string;
  assets: Record<string, string>;
  publicFacts: PublicFacts | null;
}

export type Target =
  | { kind: 'PAGE'; pageId: string }
  | { kind: 'SECTION'; pageId: string; sectionId: string }
  | { kind: 'EXTERNAL'; url: string };

export type Action =
  | { kind: 'BOOK' }
  | { kind: 'PHONE' }
  | { kind: 'WHATSAPP' }
  | { kind: 'EMAIL' }
  | { kind: 'PAGE'; pageId: string }
  | { kind: 'SECTION'; pageId: string; sectionId: string }
  | { kind: 'EXTERNAL'; url: string };

export interface Cta {
  label: LocalizedText;
  action: Action;
}

export interface ImageRef {
  assetId: string;
  alt: LocalizedText;
}

export interface Section {
  id: string;
  type: string;
  variant: string;
  heading: LocalizedText;
  [field: string]: unknown;
}

export interface Page {
  id: string;
  slug: string;
  isHome: boolean;
  title: LocalizedText;
  seo: {
    title?: LocalizedText;
    description?: LocalizedText;
    index: boolean;
    includeInSitemap: boolean;
    canonical: 'SELF';
    og?: { title?: LocalizedText; description?: LocalizedText; imageAssetId?: string };
  };
  sections: Section[];
}

export interface SiteSpec {
  schemaVersion: string;
  site: {
    vertical: 'HOSPITALITY';
    displayName: LocalizedText;
    defaultLocale: Locale;
    locales: Locale[];
    brand?: { tagline?: LocalizedText; logo?: ImageRef; faviconAssetId?: string };
    contacts?: {
      phone?: string;
      whatsapp?: string;
      email?: string;
      address?: LocalizedText;
      geo?: { lat: number; lng: number };
      social?: Array<{ network: string; url: string }>;
    };
    legal?: { operatorName?: LocalizedText; privacyPageId?: string };
    seo: {
      robots: 'INDEX' | 'NOINDEX';
      titleTemplate?: LocalizedText;
      structuredData: { type: 'HOTEL' | 'HOSTEL' | 'APARTMENT' | 'LODGING'; includeAddress: boolean; includeGeo: boolean };
    };
  };
  theme: {
    preset: string;
    accent: string;
    typography: string;
    radius: string;
    density: string;
    colorScheme: string;
  };
  navigation: {
    header: Array<{ label: LocalizedText; target: Target }>;
    headerCta?: Cta;
    footer: Array<{ label: LocalizedText; target: Target }>;
  };
  pages: Page[];
  integrations: {
    booking: { mode: 'WETOP_WIDGET' | 'NONE' };
    analytics: { mode: 'WETOP_TRACKER' | 'NONE'; consent?: 'NOT_REQUIRED' | 'WAIT_FOR_CONSENT' };
  };
}

/** Окружение Worker: адрес API и ключ рантайма; ключ только секретом (`wrangler secret put`) */
export interface Env {
  SITES_API_URL: string;
  SITES_RUNTIME_KEY: string;
  /** `dev` или `staging`; окружения `production` в MKT4 нет, поэтому индексация везде закрыта */
  SITES_ENV: string;
  /**
   * MKT7, Q-271: отдельный домен сайтов клиентов; хост превью `preview.<SITES_BASE_DOMAIN>`. Не задан: превью нет
   * (любой хост идёт обычным путём). Боевое значение задаёт инфраструктура
   */
  SITES_BASE_DOMAIN?: string;
}

/** MKT7: ответ `GET /sites-runtime/preview`: одна версия из токена, без ключа сайта и брони */
export interface RuntimePreview extends Omit<RuntimeCurrent, 'state'> {
  state: 'PREVIEW';
  expiresAt: string;
}
