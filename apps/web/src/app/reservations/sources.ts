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
