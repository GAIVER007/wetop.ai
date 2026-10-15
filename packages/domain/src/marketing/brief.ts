import { SELLER_PROFILE_LIMITS } from '../ai-seller/profile';
import { siteSpecHash } from './canonical';

/**
 * Бриф сайта v0 (MKT5, `docs/marketing/site-brief-v0.md`, `plans/mkt5-site-brief-2026-10-07.md`). Детерминированная
 * сводка фактов филиала для будущей генерации `SiteSpec` (MKT6). Модель здесь не вызывается и текст не сочиняется:
 * только факты из белых списков, их происхождение, чего нет, где расхождения и какие секции подкреплены данными.
 *
 * Граница с ИИ: `input` это данные, которые MKT6 может передать модели отдельным блоком DATA. Всё остальное
 * (`collectedAt`, состояния источников, усечения, недоступность) это метаданные, в промпт они не идут. Тексты Channex и
 * владельца это непроверенные данные: функция их не исполняет, не толкует и не вырезает по смыслу.
 */
export const SITE_BRIEF_SCHEMA_VERSION = 'site-brief/0' as const;

/** Языки, которые знает рантайм сайта v0 (`docs/marketing/sitespec-v0.md`): подсказка языков сайта берётся из них */
export const SITE_BRIEF_LOCALES = ['ru', 'kk', 'en'] as const;

/** Пределы текстов из внешних источников (MKT5 §11): бриф не должен раздувать будущий промпт */
export const BRIEF_TEXT_LIMITS = {
  title: 200,
  description: 4000,
  importantInformation: 2000,
  website: 300,
  address: 500,
  city: 100,
  policy: 200,
  facilities: 50,
  facilityTitle: 120,
  facilityCategory: 60,
  photoDescriptions: 20,
  photoDescription: 200,
} as const;

export type BriefSource = 'PLATFORM' | 'SELLER_PROFILE' | 'CHANNEX';
export type ChannexSourceState =
  | 'READY'
  | 'NO_KEY'
  | 'NO_MAPPING'
  | 'DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UNREACHABLE';

// ---------- снимок источников (вход функции) ----------

export interface BriefLocationFacts {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency: string;
}

export interface BriefPropertyFacts {
  name: string;
  address: string | null;
  city: string | null;
  countryCode: string | null;
  channexPropertyType: string | null;
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface BriefCategoryFacts {
  code: string;
  name: string;
  kind: string;
  capacityAdults: number;
  activeUnits: number;
}

export interface BriefSellerFacts {
  languages: string[];
  includedInPrice: string;
  extraCharges: string;
  houseRules: string;
  faq: Array<{ question: string; answer: string }>;
}

export interface BriefChannexContent {
  property: {
    title: string | null;
    description: string | null;
    importantInformation: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;
  policy: {
    checkInTime: string | null;
    checkOutTime: string | null;
    maxGuests: number | null;
    pets: string | null;
    smoking: string | null;
    internet: string | null;
    parking: string | null;
  } | null;
  facilities: Array<{ title: string; category: string | null }>;
  /** Адрес фото может прийти из чтения Channex, но в бриф он не попадает (фото импортирует MKT8) */
  photos: Array<{ url?: string; description: string | null; forRoomType: boolean }>;
}

export interface SiteBriefSnapshot {
  platform: {
    location: BriefLocationFacts;
    property: BriefPropertyFacts | null;
    categories: BriefCategoryFacts[];
  };
  seller: { state: 'READY'; profile: BriefSellerFacts } | { state: 'MISSING'; reason: 'NO_AGENT' | 'NO_PROFILE' };
  channex: { state: ChannexSourceState; checkedAt: string | null; content: BriefChannexContent | null };
}

// ---------- бриф (выход) ----------

export interface SiteBriefInput {
  identity: {
    displayNameCandidate: string;
    displayNameSource: BriefSource;
    locationName: string;
    propertyName: string | null;
    address: string | null;
    addressSource: BriefSource | null;
    city: string | null;
    countryCode: string | null;
    propertyType: string | null;
    timezone: string;
    currency: string;
    phone: string | null;
    phoneSource: BriefSource | null;
    email: string | null;
    emailSource: BriefSource | null;
  };
  stay: { checkInTime: string | null; checkOutTime: string | null };
  /** `activeUnits` это вместимость фонда, а не свободные места сейчас */
  accommodations: Array<{ categoryCode: string; name: string; kind: string; capacityAdults: number; activeUnits: number }>;
  /** Способность гостиницы, а не обещание: бронь конкретного сайта связывает MKT7, цена «от» живая (`B-FROMPRICE`) */
  capabilities: { booking: true; fromPrice: true };
  sellerContent: {
    siteLocaleHints: string[];
    includedInPrice: string | null;
    extraCharges: string | null;
    houseRules: string | null;
    faq: Array<{ question: string; answer: string }>;
  } | null;
  channelContent: {
    description: string | null;
    importantInformation: string | null;
    website: string | null;
    policies: {
      maxGuests: number | null;
      pets: string | null;
      smoking: string | null;
      internet: string | null;
      parking: string | null;
    } | null;
    facilities: Array<{ title: string; category: string | null }>;
    photoSummary: { total: number; propertyPhotos: number; roomTypePhotos: number; descriptions: string[] };
  } | null;
}

export interface SiteBriefFinding {
  code: string;
  source: BriefSource;
}
export interface SiteBriefMissing {
  code: string;
}
export interface SiteBriefSourceIssue {
  source: 'CHANNEX';
  code: ChannexSourceState;
}
export interface SiteBriefConflict {
  code: string;
  authoritativeSource: BriefSource;
  authoritativeValue: string;
  otherSource: BriefSource;
  otherValue: string;
}
export interface SiteBriefTruncation {
  source: BriefSource;
  field: string;
  originalLength: number;
}
export interface SiteBriefSection {
  type: string;
  reasonCodes: string[];
  evidenceCodes: string[];
  requires?: string[];
  bindings?: string[];
}
export interface SiteBriefStructure {
  pages: Array<{ kind: 'HOME'; sections: SiteBriefSection[] }>;
}

export interface SiteBrief {
  schemaVersion: typeof SITE_BRIEF_SCHEMA_VERSION;
  collectedAt: string;
  briefHash: string;
  input: SiteBriefInput;
  sources: {
    platform: { state: 'READY' };
    seller: { state: 'READY' } | { state: 'MISSING'; reason: 'NO_AGENT' | 'NO_PROFILE' };
    channex: { state: ChannexSourceState; checkedAt: string | null };
  };
  found: SiteBriefFinding[];
  missing: SiteBriefMissing[];
  sourceUnavailable: SiteBriefSourceIssue[];
  conflicts: SiteBriefConflict[];
  truncations: SiteBriefTruncation[];
  proposedStructure: SiteBriefStructure;
}

// ---------- правила ----------

/** Сравнение строк по кодовым единицам: не зависит от ICU и локали процесса */
const byCode = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const textOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const t = value.replaceAll('\u0000', '').trim();
  return t === '' ? null : t;
};

/** Сравнение без пробелов по краям, с одним пробелом внутри и без регистра */
const loose = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
const digits = (value: string) => value.replace(/\D/g, '');
/** Время `ЧЧ:ММ`; если не похоже на время, строка без изменений */
function clock(value: string): string {
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(value);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : value.trim();
}

const CHANNEX_UNCONNECTED: readonly ChannexSourceState[] = ['NO_KEY', 'NO_MAPPING'];

export function buildSiteBrief(snapshot: SiteBriefSnapshot, collectedAt: string): SiteBrief {
  const truncations: SiteBriefTruncation[] = [];
  /** Текст в пределе по символам; усечение пишется в метаданные без исходника */
  const bounded = (value: unknown, max: number, source: BriefSource, field: string): string | null => {
    const t = textOf(value);
    if (t === null) return null;
    const chars = Array.from(t);
    if (chars.length <= max) return t;
    truncations.push({ source, field, originalLength: chars.length });
    return chars.slice(0, max).join('');
  };

  const { location, property, categories } = snapshot.platform;
  const L = BRIEF_TEXT_LIMITS;

  // --- Channex: только белый список, адресов фото нет ---
  const cx = snapshot.channex.state === 'READY' ? snapshot.channex.content : null;
  const cxp = cx?.property ?? null;
  const cxTitle = bounded(cxp?.title, L.title, 'CHANNEX', 'title');
  const cxPhone = bounded(cxp?.phone, L.policy, 'CHANNEX', 'phone');
  const cxEmail = bounded(cxp?.email, L.policy, 'CHANNEX', 'email');
  const cxAddress = bounded(cxp?.address, L.address, 'CHANNEX', 'address');
  const cxCity = bounded(cxp?.city, L.city, 'CHANNEX', 'city');
  const cxCountryRaw = textOf(cxp?.country);
  const cxCountry = cxCountryRaw && /^[A-Za-z]{2}$/.test(cxCountryRaw) ? cxCountryRaw.toUpperCase() : null;

  let channelContent: SiteBriefInput['channelContent'] = null;
  if (cx) {
    const allFacilities = cx.facilities
      .map((f, i) => ({
        title: bounded(f.title, L.facilityTitle, 'CHANNEX', `facilities[${i}].title`),
        category: bounded(f.category, L.facilityCategory, 'CHANNEX', `facilities[${i}].category`),
      }))
      .filter((f): f is { title: string; category: string | null } => f.title !== null)
      .sort((a, b) => byCode(a.category ?? '', b.category ?? '') || byCode(a.title, b.title));
    if (allFacilities.length > L.facilities)
      truncations.push({ source: 'CHANNEX', field: 'facilities', originalLength: allFacilities.length });
    const described = cx.photos.map((p) => textOf(p.description)).filter((d): d is string => d !== null);
    if (described.length > L.photoDescriptions)
      truncations.push({ source: 'CHANNEX', field: 'photoDescriptions', originalLength: described.length });
    const p = cx.policy;
    const policies = p && {
      maxGuests: typeof p.maxGuests === 'number' && Number.isFinite(p.maxGuests) ? p.maxGuests : null,
      pets: bounded(p.pets, L.policy, 'CHANNEX', 'policy.pets'),
      smoking: bounded(p.smoking, L.policy, 'CHANNEX', 'policy.smoking'),
      internet: bounded(p.internet, L.policy, 'CHANNEX', 'policy.internet'),
      parking: bounded(p.parking, L.policy, 'CHANNEX', 'policy.parking'),
    };
    channelContent = {
      description: bounded(cxp?.description, L.description, 'CHANNEX', 'description'),
      importantInformation: bounded(cxp?.importantInformation, L.importantInformation, 'CHANNEX', 'importantInformation'),
      website: bounded(cxp?.website, L.website, 'CHANNEX', 'website'),
      policies,
      facilities: allFacilities.slice(0, L.facilities),
      photoSummary: {
        total: cx.photos.length,
        propertyPhotos: cx.photos.filter((ph) => !ph.forRoomType).length,
        roomTypePhotos: cx.photos.filter((ph) => ph.forRoomType).length,
        descriptions: described
          .slice(0, L.photoDescriptions)
          .map((d, i) => bounded(d, L.photoDescription, 'CHANNEX', `photoDescriptions[${i}]`)!),
      },
    };
  }

  // --- профиль продавца: только белый список ---
  let sellerContent: SiteBriefInput['sellerContent'] = null;
  if (snapshot.seller.state === 'READY') {
    const s = snapshot.seller.profile;
    const S = SELLER_PROFILE_LIMITS;
    const langs = Array.isArray(s.languages) ? s.languages.map((x) => String(x).toLowerCase()) : [];
    sellerContent = {
      siteLocaleHints: langs.filter(
        (code, i) => (SITE_BRIEF_LOCALES as readonly string[]).includes(code) && langs.indexOf(code) === i,
      ),
      includedInPrice: bounded(s.includedInPrice, S.includedInPrice, 'SELLER_PROFILE', 'includedInPrice'),
      extraCharges: bounded(s.extraCharges, S.extraCharges, 'SELLER_PROFILE', 'extraCharges'),
      houseRules: bounded(s.houseRules, S.houseRules, 'SELLER_PROFILE', 'houseRules'),
      faq: (Array.isArray(s.faq) ? s.faq : [])
        .slice(0, S.faqItems)
        .map((f, i) => ({
          question: bounded(f?.question, S.faqQuestion, 'SELLER_PROFILE', `faq[${i}].question`),
          answer: bounded(f?.answer, S.faqAnswer, 'SELLER_PROFILE', `faq[${i}].answer`),
        }))
        .filter((f): f is { question: string; answer: string } => f.question !== null && f.answer !== null),
    };
  }

  // --- старшинство полей платформы ---
  const pick = <T>(...candidates: Array<[T | null, BriefSource]>): [T | null, BriefSource | null] => {
    for (const [value, source] of candidates) if (value !== null) return [value, source];
    return [null, null];
  };
  const locationName = textOf(location.name) ?? '';
  const propertyName = textOf(property?.name);
  const [address, addressSource] = pick<string>(
    [bounded(location.address, L.address, 'PLATFORM', 'location.address'), 'PLATFORM'],
    [bounded(property?.address, L.address, 'PLATFORM', 'property.address'), 'PLATFORM'],
    [cxAddress, 'CHANNEX'],
  );
  // телефон и почта объекта в бриф не берутся: это контакты печатных форм, а не утверждённые публичные контакты
  const [phone, phoneSource] = pick<string>([textOf(location.phone), 'PLATFORM'], [cxPhone, 'CHANNEX']);
  const [email, emailSource] = pick<string>([textOf(location.email), 'PLATFORM'], [cxEmail, 'CHANNEX']);
  const [city] = pick<string>([textOf(property?.city), 'PLATFORM'], [cxCity, 'CHANNEX']);
  const platformCountry = textOf(property?.countryCode);
  const [countryCode] = pick<string>([platformCountry ? platformCountry.toUpperCase() : null, 'PLATFORM'], [cxCountry, 'CHANNEX']);
  const [displayName, displayNameSource] = pick<string>(
    [cxTitle, 'CHANNEX'],
    [locationName || null, 'PLATFORM'],
    [propertyName, 'PLATFORM'],
  );

  const input: SiteBriefInput = {
    identity: {
      displayNameCandidate: displayName ?? '',
      displayNameSource: displayNameSource ?? 'PLATFORM',
      locationName,
      propertyName,
      address,
      addressSource,
      city,
      countryCode,
      propertyType: textOf(property?.channexPropertyType),
      timezone: property?.timezone ?? location.timezone,
      currency: property?.currency ?? location.currency,
      phone,
      phoneSource,
      email,
      emailSource,
    },
    stay: {
      checkInTime: property ? clock(property.checkInTime) : null,
      checkOutTime: property ? clock(property.checkOutTime) : null,
    },
    accommodations: [...categories]
      .sort((a, b) => byCode(a.code, b.code))
      .map((c) => ({
        categoryCode: c.code,
        name: c.name,
        kind: c.kind,
        capacityAdults: c.capacityAdults,
        activeUnits: c.activeUnits,
      })),
    capabilities: { booking: true, fromPrice: true },
    sellerContent,
    channelContent,
  };

  // --- расхождения: значение платформы остаётся, Channex рядом ---
  const conflicts: SiteBriefConflict[] = [];
  const conflict = (code: string, mine: string | null, theirs: string | null, same: (v: string) => string) => {
    if (mine === null || theirs === null || same(mine) === same(theirs)) return;
    conflicts.push({ code, authoritativeSource: 'PLATFORM', authoritativeValue: mine, otherSource: 'CHANNEX', otherValue: theirs });
  };
  if (cx) {
    conflict('address_mismatch', addressSource === 'PLATFORM' ? address : null, cxAddress, loose);
    conflict('phone_mismatch', phoneSource === 'PLATFORM' ? phone : null, cxPhone, digits);
    conflict('email_mismatch', emailSource === 'PLATFORM' ? email : null, cxEmail, loose);
    const cxIn = textOf(cx.policy?.checkInTime);
    const cxOut = textOf(cx.policy?.checkOutTime);
    conflict('checkin_mismatch', input.stay.checkInTime, cxIn && clock(cxIn), clock);
    conflict('checkout_mismatch', input.stay.checkOutTime, cxOut && clock(cxOut), clock);
    const platformNames = [locationName, propertyName].filter((n): n is string => !!n).map(loose);
    if (cxTitle && platformNames.length > 0 && !platformNames.includes(loose(cxTitle)))
      conflicts.push({
        code: 'name_mismatch',
        authoritativeSource: 'PLATFORM',
        authoritativeValue: locationName || propertyName || '',
        otherSource: 'CHANNEX',
        otherValue: cxTitle,
      });
  }
  conflicts.sort((a, b) => byCode(a.code, b.code));

  // --- найдено ---
  const found: SiteBriefFinding[] = [{ code: 'platform.identity', source: 'PLATFORM' }];
  const add = (cond: unknown, code: string, source: BriefSource) => {
    if (cond) found.push({ code, source });
  };
  add(addressSource === 'PLATFORM', 'platform.address', 'PLATFORM');
  add(phoneSource === 'PLATFORM' || emailSource === 'PLATFORM', 'platform.contacts', 'PLATFORM');
  add(property, 'platform.stay_times', 'PLATFORM');
  add(input.accommodations.length > 0, 'platform.accommodations', 'PLATFORM');
  if (sellerContent) {
    add(sellerContent.siteLocaleHints.length > 0, 'seller.languages', 'SELLER_PROFILE');
    add(sellerContent.includedInPrice, 'seller.included_in_price', 'SELLER_PROFILE');
    add(sellerContent.extraCharges, 'seller.extra_charges', 'SELLER_PROFILE');
    add(sellerContent.houseRules, 'seller.house_rules', 'SELLER_PROFILE');
    add(sellerContent.faq.length > 0, 'seller.faq', 'SELLER_PROFILE');
  }
  if (channelContent) {
    add(cxTitle, 'channex.title', 'CHANNEX');
    add(channelContent.description, 'channex.description', 'CHANNEX');
    add(channelContent.importantInformation, 'channex.important_information', 'CHANNEX');
    add(cxPhone || cxEmail, 'channex.contacts', 'CHANNEX');
    add(cxAddress, 'channex.address', 'CHANNEX');
    add(channelContent.website, 'channex.website', 'CHANNEX');
    const pol = channelContent.policies;
    add(pol && Object.values(pol).some((v) => v !== null), 'channex.policies', 'CHANNEX');
    add(channelContent.facilities.length > 0, 'channex.facilities', 'CHANNEX');
    add(channelContent.photoSummary.total > 0, 'channex.photos', 'CHANNEX');
  }
  found.sort((a, b) => byCode(a.code, b.code));
  const has = (code: string) => found.some((f) => f.code === code);

  // --- нет: только проверенное; недоступный Channex не значит «нет» ---
  const state = snapshot.channex.state;
  const channexKnown = state === 'READY' || CHANNEX_UNCONNECTED.includes(state);
  const missing: SiteBriefMissing[] = [];
  const miss = (cond: boolean, code: string, dependsOnChannex: boolean) => {
    if (cond && (!dependsOnChannex || channexKnown)) missing.push({ code });
  };
  miss(input.accommodations.length === 0, 'accommodations', false);
  miss(!address, 'public.address', true);
  miss(!city, 'public.city', true);
  miss(!countryCode, 'public.country', true);
  miss(!phone && !email, 'public.contact', true);
  miss(!has('channex.description') && !has('channex.important_information'), 'marketing.description', true);
  miss(!has('channex.facilities') && !has('seller.included_in_price'), 'amenities', true);
  miss(!has('seller.faq'), 'faq', false);
  miss(!has('channex.photos'), 'photos', true);
  missing.sort((a, b) => byCode(a.code, b.code));

  const sourceUnavailable: SiteBriefSourceIssue[] = channexKnown ? [] : [{ source: 'CHANNEX', code: state }];

  // --- предлагаемая структура: не SiteSpec и не текст ---
  const sections: SiteBriefSection[] = [];
  const evidence = (...candidates: string[]) => candidates.filter(has).sort(byCode);
  const suggest = (type: string, reason: string, ev: string[], extra: Partial<SiteBriefSection> = {}) =>
    sections.push({ type, reasonCodes: [reason], evidenceCodes: ev, ...extra });
  suggest('hero', 'always', ['platform.identity']);
  const about = evidence('channex.description', 'channex.important_information');
  if (about.length) suggest('about', 'channex_description', about);
  if (has('platform.accommodations')) {
    suggest('accommodations', 'active_categories', ['platform.accommodations']);
    suggest('pricing', 'live_from_price', ['platform.accommodations'], { bindings: ['B-FROMPRICE'] });
  }
  const amenities = evidence('channex.facilities', 'seller.included_in_price');
  if (amenities.length) suggest('amenities', 'facilities_or_included', amenities);
  if (has('channex.photos'))
    suggest('gallery', 'channex_photos', ['channex.photos'], { requires: ['MKT8_MEDIA_IMPORT'] });
  if (has('seller.faq')) suggest('faq', 'seller_faq', ['seller.faq']);
  suggest('booking', 'hospitality_booking_capability', ['platform.identity'], { requires: ['MKT7_TRACKED_SITE'] });
  const contacts = [
    ...new Set(
      [
        addressSource === 'PLATFORM' ? 'platform.address' : addressSource === 'CHANNEX' ? 'channex.address' : null,
        phoneSource === 'PLATFORM' || emailSource === 'PLATFORM' ? 'platform.contacts' : null,
        phoneSource === 'CHANNEX' || emailSource === 'CHANNEX' ? 'channex.contacts' : null,
      ].filter((c): c is string => c !== null),
    ),
  ].sort(byCode);
  if (contacts.length) suggest('contacts', 'public_contacts', contacts);
  suggest('cta', 'always', ['platform.identity']);
  const proposedStructure: SiteBriefStructure = { pages: [{ kind: 'HOME', sections }] };

  truncations.sort((a, b) => byCode(a.source, b.source) || byCode(a.field, b.field));
  const briefHash = siteSpecHash({
    schemaVersion: SITE_BRIEF_SCHEMA_VERSION,
    input,
    missing: missing.map((m) => m.code),
    conflicts,
    proposedStructure,
  });

  return {
    schemaVersion: SITE_BRIEF_SCHEMA_VERSION,
    collectedAt,
    briefHash,
    input,
    sources: {
      platform: { state: 'READY' },
      seller:
        snapshot.seller.state === 'READY'
          ? { state: 'READY' }
          : { state: 'MISSING', reason: snapshot.seller.reason },
      channex: { state, checkedAt: snapshot.channex.checkedAt },
    },
    found,
    missing,
    sourceUnavailable,
    conflicts,
    truncations,
    proposedStructure,
  };
}
