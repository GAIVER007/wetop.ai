import { hospitality } from '../../lib/status/hospitality';
import type { ChessboardCell, ChessboardRow } from '../../lib/api';
import { CHANNELS, SOURCES } from '../reservations/sources';

/**
 * Отбор в календаре (ТЗ «Шахматка v2» §8–10, §41; решения — `plans/chessboard-v2-2026-09-27.md`,
 * PR 7). Работает по уже загруженной сетке, запросов не делает. Места отбираются категорией, типом и
 * состоянием на первую дату окна; брони — «Заезд/Выезд сегодня», «Проживают», «С долгом», источником и
 * статусом: внутри группы «или», между группами «и». Строка места видна, если на ней есть хоть одно
 * подходящее проживание окна; неподходящие плашки сетка приглушает.
 */
export type StayFlag = 'arrival' | 'departure' | 'inhouse' | 'debt';
export type UnitState = 'all' | 'FREE' | 'OCCUPIED' | 'BLOCKED' | 'cleaning';

export interface BoardFilters {
  category: string;
  state: UnitState;
  kind: '' | 'ROOM' | 'BED';
  stays: StayFlag[];
  sources: string[];
  statuses: string[];
}

export const NO_FILTERS: BoardFilters = {
  category: '',
  state: 'all',
  kind: '',
  stays: [],
  sources: [],
  statuses: [],
};

export const STAY_FLAGS: ReadonlyArray<readonly [StayFlag, string]> = [
  ['arrival', 'Заезд сегодня'],
  ['departure', 'Выезд сегодня'],
  ['inhouse', 'Проживают'],
  ['debt', 'С долгом'],
];

/** Статусы, которые бывают на сетке: отменённых и незаездов там нет (решение владельца не принято) */
const STATUS_ORDER: ReadonlyArray<readonly [string, string]> = [
  ['TENTATIVE', hospitality.TENTATIVE.label],
  ['CONFIRMED', hospitality.CONFIRMED.label],
  ['CHECKED_IN', hospitality.CHECKED_IN.label],
  ['CHECKED_OUT', hospitality.CHECKED_OUT.label],
];

/**
 * Уборка: значок стоит в строке, пока с ячейкой надо что-то делать — «требует уборки» или «убрано,
 * ждёт проверки»; после «Проверено» ячейка доступна. Отбор «Уборка N» считает те же строки.
 */
export const needsHousekeeping = (status?: string): status is 'DIRTY' | 'CLEAN' =>
  status === 'DIRTY' || status === 'CLEAN';

/** Число заданных условий — на кнопке «Фильтры N». Поиск не считается: у него своё поле */
export function activeFilterCount(f: BoardFilters): number {
  return (
    (f.category ? 1 : 0) +
    (f.state !== 'all' ? 1 : 0) +
    (f.kind ? 1 : 0) +
    f.stays.length +
    f.sources.length +
    f.statuses.length
  );
}

/** Ключ источника: у брони из канала — сам канал, у прямой — вид источника */
export const sourceKey = (cell: ChessboardCell): string | null =>
  cell.channel || cell.source || null;

const capital = (s: string) => s.charAt(0).toLocaleUpperCase('ru') + s.slice(1);
const sourceLabel = (key: string) => {
  const direct = SOURCES.find(([value]) => value === key);
  return direct ? capital(direct[1]) : key;
};
/** Порядок постоянный, а не по встрече на сетке: сначала каналы, затем прямые источники */
const sourceRank = (key: string) => {
  const channel = CHANNELS.indexOf(key);
  if (channel >= 0) return channel;
  const direct = SOURCES.findIndex(([value]) => value === key);
  return direct >= 0 ? 100 + direct : 50;
};

const staysOf = (rows: ChessboardRow[]) =>
  rows.flatMap((r) => r.cells.filter((c) => c.state === 'OCCUPIED' && c.itemId));

/** Источники, которые есть на загруженной сетке — только их и предлагает окошко «Фильтры» */
export function sourceOptions(rows: ChessboardRow[]): Array<{ key: string; label: string }> {
  const keys = new Set<string>();
  for (const cell of staysOf(rows)) {
    const key = sourceKey(cell);
    if (key) keys.add(key);
  }
  return [...keys]
    .sort((a, b) => sourceRank(a) - sourceRank(b) || a.localeCompare(b, 'ru'))
    .map((key) => ({ key, label: sourceLabel(key) }));
}

/** Статусы броней, которые есть на загруженной сетке */
export function statusOptions(rows: ChessboardRow[]): Array<{ key: string; label: string }> {
  const present = new Set(staysOf(rows).map((c) => c.itemStatus));
  return STATUS_ORDER.filter(([key]) => present.has(key)).map(([key, label]) => ({ key, label }));
}

const dayBefore = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Подходит ли ночь проживания под условия по броням. «Заезд сегодня» — первая ночь сегодня; «Выезд
 * сегодня» — последняя ночь вчера (выезд — утро после последней ночи): на неделе, начатой сегодня,
 * вчерашней ночи в окне нет, и такая бронь не найдётся.
 */
export function stayMatches(cell: ChessboardCell, f: BoardFilters, today: string): boolean {
  if (f.stays.length > 0) {
    const hit = f.stays.some((flag) => {
      switch (flag) {
        case 'arrival':
          return !!cell.isArrival && cell.date === today;
        case 'departure':
          return !!cell.isLastNight && cell.date === dayBefore(today);
        case 'inhouse':
          return cell.itemStatus === 'CHECKED_IN';
        case 'debt':
          return BigInt(cell.balanceMinor ?? '0') > 0n;
      }
    });
    if (!hit) return false;
  }
  if (f.sources.length > 0) {
    const key = sourceKey(cell);
    if (!key || !f.sources.includes(key)) return false;
  }
  if (f.statuses.length > 0 && !f.statuses.includes(cell.itemStatus ?? '')) return false;
  return true;
}

/** Есть ли условия по броням (тогда пустые строки мест скрываются, а плашки приглушаются) */
export const hasStayFilters = (f: BoardFilters) =>
  f.stays.length > 0 || f.sources.length > 0 || f.statuses.length > 0;

export interface SearchNeedle {
  text: string;
  /** цифры запроса — для телефона; меньше трёх цифр телефоном не ищем */
  digits: string;
}

export function searchNeedle(query: string): SearchNeedle | null {
  const text = query.trim().toLocaleLowerCase('ru');
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return { text, digits: digits.length >= 3 ? digits : '' };
}

const has = (value: string | null | undefined, needle: SearchNeedle) =>
  !!value && value.toLocaleLowerCase('ru').includes(needle.text);

/** Бронь находится по имени гостя, номеру брони и телефону (цифрами, как ни записан) */
export function stayMatchesSearch(cell: ChessboardCell, needle: SearchNeedle): boolean {
  if (has(cell.guestLabel, needle) || has(cell.confirmationNumber, needle)) return true;
  return !!needle.digits && !!cell.guestPhone?.replace(/\D/g, '').includes(needle.digits);
}

/** Место находится по коду и категории */
export const unitMatchesSearch = (unit: ChessboardRow['unit'], needle: SearchNeedle) =>
  has(unit.code, needle) || has(unit.accommodationTypeName, needle);

const unitPasses = (row: ChessboardRow, f: BoardFilters) =>
  (!f.category || row.unit.accommodationTypeCode === f.category) &&
  (!f.kind || row.unit.kind === f.kind) &&
  (f.state === 'all' ||
    (f.state === 'cleaning'
      ? needsHousekeeping(row.unit.housekeepingStatus)
      : row.cells[0]?.state === f.state));

const occupied = (c: ChessboardCell) => c.state === 'OCCUPIED' && !!c.itemId;

/** Строки мест, которые видны при этих условиях и поиске */
export function filterRows(
  rows: ChessboardRow[],
  f: BoardFilters,
  today: string,
  needle: SearchNeedle | null,
): ChessboardRow[] {
  const byStays = hasStayFilters(f);
  return rows.filter((row) => {
    if (!unitPasses(row, f)) return false;
    const stays = byStays
      ? row.cells.filter((c) => occupied(c) && stayMatches(c, f, today))
      : row.cells.filter(occupied);
    if (byStays && stays.length === 0) return false;
    if (!needle) return true;
    return unitMatchesSearch(row.unit, needle) || stays.some((c) => stayMatchesSearch(c, needle));
  });
}
