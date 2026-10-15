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
  /** «Гости и бронирования» (09.10.2026): нужны только основному проживанию строки, остальным не передаются */
  adults?: number;
  children?: number;
  source?: string;
  channel?: string | null;
  currency?: string;
  /** Счёт проживания в минорных единицах строками (ADR-008); null или не передан значит, что счёта нет */
  money?: GuestStayMoney | null;
}

/** Начислено, оплачено, возвращено и остаток по счёту проживания (формула `folioBalance`: остаток = начислено − оплачено + возвращено) */
export interface GuestStayMoney {
  chargedMinor: string;
  paidMinor: string;
  refundedMinor: string;
  balanceMinor: string;
}

/**
 * Основное проживание строки «Гости и бронирования»: то, о чём таблица отвечает про гостя. Заселён сейчас, иначе
 * ближайший будущий визит, иначе последний состоявшийся. Тот же приоритет, что у `summarizeGuestStays`, поэтому
 * колонки «Номер», «Даты», «Оплата» всегда про бронь, которую видно и в «Сейчас / ближайший визит».
 */
export type GuestMainStayKind = 'current' | 'next' | 'last';
export interface GuestMainStay {
  kind: GuestMainStayKind;
  confirmationNumber: string | null;
  /** Статус проживания: CHECKED_IN, CONFIRMED, TENTATIVE или CHECKED_OUT */
  status: string;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  unitCode: string | null;
  accommodationTypeName: string;
  adults: number;
  children: number;
  /** Откуда бронь: стойка, сайт, канал продаж; название канала, если есть */
  source: string;
  channel: string | null;
  currency: string;
  /** null значит, что счёта у проживания нет */
  money: GuestStayMoney | null;
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

const dayNights = (arrival: string, departure: string) =>
  Math.max(0, Math.round((Date.parse(departure) - Date.parse(arrival)) / 86400000));

/**
 * Основное проживание гостя (см. `GuestMainStay`). Среди нескольких заселённых берётся более позднее по заезду, среди
 * ожидаемых ближайшее по заезду, среди выехавших последнее по выезду: ровно как в `summarizeGuestStays`. Отменённые,
 * незаезды и целиком прошедшие неподтверждённые брони не выбираются никогда; нет подходящих проживаний: `null`.
 */
export function pickMainStay(stays: GuestStayFacts[], today: string): GuestMainStay | null {
  let best: { stay: GuestStayFacts; kind: GuestMainStayKind } | null = null;
  const rank = { current: 0, next: 1, last: 2 } as const;
  for (const s of stays) {
    let kind: GuestMainStayKind | null = null;
    if (s.status === 'CHECKED_IN') kind = 'current';
    else if (s.status === 'CONFIRMED' || s.status === 'TENTATIVE')
      kind = s.departureDate >= today ? 'next' : null;
    else if (s.status === 'CHECKED_OUT') kind = 'last';
    if (!kind) continue;
    if (!best || rank[kind] < rank[best.kind]) {
      best = { stay: s, kind };
      continue;
    }
    if (rank[kind] !== rank[best.kind]) continue;
    const better =
      kind === 'current'
        ? s.arrivalDate > best.stay.arrivalDate
        : kind === 'next'
          ? s.arrivalDate < best.stay.arrivalDate
          : s.departureDate > best.stay.departureDate;
    if (better) best = { stay: s, kind };
  }
  if (!best) return null;
  const s = best.stay;
  return {
    kind: best.kind,
    confirmationNumber: s.confirmationNumber ?? null,
    status: s.status,
    arrivalDate: s.arrivalDate,
    departureDate: s.departureDate,
    nights: dayNights(s.arrivalDate, s.departureDate),
    unitCode: s.unitCode,
    accommodationTypeName: s.accommodationTypeName,
    adults: s.adults ?? 1,
    children: s.children ?? 0,
    source: s.source ?? 'DESK',
    channel: s.channel ?? null,
    currency: s.currency ?? 'KZT',
    money: s.money ?? null,
  };
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
