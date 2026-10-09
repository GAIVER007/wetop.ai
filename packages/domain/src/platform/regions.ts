/**
 * Справочник стран для окна «Создать организацию» («Платформа → Организации»): страна, её города, часовой пояс города и
 * валюта страны. Один справочник на форму и на проверку в API: форма не предложит того, что сервер отвергнет.
 * Города — крупные, остальное человек вводит словами в адресе филиала.
 */
export interface RegionCity {
  name: string;
  /** IANA-пояс города */
  timezone: string;
}

export interface RegionCountry {
  code: string;
  name: string;
  /** Операционная валюта страны по умолчанию */
  currency: string;
  cities: readonly RegionCity[];
}

export const REGION_COUNTRIES: readonly RegionCountry[] = [
  {
    code: 'KZ',
    name: 'Казахстан',
    currency: 'KZT',
    cities: [
      { name: 'Алматы', timezone: 'Asia/Almaty' },
      { name: 'Астана', timezone: 'Asia/Almaty' },
      { name: 'Шымкент', timezone: 'Asia/Almaty' },
      { name: 'Караганда', timezone: 'Asia/Almaty' },
      { name: 'Актау', timezone: 'Asia/Aqtau' },
      { name: 'Атырау', timezone: 'Asia/Atyrau' },
    ],
  },
  {
    code: 'UZ',
    name: 'Узбекистан',
    currency: 'UZS',
    cities: [
      { name: 'Ташкент', timezone: 'Asia/Tashkent' },
      { name: 'Самарканд', timezone: 'Asia/Samarkand' },
    ],
  },
  { code: 'KG', name: 'Кыргызстан', currency: 'KGS', cities: [{ name: 'Бишкек', timezone: 'Asia/Bishkek' }] },
  {
    code: 'RU',
    name: 'Россия',
    currency: 'RUB',
    cities: [
      { name: 'Москва', timezone: 'Europe/Moscow' },
      { name: 'Санкт-Петербург', timezone: 'Europe/Moscow' },
    ],
  },
  { code: 'GE', name: 'Грузия', currency: 'GEL', cities: [{ name: 'Тбилиси', timezone: 'Asia/Tbilisi' }] },
  { code: 'AE', name: 'ОАЭ', currency: 'AED', cities: [{ name: 'Дубай', timezone: 'Asia/Dubai' }] },
  { code: 'TR', name: 'Турция', currency: 'TRY', cities: [{ name: 'Стамбул', timezone: 'Europe/Istanbul' }] },
];

/** Валюты, которые можно выбрать организации */
export const REGION_CURRENCIES: readonly string[] = ['KZT', 'UZS', 'KGS', 'RUB', 'GEL', 'AED', 'TRY', 'USD', 'EUR'];

export const regionCountry = (code: string): RegionCountry | undefined =>
  REGION_COUNTRIES.find((c) => c.code === code);

/** Часовые пояса справочника: ими ограничен выбор, чужого пояса форма не примет */
export const REGION_TIMEZONES: readonly string[] = [
  ...new Set(REGION_COUNTRIES.flatMap((c) => c.cities.map((city) => city.timezone))),
];

/** Пояса справочника с русским названием города: «Asia/Almaty» → «Алматы» (первый город пояса) */
export const REGION_TIMEZONE_OPTIONS: ReadonlyArray<{ timezone: string; city: string }> = REGION_TIMEZONES.map((tz) => ({
  timezone: tz,
  city: REGION_COUNTRIES.flatMap((c) => c.cities).find((c) => c.timezone === tz)!.name,
}));

/** «(GMT+5) Алматы»: смещение на заданный момент и название города */
export function timezoneLabel(timezone: string, city: string, now: Date = new Date()): string {
  const raw = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
    .formatToParts(now)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(raw ?? '');
  const offset = m?.[1] ? `GMT${m[1]}${Number(m[2])}${m[3] === '00' ? '' : `:${m[3]}`}` : 'GMT+0';
  return `(${offset}) ${city}`;
}
