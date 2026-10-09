import { PROPERTY_AMENITIES } from '@pms/domain';
import type { HotelSettings } from '../../lib/hotel-api';
import type { IconName } from '../../components/icon';

type Property = HotelSettings['property'];

/** Значок удобства по коду каталога домена (ADR-156); новый код без значка получает общий «check» */
export const AMENITY_ICON: Record<string, IconName> = {
  wifi: 'wifi',
  parking: 'parking',
  air_conditioning: 'snowflake',
  kitchen: 'kitchen',
  transfer: 'transfer',
  breakfast: 'breakfast',
  laundry: 'laundry',
  tv: 'tv',
  elevator: 'elevator',
  reception_24h: 'reception',
  luggage_storage: 'luggage',
  workspace: 'laptop',
  safe: 'lock',
  hair_dryer: 'wind',
  iron: 'iron',
  kettle: 'kettle',
  terrace: 'terrace',
  pool: 'pool',
  gym: 'gym',
  sauna: 'sauna',
};
export const amenityIcon = (code: string): IconName => AMENITY_ICON[code] ?? 'check';
export const amenityLabel = (code: string) =>
  PROPERTY_AMENITIES.find((a) => a.code === code)?.label ?? code;
/** Сколько удобств видно сразу, остальные раскрывает «Добавить услугу» (верстка владельца) */
export const AMENITIES_VISIBLE = 7;

/** Страны для выбора; код вне списка (уже записан в объекте) добавляется к нему сам */
export const COUNTRIES: ReadonlyArray<readonly [string, string]> = [
  ['KZ', 'Казахстан'],
  ['RU', 'Россия'],
  ['UZ', 'Узбекистан'],
  ['KG', 'Кыргызстан'],
  ['TJ', 'Таджикистан'],
  ['TM', 'Туркменистан'],
  ['AZ', 'Азербайджан'],
  ['AM', 'Армения'],
  ['GE', 'Грузия'],
  ['BY', 'Беларусь'],
  ['UA', 'Украина'],
  ['TR', 'Турция'],
  ['AE', 'ОАЭ'],
  ['TH', 'Таиланд'],
  ['EG', 'Египет'],
  ['CN', 'Китай'],
  ['DE', 'Германия'],
  ['FR', 'Франция'],
  ['ES', 'Испания'],
  ['IT', 'Италия'],
  ['GB', 'Великобритания'],
  ['US', 'США'],
];
export const KZ_CITIES = [
  'Алматы',
  'Астана',
  'Шымкент',
  'Караганда',
  'Актобе',
  'Атырау',
  'Актау',
  'Павлодар',
  'Усть-Каменогорск',
  'Костанай',
  'Туркестан',
  'Боровое',
  'Балхаш',
];
/** Время с шагом 30 минут для подсказок поля; само поле принимает любое время ЧЧ:ММ */
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
);

/** Умолчания карточки на случай, когда старый API полей не прислал (DATA_MODEL §31.1) */
export function withCardDefaults(p: Property): Required<
  Pick<
    Property,
    | 'earlyCheckIn'
    | 'lateCheckOut'
    | 'childrenAllowed'
    | 'petsAllowed'
    | 'smokingAllowed'
    | 'onsitePayment'
    | 'cancellationRule'
    | 'depositRule'
    | 'minGuestAge'
    | 'amenities'
  >
> &
  Property {
  return {
    ...p,
    earlyCheckIn: p.earlyCheckIn ?? false,
    lateCheckOut: p.lateCheckOut ?? false,
    childrenAllowed: p.childrenAllowed ?? true,
    petsAllowed: p.petsAllowed ?? false,
    smokingAllowed: p.smokingAllowed ?? false,
    onsitePayment: p.onsitePayment ?? 'CASH_CARD',
    cancellationRule: p.cancellationRule ?? 'FREE_1D',
    depositRule: p.depositRule ?? 'NONE',
    minGuestAge: p.minGuestAge ?? 18,
    amenities: p.amenities ?? [],
  };
}

/** Значения формы как строки, по которым считаются «есть изменения» и предпросмотр: булево 'true'/'false', удобства через запятую */
export function formText(value: unknown): string {
  if (Array.isArray(value)) return value.join(',');
  return String(value ?? '');
}

/** Поля, у которых несколько значений в форме (флажки удобств) */
export const MULTI_FIELDS = new Set<string>(['amenities']);

/** Значение поля из формы: у выключателей и флажков значений несколько, считается последнее (или список) */
export function readFormField(data: FormData, name: string): string {
  const all = data.getAll(name).map(String);
  if (MULTI_FIELDS.has(name)) return all.filter(Boolean).join(',');
  // textarea отдаёт переводы строк как CRLF: сравниваем с записью объекта, где они LF
  return (all.at(-1) ?? '').replace(/\r\n?/g, '\n').trim();
}
