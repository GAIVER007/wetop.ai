/**
 * «Гости v2» (ТЗ владельца 27.09.2026, §12–§16): строка справочника отвечает о человеке, а не о брони.
 * Из проживаний гостя считаются четыре вещи: где он сейчас, ближайший будущий визит, последний
 * состоявшийся визит и число визитов. Статус брони наружу не выходит — «отменена» описывает бронь,
 * а не человека (§15).
 *
 * Функция чистая и одна на всех: репозиторий API и подставной API стенда считают состояние ею,
 * а SQL-условия отбора в репозитории повторяют её определения (см. guests.repository.ts).
 */

export type GuestDirectoryState = 'INHOUSE' | 'EXPECTED' | 'RECENT' | 'NONE';

/** «Недавние» = выехал за последние N дней: гость трёхлетней давности ≠ выехавший вчера (ТЗ §7) */
export const GUEST_RECENT_DAYS = 30;

/** Проживание глазами справочника гостей: статус проживания и его границы, ячейка и категория */
export interface GuestStayFacts {
  status: string;
  /** YYYY-MM-DD в поясе объекта (AGENTS.md §13) */
  arrivalDate: string;
  departureDate: string;
  unitCode: string | null;
  accommodationTypeName: string;
  /** Номер брони — для «Открыть бронь» в предпросмотре (G3); списку не нужен и не передаётся */
  confirmationNumber?: string | null;
}

export interface GuestStaySummary {
  /** Визиты — состоявшиеся проживания: живёт сейчас или уже выехал. Отмена и незаезд — не визит */
  staysCount: number;
  state: GuestDirectoryState;
  /** Живёт сейчас: где и до какого числа */
  current: {
    unitCode: string | null;
    accommodationTypeName: string;
    departureDate: string;
    confirmationNumber: string | null;
  } | null;
  /** Ближайший будущий визит; просроченный заезд (заезд в прошлом, выезд ещё нет) остаётся здесь */
  next: {
    arrivalDate: string;
    departureDate: string;
    accommodationTypeName: string;
    confirmationNumber: string | null;
  } | null;
  /** Последний состоявшийся визит */
  last: {
    arrivalDate: string;
    departureDate: string;
    unitCode: string | null;
    confirmationNumber: string | null;
  } | null;
  /** Дата заезда последней отменённой/незаезда — только когда визитов нет и ничего не ожидается (ТЗ §16) */
  lastCancelledAt: string | null;
}

/** Ночей по визитам (живёт сейчас или уже выехал) — вся длительность проживания, как в счёте */
export function countGuestNights(stays: GuestStayFacts[]): number {
  let nights = 0;
  for (const s of stays)
    if (s.status === 'CHECKED_IN' || s.status === 'CHECKED_OUT')
      nights += Math.max(
        0,
        Math.round((Date.parse(s.departureDate) - Date.parse(s.arrivalDate)) / 86400000),
      );
  return nights;
}

/** Дата через n дней от YYYY-MM-DD; отрицательное n — назад */
export function shiftDate(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function summarizeGuestStays(stays: GuestStayFacts[], today: string): GuestStaySummary {
  let current: GuestStaySummary['current'] = null;
  let currentArrival = '';
  let next: GuestStaySummary['next'] = null;
  let last: GuestStaySummary['last'] = null;
  let cancelledAt: string | null = null;
  let staysCount = 0;
  for (const s of stays) {
    if (s.status === 'CHECKED_IN') {
      staysCount += 1;
      // из двух заселённых показывается более позднее: оно и есть «сейчас»
      if (!current || s.arrivalDate > currentArrival) {
        current = {
          unitCode: s.unitCode,
          accommodationTypeName: s.accommodationTypeName,
          departureDate: s.departureDate,
          confirmationNumber: s.confirmationNumber ?? null,
        };
        currentArrival = s.arrivalDate;
      }
    } else if (s.status === 'CHECKED_OUT') {
      staysCount += 1;
      if (!last || s.departureDate > last.departureDate)
        last = {
          arrivalDate: s.arrivalDate,
          departureDate: s.departureDate,
          unitCode: s.unitCode,
          confirmationNumber: s.confirmationNumber ?? null,
        };
    } else if (s.status === 'CONFIRMED' || s.status === 'TENTATIVE') {
      // выезд ещё не прошёл — визит впереди; целиком прошедшая подтверждённая бронь — ничья
      if (s.departureDate >= today && (!next || s.arrivalDate < next.arrivalDate))
        next = {
          arrivalDate: s.arrivalDate,
          departureDate: s.departureDate,
          accommodationTypeName: s.accommodationTypeName,
          confirmationNumber: s.confirmationNumber ?? null,
        };
    } else if (s.status === 'CANCELLED' || s.status === 'NO_SHOW') {
      if (!cancelledAt || s.arrivalDate > cancelledAt) cancelledAt = s.arrivalDate;
    }
  }
  const state: GuestDirectoryState = current
    ? 'INHOUSE'
    : next
      ? 'EXPECTED'
      : last && last.departureDate >= shiftDate(today, -GUEST_RECENT_DAYS)
        ? 'RECENT'
        : 'NONE';
  return {
    staysCount,
    state,
    current,
    next,
    last,
    lastCancelledAt: staysCount === 0 && !next ? cancelledAt : null,
  };
}
