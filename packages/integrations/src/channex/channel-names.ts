/**
 * Ключ канала продаж. Channex и сами площадки используют разные написания одного имени, поэтому
 * они приводятся к одному ключу: нижний регистр, только латинские буквы, затем алиасы.
 *
 * Значения `ota_name` — только из документации (AGENTS.md §5), `docs/channex/site/api-v.1-documentation/`:
 * - Booking.com — `"Booking.com"` (bookings-collection.md:340) и `"BookingCom"` (:1192, messages-collection.md:71);
 * - Expedia — `"A-Expedia"` (bookings-collection.md:1802, :1881) и `"Expedia"` (messages-collection.md:71);
 * - Trip.com — канал в Channex называется «Ctrip» (channel-mapping-guides/ctrip-trip.com.md:22), но примера
 *   `ota_name` в документации НЕТ — вопрос Channex через ведущего (QUESTIONS.md). До ответа сюда включены все
 *   правдоподобные написания, а имя, которого PMS не знает, при совпадении состава проживаний с перенесённой
 *   бронью приём ревизий отклоняет с объяснением, а не создаёт дубль молча (inbound.service.ts).
 * Имена из прогона 11.09.2026 (`Ctrip`, `Agoda`, `Hostelworld`, `Ostrovok`) мы вписывали в `ota_name` сами
 * через Booking CRS API — это не документация.
 * Кириллица и цифры ключа не дают — такое имя ни с чем не сопоставится, и это правильно.
 */
const ALIASES: Readonly<Record<string, string>> = {
  aexpedia: 'expedia',
  expediahotelscom: 'expedia',
  hotelscom: 'expedia',
  tripcomgroup: 'ctrip',
  tripcom: 'ctrip',
  ctripcom: 'ctrip',
  ostrovokruemergingtravelgroup: 'ostrovok',
  ostrovokru: 'ostrovok',
  emergingtravelgroupostrovok: 'ostrovok',
  emergingtravelgroup: 'ostrovok',
  etg: 'ostrovok',
  bronevikcom: 'bronevik',
};

export function otaChannelKey(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z]/g, '');
  return ALIASES[key] ?? key;
}

/**
 * Имя канала для отчётов (plans/channel-name-canonical-2026-09-22.md). Channex присылает один канал под разными
 * именами (`"Booking.com"` и `"BookingCom"`, `"A-Expedia"` и `"Expedia"`). Отчёты группируют брони
 * по имени, поэтому все написания одного канала сводятся к одному.
 * Канал, которого у объекта нет, показывается как пришёл: имя не придумывается.
 */
const CHANNEL_LABELS: Readonly<Record<string, string>> = {
  bookingcom: 'Booking.com',
  expedia: 'Expedia',
  ctrip: 'Trip.com',
  agoda: 'Agoda',
  hostelworld: 'Hostelworld',
  ostrovok: 'Ostrovok.ru',
  bronevik: 'Bronevik.com',
  onetwotrip: 'OneTwoTrip',
};

export function otaChannelLabel(name: string): string {
  return CHANNEL_LABELS[otaChannelKey(name)] ?? name;
}

/**
 * Код канала — первые три буквы `unique_id` брони (`docs/channex/site/api-v.1-documentation/channel-codes.md`:
 * «You can find the shortcodes on our unique ID, save the first 3 letters to use for matching. Some channels
 * appear in the list several times under different name variants — match by the code, not by the name»).
 * Поэтому ключ ревизии берётся по коду, а имя `ota_name` — только запасной путь для кода, которого в списке нет.
 * Коды каналов объекта по тому же списку (номера строк файла):
 */
const CHANNEL_CODE_KEYS: Readonly<Record<string, string>> = {
  BDC: 'bookingcom', // :74–75 Booking.com / BookingCom
  EXP: 'expedia', // :198 Expedia
  HTL: 'expedia', // :311 Hotels.com (Expedia)
  EAN: 'expedia', // :168 Expedia Affiliate Network
  EBS: 'expedia', // :172 ebookers (Expedia)
  EGN: 'expedia', // :180 Egencia (Expedia)
  AET: 'expedia', // :28 American Express Travel (Expedia)
  AHC: 'expedia', // :33 Amex The Hotel Collection (Expedia)
  AHR: 'expedia', // :35 Amex Fine Hotels and Resorts (Expedia)
  CHT: 'expedia', // :127 CheapTickets (Expedia)
  AGO: 'agoda', // :30 Agoda
  HWL: 'hostelworld', // :324–328 Hostel World / HOSTELWORLD / Hostelworld Group
  CTP: 'ctrip', // :140 Ctrip (Trip.com)
  OVK: 'ostrovok', // :454 Emerging Travel Group (Ostrovok)
};

/** Основной код канала в `unique_id` Channex — у Expedia кодов много, бронь самой Expedia идёт под EXP */
const PRIMARY_CODE: Readonly<Record<string, string>> = {
  bookingcom: 'BDC',
  expedia: 'EXP',
  ctrip: 'CTP',
  agoda: 'AGO',
  hostelworld: 'HWL',
  ostrovok: 'OVK',
};

/**
 * Как бронь канала с этим номером называется в Channex (`unique_id`: код канала и номер брони на его стороне,
 * `BDC-9996013801`) — чтобы стойка не завела вручную бронь, которую Channex уже прислал (ADR-071).
 * null — у канала нет Channex (OneTwoTrip, Bronevik) или имя незнакомое.
 */
export function channexUniqueIdOf(channelName: string, otaReservationCode: string): string | null {
  const code = PRIMARY_CODE[otaChannelKey(channelName)];
  return code ? `${code}-${otaReservationCode}` : null;
}

/** Трёхбуквенный код из `unique_id` (`EXP-1695093244` → `EXP`), null если формат другой. */
export function channelCodeOf(uniqueId: string): string | null {
  const m = /^([A-Z]{3})-/.exec(uniqueId);
  return m ? m[1]! : null;
}

/** Ключ канала ревизии Channex: по коду из `unique_id`, а если код не из списка объекта — по имени `ota_name`. */
export function channelKey(uniqueId: string, otaName: string): string {
  const code = channelCodeOf(uniqueId);
  return (code && CHANNEL_CODE_KEYS[code]) || otaChannelKey(otaName);
}

/** Ключи восьми каналов объекта (OBJECT.md). Неизвестный ключ — имя канала, которого PMS ещё не видела. */
export const KNOWN_CHANNEL_KEYS: ReadonlySet<string> = new Set([
  'bookingcom',
  'ctrip',
  'expedia',
  'agoda',
  'hostelworld',
  'ostrovok',
  'bronevik',
  'onetwotrip',
]);
