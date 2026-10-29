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
  { code: 'QA', name: 'Катар', dial: '+974' },
  { code: 'CN', name: 'Китай', dial: '+86' },
  { code: 'KR', name: 'Южная Корея', dial: '+82' },
  { code: 'TH', name: 'Таиланд', dial: '+66' },
  { code: 'DE', name: 'Германия', dial: '+49' },
  { code: 'GB', name: 'Великобритания', dial: '+44' },
  { code: 'US', name: 'США', dial: '+1' },
  { code: 'AU', name: 'Австралия', dial: '+61' },
  { code: 'AT', name: 'Австрия', dial: '+43' },
  { code: 'AL', name: 'Албания', dial: '+355' },
  { code: 'DZ', name: 'Алжир', dial: '+213' },
  { code: 'AS', name: 'Американское Самоа', dial: '+1684' },
  { code: 'AI', name: 'Ангилья', dial: '+1264' },
  { code: 'AO', name: 'Ангола', dial: '+244' },
  { code: 'AD', name: 'Андорра', dial: '+376' },
  { code: 'AG', name: 'Антигуа и Барбуда', dial: '+1268' },
  { code: 'AR', name: 'Аргентина', dial: '+54' },
  { code: 'AW', name: 'Аруба', dial: '+297' },
  { code: 'AF', name: 'Афганистан', dial: '+93' },
  { code: 'BS', name: 'Багамы', dial: '+1242' },
  { code: 'BD', name: 'Бангладеш', dial: '+880' },
  { code: 'BB', name: 'Барбадос', dial: '+1246' },
  { code: 'BH', name: 'Бахрейн', dial: '+973' },
  { code: 'BZ', name: 'Белиз', dial: '+501' },
  { code: 'BE', name: 'Бельгия', dial: '+32' },
  { code: 'BJ', name: 'Бенин', dial: '+229' },
  { code: 'BM', name: 'Бермудские о-ва', dial: '+1441' },
  { code: 'BG', name: 'Болгария', dial: '+359' },
  { code: 'BO', name: 'Боливия', dial: '+591' },
  { code: 'BA', name: 'Босния и Герцеговина', dial: '+387' },
  { code: 'BW', name: 'Ботсвана', dial: '+267' },
  { code: 'BR', name: 'Бразилия', dial: '+55' },
  { code: 'IO', name: 'Британская территория в Индийском океане', dial: '+246' },
  { code: 'BN', name: 'Бруней', dial: '+673' },
  { code: 'BF', name: 'Буркина-Фасо', dial: '+226' },
  { code: 'BI', name: 'Бурунди', dial: '+257' },
  { code: 'BT', name: 'Бутан', dial: '+975' },
  { code: 'VU', name: 'Вануату', dial: '+678' },
  { code: 'HU', name: 'Венгрия', dial: '+36' },
  { code: 'VE', name: 'Венесуэла', dial: '+58' },
  { code: 'VG', name: 'Виргинские о-ва (Великобритания)', dial: '+1284' },
  { code: 'VI', name: 'Виргинские о-ва (США)', dial: '+1340' },
  { code: 'TL', name: 'Восточный Тимор', dial: '+670' },
  { code: 'VN', name: 'Вьетнам', dial: '+84' },
  { code: 'GA', name: 'Габон', dial: '+241' },
  { code: 'HT', name: 'Гаити', dial: '+509' },
  { code: 'GY', name: 'Гайана', dial: '+592' },
  { code: 'GM', name: 'Гамбия', dial: '+220' },
  { code: 'GH', name: 'Гана', dial: '+233' },
  { code: 'GP', name: 'Гваделупа', dial: '+590' },
  { code: 'GT', name: 'Гватемала', dial: '+502' },
  { code: 'GN', name: 'Гвинея', dial: '+224' },
  { code: 'GW', name: 'Гвинея-Бисау', dial: '+245' },
  { code: 'GI', name: 'Гибралтар', dial: '+350' },
  { code: 'HN', name: 'Гондурас', dial: '+504' },
  { code: 'HK', name: 'Гонконг (САР)', dial: '+852' },
  { code: 'GD', name: 'Гренада', dial: '+1473' },
  { code: 'GL', name: 'Гренландия', dial: '+299' },
  { code: 'GR', name: 'Греция', dial: '+30' },
  { code: 'GU', name: 'Гуам', dial: '+1671' },
  { code: 'DK', name: 'Дания', dial: '+45' },
  { code: 'DJ', name: 'Джибути', dial: '+253' },
  { code: 'DM', name: 'Доминика', dial: '+1767' },
  { code: 'DO', name: 'Доминиканская Республика', dial: '+1809' },
  { code: 'EG', name: 'Египет', dial: '+20' },
  { code: 'ZM', name: 'Замбия', dial: '+260' },
  { code: 'ZW', name: 'Зимбабве', dial: '+263' },
  { code: 'IL', name: 'Израиль', dial: '+972' },
  { code: 'IN', name: 'Индия', dial: '+91' },
  { code: 'ID', name: 'Индонезия', dial: '+62' },
  { code: 'JO', name: 'Иордания', dial: '+962' },
  { code: 'IQ', name: 'Ирак', dial: '+964' },
  { code: 'IR', name: 'Иран', dial: '+98' },
  { code: 'IE', name: 'Ирландия', dial: '+353' },
  { code: 'IS', name: 'Исландия', dial: '+354' },
  { code: 'ES', name: 'Испания', dial: '+34' },
  { code: 'IT', name: 'Италия', dial: '+39' },
  { code: 'YE', name: 'Йемен', dial: '+967' },
  { code: 'CV', name: 'Кабо-Верде', dial: '+238' },
  { code: 'KH', name: 'Камбоджа', dial: '+855' },
  { code: 'CM', name: 'Камерун', dial: '+237' },
  { code: 'CA', name: 'Канада', dial: '+1' },
  { code: 'KE', name: 'Кения', dial: '+254' },
  { code: 'CY', name: 'Кипр', dial: '+357' },
  { code: 'KI', name: 'Кирибати', dial: '+686' },
  { code: 'KP', name: 'КНДР', dial: '+850' },
  { code: 'CO', name: 'Колумбия', dial: '+57' },
  { code: 'KM', name: 'Коморы', dial: '+269' },
  { code: 'CG', name: 'Конго - Браззавиль', dial: '+242' },
  { code: 'CD', name: 'Конго - Киншаса', dial: '+243' },
  { code: 'XK', name: 'Косово', dial: '+383' },
  { code: 'CR', name: 'Коста-Рика', dial: '+506' },
  { code: 'CI', name: 'Кот-д’Ивуар', dial: '+225' },
  { code: 'CU', name: 'Куба', dial: '+53' },
  { code: 'KW', name: 'Кувейт', dial: '+965' },
  { code: 'CW', name: 'Кюрасао', dial: '+599' },
  { code: 'LA', name: 'Лаос', dial: '+856' },
  { code: 'LV', name: 'Латвия', dial: '+371' },
  { code: 'LS', name: 'Лесото', dial: '+266' },
  { code: 'LR', name: 'Либерия', dial: '+231' },
  { code: 'LB', name: 'Ливан', dial: '+961' },
  { code: 'LY', name: 'Ливия', dial: '+218' },
  { code: 'LT', name: 'Литва', dial: '+370' },
  { code: 'LI', name: 'Лихтенштейн', dial: '+423' },
  { code: 'LU', name: 'Люксембург', dial: '+352' },
  { code: 'MU', name: 'Маврикий', dial: '+230' },
  { code: 'MR', name: 'Мавритания', dial: '+222' },
  { code: 'MG', name: 'Мадагаскар', dial: '+261' },
  { code: 'MO', name: 'Макао (САР)', dial: '+853' },
  { code: 'MW', name: 'Малави', dial: '+265' },
  { code: 'MY', name: 'Малайзия', dial: '+60' },
  { code: 'ML', name: 'Мали', dial: '+223' },
  { code: 'MV', name: 'Мальдивы', dial: '+960' },
  { code: 'MT', name: 'Мальта', dial: '+356' },
  { code: 'MA', name: 'Марокко', dial: '+212' },
  { code: 'MQ', name: 'Мартиника', dial: '+596' },
  { code: 'MH', name: 'Маршалловы о-ва', dial: '+692' },
  { code: 'MX', name: 'Мексика', dial: '+52' },
  { code: 'MZ', name: 'Мозамбик', dial: '+258' },
  { code: 'MD', name: 'Молдова', dial: '+373' },
  { code: 'MC', name: 'Монако', dial: '+377' },
  { code: 'MS', name: 'Монтсеррат', dial: '+1664' },
  { code: 'MM', name: 'Мьянма (Бирма)', dial: '+95' },
  { code: 'NA', name: 'Намибия', dial: '+264' },
  { code: 'NR', name: 'Науру', dial: '+674' },
  { code: 'NP', name: 'Непал', dial: '+977' },
  { code: 'NE', name: 'Нигер', dial: '+227' },
  { code: 'NG', name: 'Нигерия', dial: '+234' },
  { code: 'NL', name: 'Нидерланды', dial: '+31' },
  { code: 'NI', name: 'Никарагуа', dial: '+505' },
  { code: 'NU', name: 'Ниуэ', dial: '+683' },
  { code: 'NZ', name: 'Новая Зеландия', dial: '+64' },
  { code: 'NC', name: 'Новая Каледония', dial: '+687' },
  { code: 'NO', name: 'Норвегия', dial: '+47' },
  { code: 'SH', name: 'о-в Св. Елены', dial: '+290' },
  { code: 'KY', name: 'о-ва Кайман', dial: '+1345' },
  { code: 'CK', name: 'о-ва Кука', dial: '+682' },
  { code: 'OM', name: 'Оман', dial: '+968' },
  { code: 'PK', name: 'Пакистан', dial: '+92' },
  { code: 'PW', name: 'Палау', dial: '+680' },
  { code: 'PS', name: 'Палестинские территории', dial: '+970' },
  { code: 'PA', name: 'Панама', dial: '+507' },
  { code: 'PG', name: 'Папуа — Новая Гвинея', dial: '+675' },
  { code: 'PY', name: 'Парагвай', dial: '+595' },
  { code: 'PE', name: 'Перу', dial: '+51' },
  { code: 'PL', name: 'Польша', dial: '+48' },
  { code: 'PT', name: 'Португалия', dial: '+351' },
  { code: 'PR', name: 'Пуэрто-Рико', dial: '+1787' },
  { code: 'RE', name: 'Реюньон', dial: '+262' },
  { code: 'RW', name: 'Руанда', dial: '+250' },
  { code: 'RO', name: 'Румыния', dial: '+40' },
  { code: 'SV', name: 'Сальвадор', dial: '+503' },
  { code: 'WS', name: 'Самоа', dial: '+685' },
  { code: 'SM', name: 'Сан-Марино', dial: '+378' },
  { code: 'ST', name: 'Сан-Томе и Принсипи', dial: '+239' },
  { code: 'SA', name: 'Саудовская Аравия', dial: '+966' },
  { code: 'MK', name: 'Северная Македония', dial: '+389' },
  { code: 'MP', name: 'Северные Марианские о-ва', dial: '+1670' },
  { code: 'SC', name: 'Сейшельские о-ва', dial: '+248' },
  { code: 'PM', name: 'Сен-Пьер и Микелон', dial: '+508' },
  { code: 'SN', name: 'Сенегал', dial: '+221' },
  { code: 'VC', name: 'Сент-Винсент и Гренадины', dial: '+1784' },
  { code: 'KN', name: 'Сент-Китс и Невис', dial: '+1869' },
  { code: 'LC', name: 'Сент-Люсия', dial: '+1758' },
  { code: 'RS', name: 'Сербия', dial: '+381' },
  { code: 'SG', name: 'Сингапур', dial: '+65' },
  { code: 'SX', name: 'Синт-Мартен', dial: '+1721' },
  { code: 'SY', name: 'Сирия', dial: '+963' },
  { code: 'SK', name: 'Словакия', dial: '+421' },
  { code: 'SI', name: 'Словения', dial: '+386' },
  { code: 'SB', name: 'Соломоновы о-ва', dial: '+677' },
  { code: 'SO', name: 'Сомали', dial: '+252' },
  { code: 'SD', name: 'Судан', dial: '+249' },
  { code: 'SR', name: 'Суринам', dial: '+597' },
  { code: 'SL', name: 'Сьерра-Леоне', dial: '+232' },
  { code: 'TW', name: 'Тайвань', dial: '+886' },
  { code: 'TZ', name: 'Танзания', dial: '+255' },
  { code: 'TC', name: 'Тёркс и Кайкос', dial: '+1649' },
  { code: 'TG', name: 'Того', dial: '+228' },
  { code: 'TK', name: 'Токелау', dial: '+690' },
  { code: 'TO', name: 'Тонга', dial: '+676' },
  { code: 'TT', name: 'Тринидад и Тобаго', dial: '+1868' },
  { code: 'TV', name: 'Тувалу', dial: '+688' },
  { code: 'TN', name: 'Тунис', dial: '+216' },
  { code: 'UG', name: 'Уганда', dial: '+256' },
  { code: 'UA', name: 'Украина', dial: '+380' },
  { code: 'WF', name: 'Уоллис и Футуна', dial: '+681' },
  { code: 'UY', name: 'Уругвай', dial: '+598' },
  { code: 'FO', name: 'Фарерские о-ва', dial: '+298' },
  { code: 'FM', name: 'Федеративные Штаты Микронезии', dial: '+691' },
  { code: 'FJ', name: 'Фиджи', dial: '+679' },
  { code: 'PH', name: 'Филиппины', dial: '+63' },
  { code: 'FI', name: 'Финляндия', dial: '+358' },
  { code: 'FK', name: 'Фолклендские о-ва', dial: '+500' },
  { code: 'FR', name: 'Франция', dial: '+33' },
  { code: 'GF', name: 'Французская Гвиана', dial: '+594' },
  { code: 'PF', name: 'Французская Полинезия', dial: '+689' },
  { code: 'HR', name: 'Хорватия', dial: '+385' },
  { code: 'CF', name: 'Центрально-Африканская Республика', dial: '+236' },
  { code: 'TD', name: 'Чад', dial: '+235' },
  { code: 'ME', name: 'Черногория', dial: '+382' },
  { code: 'CZ', name: 'Чехия', dial: '+420' },
  { code: 'CL', name: 'Чили', dial: '+56' },
  { code: 'CH', name: 'Швейцария', dial: '+41' },
  { code: 'SE', name: 'Швеция', dial: '+46' },
  { code: 'LK', name: 'Шри-Ланка', dial: '+94' },
  { code: 'EC', name: 'Эквадор', dial: '+593' },
  { code: 'GQ', name: 'Экваториальная Гвинея', dial: '+240' },
  { code: 'ER', name: 'Эритрея', dial: '+291' },
  { code: 'SZ', name: 'Эсватини', dial: '+268' },
  { code: 'EE', name: 'Эстония', dial: '+372' },
  { code: 'ET', name: 'Эфиопия', dial: '+251' },
  { code: 'ZA', name: 'Южно-Африканская Республика', dial: '+27' },
  { code: 'SS', name: 'Южный Судан', dial: '+211' },
  { code: 'JM', name: 'Ямайка', dial: '+1876' },
  { code: 'JP', name: 'Япония', dial: '+81' },
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
  'Asia/Qatar': 'QA',
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

/* Копия `packages/domain/src/accounts/phone-country.ts` (главная `@pms/domain` не тянет): совпадение сторожит
   `phone-countries.test.ts`. Страна по первым цифрам номера и язык системы по стране (владелец 29.10.2026). */
type Locale = 'ru' | 'kk' | 'en';
export interface PhoneMatch {
  code: string;
  name: string;
  dial: string;
  /** Цифры номера после кода страны */
  national: string;
  /** false, пока страну подсказывает только общий код (+7 без следующей цифры) */
  sure: boolean;
}

/** Пары [страна, код без «+»] всех стран списка: сторож полноты в тестах */
export const WORLD_DIALS: ReadonlyArray<readonly [string, string]> = PHONE_COUNTRIES.map((c) => [c.code, c.dial.slice(1)] as const);

/** Первая страна каждого кода: у общего кода (+7, +1) это основная (Казахстан, США) */
const BY_DIAL = new Map<string, PhoneCountry>();
for (const c of PHONE_COUNTRIES) if (!BY_DIAL.has(c.dial.slice(1))) BY_DIAL.set(c.dial.slice(1), c);
const DIALS = [...BY_DIAL.keys()].sort((a, b) => b.length - a.length);
const country = (code: string) => PHONE_COUNTRIES.find((c) => c.code === code)!;

export function countryFromPhone(raw: string): PhoneMatch | null {
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!text.startsWith('+')) {
    // местная запись +7: «8 701 …», «8 916 …» (11 цифр с 8 в начале)
    if (/^8[0-9]{10}$/.test(digits)) digits = '7' + digits.slice(1);
    else return null;
  }
  if (digits === '') return null;
  const dial = DIALS.find((d) => digits.startsWith(d));
  if (!dial) return null;
  const national = digits.slice(dial.length);
  if (dial === '7') {
    const first = national[0];
    const c = first === undefined || first === '6' || first === '7' ? country('KZ') : country('RU');
    return { code: c.code, name: c.name, dial: c.dial, national, sure: first !== undefined };
  }
  const c = BY_DIAL.get(dial)!;
  return { code: c.code, name: c.name, dial: c.dial, national, sure: true };
}

/** Страны, где кабинет по умолчанию на русском: Казахстан и СНГ (там русский понимают все) */
const RUSSIAN_FIRST = new Set(['KZ', 'RU', 'BY', 'KG', 'UZ', 'TJ', 'TM', 'AZ', 'AM', 'GE', 'MD', 'MN']);

/**
 * Язык системы по стране: Казахстан и СНГ русский, остальной мир английский. С `choices` порядок языков в списке:
 * для Казахстана казахский первым (государственный), затем русский и английский.
 */
export function suggestedLocale(code: string): Locale;
export function suggestedLocale(code: string, mode: 'choices'): Locale[];
export function suggestedLocale(code: string, mode?: 'choices'): Locale | Locale[] {
  const upper = code.toUpperCase();
  if (mode === 'choices') {
    if (upper === 'KZ') return ['kk', 'ru', 'en'];
    return RUSSIAN_FIRST.has(upper) ? ['ru', 'en', 'kk'] : ['en', 'ru', 'kk'];
  }
  return RUSSIAN_FIRST.has(upper) ? 'ru' : 'en';
}
