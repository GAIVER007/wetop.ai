/**
 * Страны кода телефона для окна регистрации на главной (форма 29.09.2026). Главная собирается отдельно и
 * `@pms/domain` не тянет, поэтому список — копия `PHONE_COUNTRIES` домена; совпадение сторожит
 * `phone-countries.test.ts`. Сам номер проверяет API тем же правилом домена.
 */
export interface PhoneCountry {
  code: string;
  name: string;
  dial: string;
}

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

/** Как `defaultPhoneCountry` домена: пояс браузера, затем регион языка, иначе Казахстан. */
export function defaultPhoneCountry(languages: readonly string[], timeZone: string | undefined): string {
  const byZone = known(timeZone ? COUNTRY_BY_TIMEZONE[timeZone] : undefined);
  if (byZone) return byZone;
  for (const lang of languages) {
    const byLang = known(/^[a-z]{2,3}-([A-Z]{2})\b/i.exec(lang)?.[1]?.toUpperCase());
    if (byLang) return byLang;
  }
  return 'KZ';
}

export const PRIVACY_POLICY_PATH = '/privacy/';
