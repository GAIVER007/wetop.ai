/** Источники ручной брони (Q-089): значение enum ReservationSource → подпись на стойке. Один список для формы и карточки. */
export const SOURCES: ReadonlyArray<readonly [string, string]> = [
  ['DESK', 'стойка'],
  ['PHONE', 'телефон'],
  ['WHATSAPP', 'WhatsApp'],
  ['WALK_IN', 'с улицы'],
  ['INSTAGRAM', 'Instagram'],
  ['WEBSITE', 'сайт'],
  ['OTA', 'OTA (вручную)'],
];

/**
 * Каналы объекта для ручной брони OTA (ADR-071): стойка выбирает, где сделана бронь, и вписывает её номер из
 * экстранета — по нему WETOP узнает бронь, когда канал подключат к Channex. Имена — как их хранит API.
 */
export const CHANNELS: ReadonlyArray<string> = [
  'Booking.com',
  'Trip.com',
  'Expedia',
  'Agoda',
  'Hostelworld',
  'Ostrovok.ru',
  'Bronevik.com',
  'OneTwoTrip',
];

/** Бронь пришла из Channex: её внешний ID — `unique_id` с кодом канала (`BDC-9996013801`), стойка его не правит */
export const fromChannex = (externalId: string | null | undefined) =>
  /^[A-Z]{3}-/.test(externalId ?? '');
