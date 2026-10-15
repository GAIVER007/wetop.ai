import type { InventoryCategory } from '../../lib/api';
import { pluralRu } from '../../lib/plural';

/** Подписи категорий — одни и те же в таблице, карточках и панели (ТЗ «Категории v2», ADR-109). */
export const KIND_WORD: Record<InventoryCategory['kind'], string> = {
  PRIVATE_ROOM: 'Номер целиком',
  DORM_BED: 'Койко-место',
  APARTMENT: 'Апартаменты',
};

export const unitWord = (kind: InventoryCategory['kind'], n: number) =>
  pluralRu(n, kind === 'DORM_BED' ? ['койка', 'койки', 'коек'] : ['номер', 'номера', 'номеров']);

/** Короткая вместимость для строки таблицы и карточки */
export const capacityShort = (c: InventoryCategory) =>
  c.kind === 'DORM_BED' ? '1 гость / койка' : pluralRu(c.capacityAdults, ['гость', 'гостя', 'гостей']);

/** Вместимость словами для панели категории */
export const capacityLong = (c: InventoryCategory) =>
  c.kind === 'DORM_BED'
    ? '1 гость на койко-место'
    : `${pluralRu(c.capacityAdults, ['гость', 'гостя', 'гостей'])} ${
        c.kind === 'APARTMENT' ? 'в апартаментах' : 'в номере'
      }`;

export const addWord = (c: InventoryCategory) =>
  c.kind === 'DORM_BED' ? 'Добавить комнату с койками' : 'Добавить номер';

export const compositionHref = (c: InventoryCategory) =>
  `/inventory?category=${encodeURIComponent(c.code)}`;

/** Брони категории: разные брони за всю историю и сколько из них впереди (C4, ТЗ §17) */
export const bookingsLine = (c: InventoryCategory) =>
  `${pluralRu(c.reservations, ['бронь', 'брони', 'броней'])} в истории` +
  (c.upcomingReservations ? `, из них ${c.upcomingReservations} впереди` : '');

/** «Эту категорию используют» — только то, что есть; пустой список — категорию ничего не держит */
export function usageLines(c: InventoryCategory, units: number): string[] {
  return [
    ...(units ? [unitWord(c.kind, units)] : []),
    ...(c.reservations ? [bookingsLine(c)] : []),
    ...(c.channexMapped ? ['Сопоставлена с каналами'] : []),
  ];
}
