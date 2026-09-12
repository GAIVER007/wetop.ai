/**
 * Ключ канала продаж (ADR-024). У Exely и Channex имена каналов разные: «Trip.com Group» против канала
 * «Ctrip», «Expedia/Hotels.com» против `A-Expedia`, «Ostrovok.ru (Emerging Travel Group)» против
 * «Emerging Travel Group (Ostrovok)». Чтобы сопоставить перенесённую из Exely бронь с ревизией Channex,
 * оба имени приводятся к одному ключу: нижний регистр, только латинские буквы, затем алиасы.
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

/**
 * Каналы, для которых Channex при подключении подтягивает уже существующие будущие брони и присылает их
 * как `booking_new` (`load_future_reservations`; ответ Channex владельцу 11.09.2026,
 * docs/channex/how-channex-works-for-us.md «Что Channex делает сам при подключении канала»). Только для них
 * ревизия ищется среди перенесённых из Exely броней. Agoda, Hostelworld и Ostrovok Channex не подтягивает:
 * их бронь с таким же составом проживаний, как у перенесённой, — новая бронь, а не дубль.
 */
export const CHANNEX_PULLS_EXISTING_BOOKINGS: ReadonlySet<string> = new Set([
  'bookingcom',
  'ctrip',
  'expedia',
]);

/** Ключи восьми каналов объекта (OBJECT.md). Неизвестный ключ — имя канала, которого PMS ещё не видела. */
export const KNOWN_CHANNEL_KEYS: ReadonlySet<string> = new Set([
  ...CHANNEX_PULLS_EXISTING_BOOKINGS,
  'agoda',
  'hostelworld',
  'ostrovok',
  'bronevik',
  'onetwotrip',
]);
