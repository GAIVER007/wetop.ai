/**
 * Источник сессии по адресу посадочной страницы и рефереру (план среза 8 §5).
 * Правила атрибуции GA4: utm важнее реферера, реклама важнее всего.
 */
export type SourceKind = 'DIRECT' | 'SEARCH' | 'SOCIAL' | 'PAID' | 'EMAIL' | 'REFERRAL';

export interface SessionSource {
  kind: SourceKind;
  /** utm_source, иначе имя поисковика/соцсети, иначе хост реферера без www */
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  /** Хост реферера без www; null, если реферера нет или он свой */
  referrerHost: string | null;
  /** Путь посадочной страницы без query */
  landingPath: string;
}

const MAX_UTM = 100;

/** Поисковики: имя → правило на хост реферера или значение utm_source */
const SEARCH_ENGINES: Array<[string, RegExp]> = [
  ['google', /(^|\.)google\.[a-z.]+$|^google$/],
  ['yandex', /(^|\.)(yandex|ya)\.[a-z.]+$|^yandex$/],
  ['bing', /(^|\.)bing\.com$|^bing$/],
  ['duckduckgo', /(^|\.)duckduckgo\.com$|^duckduckgo$/],
  ['mail.ru', /^go\.mail\.ru$|^mail\.ru$/],
  ['yahoo', /(^|\.)yahoo\.[a-z.]+$|^yahoo$/],
  ['baidu', /(^|\.)baidu\.com$|^baidu$/],
];

/** Соцсети и мессенджеры: имя → правило */
const SOCIAL_NETWORKS: Array<[string, RegExp]> = [
  ['instagram', /(^|\.)instagram\.com$|^instagram$|^ig$/],
  ['facebook', /(^|\.)(facebook\.com|fb\.com|fb\.me)$|^facebook$|^fb$/],
  ['tiktok', /(^|\.)tiktok\.com$|^tiktok$/],
  ['vk', /(^|\.)(vk\.com|vk\.ru|vkontakte\.ru)$|^vk$|^vkontakte$/],
  ['telegram', /^t\.me$|(^|\.)(telegram\.org|telegram\.me)$|^telegram$|^tg$/],
  ['whatsapp', /(^|\.)(whatsapp\.com|wa\.me)$|^whatsapp$|^wa$/],
  ['youtube', /(^|\.)(youtube\.com|youtu\.be)$|^youtube$/],
  ['twitter', /^t\.co$|(^|\.)(twitter\.com|x\.com)$|^twitter$|^x$/],
  ['threads', /(^|\.)threads\.net$|^threads$/],
  ['ok.ru', /(^|\.)(ok\.ru|odnoklassniki\.ru)$|^ok$|^odnoklassniki$/],
  ['linkedin', /(^|\.)linkedin\.com$|^linkedin$/],
  ['pinterest', /(^|\.)pinterest\.[a-z.]+$|^pinterest$/],
];

const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'paid_social',
  'paidsocial',
  'paid-social',
  'display',
  'banner',
  'cpm',
  'cpa',
  'retargeting',
]);
const EMAIL_MEDIUMS = new Set(['email', 'e-mail', 'newsletter']);
const SOCIAL_MEDIUMS = new Set(['social', 'social-media', 'social_media', 'sm', 'smm']);
const CLICK_IDS: Array<[string, string]> = [
  ['gclid', 'google'],
  ['gbraid', 'google'],
  ['wbraid', 'google'],
  ['yclid', 'yandex'],
  ['fbclid', 'facebook'],
  ['ttclid', 'tiktok'],
];

/** Хост без порта, в нижнем регистре, без ведущего www. */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '');
}

/** Хост принадлежит сайту: равен одному из доменов или его поддомен. */
export function hostMatches(siteHosts: readonly string[], host: string | null): boolean {
  if (!host) return false;
  const h = normalizeHost(host);
  return siteHosts.some((raw) => {
    const s = normalizeHost(raw);
    return s.length > 0 && (h === s || h.endsWith(`.${s}`));
  });
}

function matchName(table: Array<[string, RegExp]>, value: string): string | null {
  for (const [name, re] of table) if (re.test(value)) return name;
  return null;
}

function utm(params: URLSearchParams, name: string): string | null {
  const v = params.get(name);
  if (!v) return null;
  const t = v.trim().toLowerCase().slice(0, MAX_UTM);
  return t.length ? t : null;
}

function refererHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return normalizeHost(u.hostname);
  } catch {
    return null;
  }
}

export function classifySource(input: {
  url: string;
  referrer: string | null;
  siteHosts: readonly string[];
}): SessionSource {
  const page = new URL(input.url);
  const params = page.searchParams;
  const source = utm(params, 'utm_source');
  const medium = utm(params, 'utm_medium');
  const campaign = utm(params, 'utm_campaign');
  const content = utm(params, 'utm_content');
  const term = utm(params, 'utm_term');

  const rawRef = refererHost(input.referrer);
  const referrerHost = rawRef && !hostMatches(input.siteHosts, rawRef) ? rawRef : null;
  const base = { medium, campaign, content, term, referrerHost, landingPath: page.pathname || '/' };

  const clickId = CLICK_IDS.find(([p]) => params.has(p));
  if ((medium && PAID_MEDIUMS.has(medium)) || clickId) {
    return { kind: 'PAID', source: source ?? clickId?.[1] ?? referrerHost, ...base };
  }
  if (medium && EMAIL_MEDIUMS.has(medium)) return { kind: 'EMAIL', source, ...base };

  if (source) {
    const search = matchName(SEARCH_ENGINES, source);
    const social = matchName(SOCIAL_NETWORKS, source);
    if (medium && SOCIAL_MEDIUMS.has(medium)) {
      return { kind: 'SOCIAL', source: social ?? source, ...base };
    }
    if (medium === 'organic' || search)
      return { kind: 'SEARCH', source: search ?? source, ...base };
    if (social) return { kind: 'SOCIAL', source: social, ...base };
    return { kind: 'REFERRAL', source, ...base };
  }

  if (!referrerHost) return { kind: 'DIRECT', source: null, ...base };
  const search = matchName(SEARCH_ENGINES, referrerHost);
  if (search) return { kind: 'SEARCH', source: search, ...base };
  const social = matchName(SOCIAL_NETWORKS, referrerHost);
  if (social) return { kind: 'SOCIAL', source: social, ...base };
  return { kind: 'REFERRAL', source: referrerHost, ...base };
}
