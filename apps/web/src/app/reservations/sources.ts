import { sourceStatus } from '../../lib/status/source';

/**
 * Источники ручной брони (Q-089): значение enum ReservationSource и подпись из реестра
 * `lib/status/source` (DS1a). Один список для формы и карточки; канал продаж здесь вносится вручную.
 */
export const SOURCES: ReadonlyArray<readonly [string, string]> = (
  ['DESK', 'PHONE', 'WHATSAPP', 'WALK_IN', 'INSTAGRAM', 'WEBSITE', 'OTA'] as const
).map(
  (k) => [k, k === 'OTA' ? `${sourceStatus.OTA.label} (вручную)` : sourceStatus[k].label] as const,
);

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
