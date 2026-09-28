/** Ограничения продажи на одну дату — поля таблицы `restrictions` без ключа. */
export interface RestrictionFields {
  minStay: number | null;
  maxStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

export type RestrictionPatch = Partial<RestrictionFields>;

export interface RestrictionRow extends RestrictionFields {
  date: string;
}

/** Ничего не закрыто и сроков нет — такой строки в базе быть не должно. */
export function isEmptyRestriction(r: RestrictionFields): boolean {
  return (
    r.minStay === null &&
    r.maxStay === null &&
    !r.stopSell &&
    !r.closedToArrival &&
    !r.closedToDeparture
  );
}

/**
 * Строки ограничений после правки: текущее значение даты + правка поверх. Дата, на которой после правки
 * ничего не закрыто, строки не получает: пустая строка значит «ограничения нет».
 */
export function mergeRestrictions(
  dates: readonly string[],
  existingByDate: ReadonlyMap<string, RestrictionFields>,
  patch: RestrictionPatch,
): RestrictionRow[] {
  return dates
    .map((date) => {
      const cur = existingByDate.get(date);
      return {
        date,
        minStay: cur?.minStay ?? null,
        maxStay: cur?.maxStay ?? null,
        stopSell: cur?.stopSell ?? false,
        closedToArrival: cur?.closedToArrival ?? false,
        closedToDeparture: cur?.closedToDeparture ?? false,
        ...patch,
      };
    })
    .filter((r) => !isEmptyRestriction(r));
}
