import type { InventoryCategory } from '../../lib/api';
import { countLabel, msg, type DeskLocale, type Translate } from '../../i18n';

/** Подписи категорий — одни и те же в таблице, карточках и панели (ТЗ «Категории v2», ADR-109). */
export const KIND_WORD: Record<InventoryCategory['kind'], string> = {
  PRIVATE_ROOM: msg('Номер целиком'),
  DORM_BED: msg('Койко-место'),
  APARTMENT: msg('Апартаменты'),
};

export const unitWord = (kind: InventoryCategory['kind'], n: number, locale: DeskLocale, t: Translate) =>
  countLabel(
    locale,
    t,
    n,
    kind === 'DORM_BED' ? [msg('койка'), msg('койки'), msg('коек')] : [msg('номер'), msg('номера'), msg('номеров')],
  );

const guests = (n: number, locale: DeskLocale, t: Translate) =>
  countLabel(locale, t, n, [msg('гость'), msg('гостя'), msg('гостей')]);

/** Короткая вместимость для строки таблицы и карточки */
export const capacityShort = (c: InventoryCategory, locale: DeskLocale, t: Translate) =>
  c.kind === 'DORM_BED' ? t('1 гость / койка') : guests(c.capacityAdults, locale, t);

/** Вместимость словами для панели категории */
export const capacityLong = (c: InventoryCategory, locale: DeskLocale, t: Translate) =>
  c.kind === 'DORM_BED'
    ? t('1 гость на койко-место')
    : c.kind === 'APARTMENT'
      ? t('{guests} в апартаментах', { guests: guests(c.capacityAdults, locale, t) })
      : t('{guests} в номере', { guests: guests(c.capacityAdults, locale, t) });

export const addWord = (c: InventoryCategory) =>
  c.kind === 'DORM_BED' ? msg('Добавить комнату с койками') : msg('Добавить номер');

export const compositionHref = (c: InventoryCategory) =>
  `/inventory?category=${encodeURIComponent(c.code)}`;

/** Брони категории: разные брони за всю историю и сколько из них впереди (C4, ТЗ §17) */
export const bookingsLine = (c: InventoryCategory, locale: DeskLocale, t: Translate) =>
  t('{bookings} в истории', { bookings: countLabel(locale, t, c.reservations, [msg('бронь'), msg('брони'), msg('броней')]) }) +
  (c.upcomingReservations ? t(', из них {n} впереди', { n: c.upcomingReservations }) : '');

/** «Эту категорию используют» — только то, что есть; пустой список — категорию ничего не держит */
export function usageLines(c: InventoryCategory, units: number, locale: DeskLocale, t: Translate): string[] {
  return [
    ...(units ? [unitWord(c.kind, units, locale, t)] : []),
    ...(c.reservations ? [bookingsLine(c, locale, t)] : []),
    ...(c.channexMapped ? [t('Сопоставлена с каналами')] : []),
  ];
}
