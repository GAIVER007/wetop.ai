/**
 * Контакт и согласие в форме регистрации (решение владельца 29.09.2026: форма «чётко, как у Exely» —
 * телефон с кодом страны и согласие с политикой конфиденциальности; регистрация остаётся мгновенной).
 *
 * Телефон ложится в контакт нового объекта (`properties.phone`, оттуда в филиал) — колонка уже есть,
 * модель данных не меняется. Страна в форме — только код телефона: часы и валюта объекта по-прежнему
 * казахстанские по умолчанию и правятся в настройках. Страну подставляем по браузеру, иначе Казахстан.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** Международный код, «+7» */
  dial: string;
}

/** Казахстан первым — основной рынок; дальше соседи и частые направления партнёров. */
export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { code: 'KZ', name: 'Казахстан', dial: '+7' },
  { code: 'RU', name: 'Россия', dial: '+7' },
  { code: 'UZ', name: 'Узбекистан', dial: '+998' },
  { code: 'KG', name: 'Кыргызстан', dial: '+996' },
  { code: 'TJ', name: 'Таджикистан', dial: '+992' },
  { code: 'TM', name: 'Туркменистан', dial: '+993' },
  { code: 'AZ', name: 'Азербайджан', dial: '+994' },
  { code: 'AM', name: 'Армения', dial: '+374' },
  { code: 'GE', name: 'Грузия', dial: '+995' },
  { code: 'BY', name: 'Беларусь', dial: '+375' },
  { code: 'MN', name: 'Монголия', dial: '+976' },
  { code: 'TR', name: 'Турция', dial: '+90' },
  { code: 'AE', name: 'ОАЭ', dial: '+971' },
  { code: 'CN', name: 'Китай', dial: '+86' },
  { code: 'KR', name: 'Южная Корея', dial: '+82' },
  { code: 'TH', name: 'Таиланд', dial: '+66' },
  { code: 'DE', name: 'Германия', dial: '+49' },
  { code: 'GB', name: 'Великобритания', dial: '+44' },
  { code: 'US', name: 'США', dial: '+1' },
];

export const DEFAULT_PHONE_COUNTRY = 'KZ';

/** Пояс браузера надёжнее языка: русский язык стоит и в Алматы, и в Москве. */
const COUNTRY_BY_TIMEZONE: Record<string, string> = {
  'Asia/Almaty': 'KZ',
  'Asia/Qostanay': 'KZ',
  'Asia/Qyzylorda': 'KZ',
  'Asia/Aqtobe': 'KZ',
  'Asia/Aqtau': 'KZ',
  'Asia/Atyrau': 'KZ',
  'Asia/Oral': 'KZ',
  'Europe/Moscow': 'RU',
  'Asia/Yekaterinburg': 'RU',
  'Asia/Novosibirsk': 'RU',
  'Asia/Omsk': 'RU',
  'Asia/Tashkent': 'UZ',
  'Asia/Samarkand': 'UZ',
  'Asia/Bishkek': 'KG',
  'Asia/Dushanbe': 'TJ',
  'Asia/Ashgabat': 'TM',
  'Asia/Baku': 'AZ',
  'Asia/Yerevan': 'AM',
  'Asia/Tbilisi': 'GE',
  'Europe/Minsk': 'BY',
  'Asia/Ulaanbaatar': 'MN',
  'Europe/Istanbul': 'TR',
  'Asia/Dubai': 'AE',
  'Asia/Shanghai': 'CN',
  'Asia/Seoul': 'KR',
  'Asia/Bangkok': 'TH',
  'Europe/Berlin': 'DE',
  'Europe/London': 'GB',
};

const known = (code: string | undefined): string | null =>
  code && PHONE_COUNTRIES.some((c) => c.code === code) ? code : null;

/**
 * Страна кода телефона по браузеру: сначала часовой пояс (`Intl…timeZone`), затем регион в языке
 * («uz-UZ» → UZ); ничего не подошло — Казахстан.
 */
export function defaultPhoneCountry(languages: readonly string[], timeZone: string | undefined): string {
  const byZone = known(timeZone ? COUNTRY_BY_TIMEZONE[timeZone] : undefined);
  if (byZone) return byZone;
  for (const lang of languages) {
    const region = /^[a-z]{2,3}-([A-Z]{2})\b/i.exec(lang)?.[1]?.toUpperCase();
    const byLang = known(region);
    if (byLang) return byLang;
  }
  return DEFAULT_PHONE_COUNTRY;
}

/** Номер целиком — от 10 до 15 цифр (E.164), местная часть — не меньше 6. */
const E164_MIN = 10;
const E164_MAX = 15;
const NATIONAL_MIN = 6;

/**
 * Телефон из формы: страна + номер как ввёл человек → «+77015554433», или `null`, если номер не похож
 * на телефон. Код выбранной страны, набранный вручную в начале номера, не удваивается; у «+7»
 * снимается и местная 8 («8 701 …»).
 */
export function registrationPhone(countryCode: string, raw: string): string | null {
  const country = PHONE_COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return null;
  const dial = country.dial.slice(1);
  let national = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') && national.startsWith(dial)) national = national.slice(dial.length);
  else if (dial === '7' && national.length === 11 && /^[78]/.test(national)) national = national.slice(1);
  // Код без «+» не снимаем: «701…» в Казахстане начинается с 7, и отличить его от кода нельзя.
  const full = dial + national;
  if (national.length < NATIONAL_MIN || full.length < E164_MIN || full.length > E164_MAX) return null;
  return `+${full}`;
}

export const REGISTRATION_PHONE_MESSAGE = 'Проверьте телефон: номер целиком, с кодом страны';
export const REGISTRATION_PRIVACY_MESSAGE =
  'Чтобы создать организацию, подтвердите согласие с политикой конфиденциальности';

/** Политика живёт на главной; версия — дата текста, пишется в журнал вместе с согласием. */
export const PRIVACY_POLICY_URL = 'https://wetop.ai/privacy/';
export const PRIVACY_POLICY_VERSION = '2026-09-29';
