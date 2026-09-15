/**
 * Двойной ввод (Gate 8): сравнение суток PMS ↔ Exely.
 *
 * Логика вынесена из CLI, потому что вердикт этого скрипта — и есть гейт. Раньше вердикт складывался
 * из четырёх чисел, а поимённые списки считались только после того, как числа уже разошлись. Две
 * встречные ошибки (бронь, которой нет в Exely, плюс бронь, которая не доехала) давали ноль и «OK».
 * Теперь вердикт требует и равенства чисел, и пустых поимённых списков.
 */

/** Проживание Exely: даты — YYYY-MM-DD в часовом поясе объекта */
export interface ExelyStay {
  bookingNumber: string;
  roomTypeId: string;
  checkIn: string;
  /** Плановая дата выезда */
  checkOut: string;
  /** Фактическая дата выезда (Exely отдаёт её только у выехавших) */
  actualCheckOut?: string | null;
  status: string;
  bookingStatus: string;
}

/** Проживание PMS */
export interface PmsStay {
  number: string;
  /** Ключ категории: `exelyId` типа размещения, иначе внутренний id */
  categoryKey: string;
  categoryName: string;
  arrival: string;
  departure: string;
  status: string;
  /** Перенесено из Exely (есть `exelyRoomStayId`) — иначе бронь завели в PMS */
  fromExely: boolean;
  /** Есть назначение на эту ночь: без него проживания не видно на шахматке */
  hasUnit: boolean;
}

export interface Counts {
  arrivals: number;
  departures: number;
  occupied: number;
  byCategory: Record<string, number>;
}

export interface NamedStay {
  number: string;
  category: string;
  stay: string;
  /** Короткая причина, по которой строка попала в список */
  why?: string;
}

export interface Comparison {
  exely: Counts;
  pms: Counts;
  /** Занятых клеток на шахматке: проживание без ячейки администратор не увидит */
  cellsOnGrid: number;
  withoutUnit: NamedStay[];
  /** Занимают ночь в PMS, но не в Exely */
  onlyPms: NamedStay[];
  /** Занимают ночь в Exely, но не в PMS */
  onlyExely: string[];
  /** Незаезды PMS, которые в Exely всё ещё занимают ночь: в Универсальном API незаезда нет */
  noShow: NamedStay[];
  ok: boolean;
}

const empty = (): Counts => ({ arrivals: 0, departures: 0, occupied: 0, byCategory: {} });

/**
 * Дата выезда по правилу стойки: ранний выезд заканчивает проживание фактической датой.
 * То же правило применяет импорт (`normalize-reservation.ts`), иначе сверка сравнивает
 * плановую дату Exely с фактической датой PMS и даёт ±1 на каждом раннем выезде.
 */
export function exelyDeparture(s: ExelyStay): string {
  const actual = s.status === 'CheckedOut' ? (s.actualCheckOut ?? null) : null;
  return actual && actual < s.checkOut && actual > s.checkIn ? actual : s.checkOut;
}

/** Сравнение суток: числа плюс поимённые списки, вердикт — по обоим */
export function compareDay(date: string, exelyStays: ExelyStay[], pmsStays: PmsStay[]): Comparison {
  const exely = empty();
  const exOccupying = new Set<string>();
  for (const s of exelyStays) {
    if (s.bookingStatus === 'Cancelled' || s.status === 'Cancelled') continue;
    const co = exelyDeparture(s);
    if (s.checkIn === date) exely.arrivals += 1;
    if (co === date) exely.departures += 1;
    if (s.checkIn <= date && date < co) {
      exely.occupied += 1;
      exOccupying.add(s.bookingNumber);
      exely.byCategory[s.roomTypeId] = (exely.byCategory[s.roomTypeId] ?? 0) + 1;
    }
  }

  const pms = empty();
  const occupying: NamedStay[] = [];
  const withoutUnit: NamedStay[] = [];
  const noShow: NamedStay[] = [];
  const pmsNumbers = new Set<string>();
  for (const it of pmsStays) {
    const named: NamedStay = {
      number: it.number,
      category: it.categoryName,
      stay: `${it.arrival} → ${it.departure}`,
    };
    const occupies = it.arrival <= date && date < it.departure;
    if (it.status === 'CANCELLED') continue;
    // Незаезд стойка ставит в PMS, а Универсальный API Exely его не знает («New» до конца суток).
    // Такое проживание молча выпадало из счёта и давало −1, который гасил чужую ошибку.
    if (it.status === 'NO_SHOW') {
      if (occupies && exOccupying.has(it.number))
        noShow.push({ ...named, why: 'незаезд в PMS, в Exely бронь ещё занимает ночь' });
      continue;
    }
    if (it.arrival === date) pms.arrivals += 1;
    if (it.departure === date) pms.departures += 1;
    if (!occupies) continue;
    pms.occupied += 1;
    pms.byCategory[it.categoryKey] = (pms.byCategory[it.categoryKey] ?? 0) + 1;
    pmsNumbers.add(it.number);
    if (!exOccupying.has(it.number))
      named.why = it.fromExely
        ? 'перенесена из Exely, но на эти сутки там уже не активна'
        : 'заведена в PMS, в Exely её нет';
    occupying.push(named);
    if (!it.hasUnit) withoutUnit.push(named);
  }

  const onlyPms = occupying.filter((p) => !exOccupying.has(p.number));
  const onlyExely = [...exOccupying].filter((n) => !pmsNumbers.has(n));
  const cats = new Set([...Object.keys(pms.byCategory), ...Object.keys(exely.byCategory)]);
  const ok =
    withoutUnit.length === 0 &&
    onlyPms.length === 0 &&
    onlyExely.length === 0 &&
    noShow.length === 0 &&
    pms.arrivals === exely.arrivals &&
    pms.departures === exely.departures &&
    pms.occupied === exely.occupied &&
    [...cats].every((c) => (pms.byCategory[c] ?? 0) === (exely.byCategory[c] ?? 0));

  return {
    exely,
    pms,
    cellsOnGrid: pms.occupied - withoutUnit.length,
    withoutUnit,
    onlyPms,
    onlyExely,
    noShow,
    ok,
  };
}
