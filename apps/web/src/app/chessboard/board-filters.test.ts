import { describe, expect, it } from 'vitest';
import type { ChessboardCell, ChessboardRow } from '../../lib/api';
import {
  NO_FILTERS,
  activeFilterCount,
  filterRows,
  searchNeedle,
  sourceOptions,
  statusOptions,
  stayMatches,
  stayMatchesSearch,
  type BoardFilters,
} from './board-filters';

/**
 * «Шахматка v2» PR 7 (ТЗ §8–10, §41): отбор строк мест и подсветка броней на уже загруженной сетке.
 * Места — категория, тип, состояние на первую дату окна; брони — «Заезд/Выезд сегодня», «Проживают»,
 * «С долгом», источник, статус (внутри группы «или», между группами «и»); поиск — имя, телефон по
 * цифрам, номер брони, код места, категория. Гости вымышленные.
 */
const TODAY = '2026-09-29';
const stay = (over: Partial<ChessboardCell>): ChessboardCell => ({
  date: TODAY,
  state: 'OCCUPIED',
  itemId: 'i1',
  itemStatus: 'CONFIRMED',
  confirmationNumber: '20260929-AAAAAA',
  guestLabel: 'Тест Первый',
  guestPhone: '+7 701 111 22 33',
  source: 'PHONE',
  channel: null,
  balanceMinor: '0',
  ...over,
});
const free = (date = TODAY): ChessboardCell => ({ date, state: 'FREE' });
const row = (
  code: string,
  cells: ChessboardCell[],
  over: Partial<ChessboardRow['unit']> = {},
): ChessboardRow => ({
  unit: {
    id: code,
    code,
    kind: 'ROOM',
    accommodationTypeCode: 'ROOM',
    accommodationTypeName: 'Двухместный номер',
    housekeepingStatus: 'INSPECTED',
    ...over,
  },
  cells,
});
const f = (over: Partial<BoardFilters>): BoardFilters => ({ ...NO_FILTERS, ...over });

describe('stayMatches — условия по броням', () => {
  it('без условий подходит любая бронь', () => {
    expect(stayMatches(stay({}), NO_FILTERS, TODAY)).toBe(true);
  });
  it('«Заезд сегодня» — первая ночь сегодня; «Выезд сегодня» — последняя ночь вчера', () => {
    expect(stayMatches(stay({ isArrival: true }), f({ stays: ['arrival'] }), TODAY)).toBe(true);
    expect(stayMatches(stay({ isArrival: false }), f({ stays: ['arrival'] }), TODAY)).toBe(false);
    const lastNight = stay({ date: '2026-09-28', isLastNight: true });
    expect(stayMatches(lastNight, f({ stays: ['departure'] }), TODAY)).toBe(true);
    expect(stayMatches(stay({ isLastNight: true }), f({ stays: ['departure'] }), TODAY)).toBe(
      false,
    );
  });
  it('«Проживают» — заселён; «С долгом» — остаток счёта больше нуля', () => {
    expect(stayMatches(stay({ itemStatus: 'CHECKED_IN' }), f({ stays: ['inhouse'] }), TODAY)).toBe(
      true,
    );
    expect(stayMatches(stay({ balanceMinor: '800000' }), f({ stays: ['debt'] }), TODAY)).toBe(true);
    expect(stayMatches(stay({ balanceMinor: '0' }), f({ stays: ['debt'] }), TODAY)).toBe(false);
  });
  it('внутри группы — «или», между группами — «и»', () => {
    const debtor = stay({ balanceMinor: '100', itemStatus: 'CONFIRMED' });
    expect(stayMatches(debtor, f({ stays: ['inhouse', 'debt'] }), TODAY)).toBe(true);
    expect(stayMatches(debtor, f({ stays: ['debt'], statuses: ['CHECKED_IN'] }), TODAY)).toBe(
      false,
    );
    expect(stayMatches(debtor, f({ stays: ['debt'], statuses: ['CONFIRMED'] }), TODAY)).toBe(true);
  });
  it('источник — канал, а без канала — вид источника', () => {
    const ota = stay({ source: 'OTA', channel: 'Booking.com' });
    expect(stayMatches(ota, f({ sources: ['Booking.com'] }), TODAY)).toBe(true);
    expect(stayMatches(ota, f({ sources: ['PHONE'] }), TODAY)).toBe(false);
    expect(stayMatches(stay({}), f({ sources: ['PHONE'] }), TODAY)).toBe(true);
  });
});

describe('поиск (§10, §41)', () => {
  it('короткий или пустой запрос не ищет; цифры из телефона — от трёх', () => {
    expect(searchNeedle('  ')).toBeNull();
    expect(searchNeedle('Тест')).toEqual({ text: 'тест', digits: '' });
    expect(searchNeedle('701 11')).toEqual({ text: '701 11', digits: '70111' });
    expect(searchNeedle('R0')?.digits).toBe('');
  });
  it('бронь находится по имени, номеру брони и телефону', () => {
    const cell = stay({});
    expect(stayMatchesSearch(cell, searchNeedle('перв')!)).toBe(true);
    expect(stayMatchesSearch(cell, searchNeedle('aaaaaa')!)).toBe(true);
    expect(stayMatchesSearch(cell, searchNeedle('701-111')!)).toBe(true);
    expect(stayMatchesSearch(cell, searchNeedle('Другой')!)).toBe(false);
  });
});

describe('filterRows — какие строки мест видны', () => {
  const rows = [
    row('R01', [stay({ itemStatus: 'CHECKED_IN' }), stay({ date: '2026-09-30' })]),
    row('R02', [free(), free('2026-09-30')]),
    row('M01', [stay({ guestLabel: 'Тест Второй', balanceMinor: '500' }), free('2026-09-30')], {
      kind: 'BED',
      accommodationTypeCode: 'MALE',
      accommodationTypeName: 'Мужской общий номер',
      housekeepingStatus: 'DIRTY',
    }),
    row('R03', [{ date: TODAY, state: 'BLOCKED', blockType: 'MAINTENANCE' }, free('2026-09-30')]),
  ];
  const codes = (list: ChessboardRow[]) => list.map((r) => r.unit.code);

  it('места: категория, тип, состояние на первую дату, уборка', () => {
    expect(codes(filterRows(rows, f({ category: 'MALE' }), TODAY, null))).toEqual(['M01']);
    expect(codes(filterRows(rows, f({ kind: 'ROOM' }), TODAY, null))).toEqual([
      'R01',
      'R02',
      'R03',
    ]);
    expect(codes(filterRows(rows, f({ state: 'FREE' }), TODAY, null))).toEqual(['R02']);
    expect(codes(filterRows(rows, f({ state: 'BLOCKED' }), TODAY, null))).toEqual(['R03']);
    expect(codes(filterRows(rows, f({ state: 'cleaning' }), TODAY, null))).toEqual(['M01']);
  });
  it('брони: строка видна, если на ней есть подходящее проживание', () => {
    expect(codes(filterRows(rows, f({ stays: ['inhouse'] }), TODAY, null))).toEqual(['R01']);
    expect(codes(filterRows(rows, f({ stays: ['debt'] }), TODAY, null))).toEqual(['M01']);
  });
  it('поиск: по коду места, категории и гостю', () => {
    expect(codes(filterRows(rows, NO_FILTERS, TODAY, searchNeedle('r02')))).toEqual(['R02']);
    expect(codes(filterRows(rows, NO_FILTERS, TODAY, searchNeedle('мужской')))).toEqual(['M01']);
    expect(codes(filterRows(rows, NO_FILTERS, TODAY, searchNeedle('второй')))).toEqual(['M01']);
  });
});

describe('варианты и счётчик окошка «Фильтры»', () => {
  const rows = [
    row('R01', [
      stay({ source: 'OTA', channel: 'Booking.com', itemStatus: 'CHECKED_IN' }),
      stay({ source: 'PHONE', itemStatus: 'TENTATIVE' }),
      stay({ source: 'OTA', channel: 'Booking.com' }),
    ]),
  ];
  it('источники и статусы — только те, что есть на сетке, в постоянном порядке', () => {
    expect(sourceOptions(rows)).toEqual([
      { key: 'Booking.com', label: 'Booking.com' },
      { key: 'PHONE', label: 'Телефон' },
    ]);
    expect(statusOptions(rows)).toEqual([
      { key: 'TENTATIVE', label: 'Не подтверждена' },
      { key: 'CONFIRMED', label: 'Подтверждена' },
      { key: 'CHECKED_IN', label: 'Проживает' },
    ]);
  });
  it('на кнопке — число заданных условий (поиск не считается)', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0);
    expect(
      activeFilterCount(
        f({
          category: 'MALE',
          state: 'FREE',
          kind: 'BED',
          stays: ['debt', 'arrival'],
          sources: ['PHONE'],
        }),
      ),
    ).toBe(6);
  });
});
