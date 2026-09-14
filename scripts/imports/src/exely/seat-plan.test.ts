/**
 * Рассадка пачки импорта из Exely. Случаи — из сквозной проверки 14.09.2026 (cli-system-trace.ts): 13 проживаний
 * стояли на шахматке PMS не на тех койках, что в Exely, потому что Exely менял гостей местами и цепочками.
 */
import { describe, expect, it } from 'vitest';
import { planSeats, type SeatRequest } from './seat-plan';

const DORM = 'type-dorm';
const SINGLE = 'type-single';
const stay = (
  itemId: string,
  desiredUnitId: string,
  current: string | null,
  dates: [string, string] = ['2026-09-14', '2026-09-16'],
  typeId = DORM,
): SeatRequest => ({
  itemId,
  typeId,
  desiredUnitId,
  start: dates[0],
  end: dates[1],
  current: current ? { unitId: current, typeId } : null,
});
const seats = (requests: SeatRequest[], occupied = [] as Parameters<typeof planSeats>[1]) =>
  Object.fromEntries(
    planSeats(requests, occupied).map((d) => [d.itemId, d.kind === 'displaced' ? 'displaced' : `${d.kind} ${d.unitId}`]),
  );

describe('рассадка пачки импорта из Exely', () => {
  it('обмен: Exely поменял двух гостей местами — оба садятся на места из Exely', () => {
    // 14.09.2026: 20260914-…1261629766 в Exely 46, в PMS 43; 20260912-…1262510492 в Exely 43, в PMS 46
    expect(seats([stay('A', '46', '43'), stay('B', '43', '46')])).toEqual({
      A: 'desired 46',
      B: 'desired 43',
    });
  });

  it('цепочка из трёх: каждый садится на место следующего, в каком бы порядке брони ни пришли из Exely', () => {
    // 20260914-…1263693976: Exely 6, PMS 8; …1263724306: Exely 8, PMS 35; …1263723603: Exely 35, PMS 28
    const chain = [stay('C', '6', '8'), stay('D', '8', '35'), stay('E', '35', '28')];
    for (const order of [chain, [...chain].reverse()])
      expect(seats(order)).toEqual({ C: 'desired 6', D: 'desired 8', E: 'desired 35' });
  });

  it('двойная продажа койки: место остаётся за тем, кто на ней уже стоит, в каком бы порядке ни пришли брони', () => {
    const incumbent = stay('A', '6', '6');
    const newcomer = stay('N', '6', '9');
    for (const order of [
      [incumbent, newcomer],
      [newcomer, incumbent],
    ])
      expect(seats(order)).toEqual({ A: 'desired 6', N: 'kept 9' });
  });

  it('место из Exely занято чужой бронью: остаётся на прежней ячейке своей категории, если она свободна', () => {
    const other = { unitId: '6', itemId: 'X', start: '2026-09-13', end: '2026-09-15' };
    expect(seats([stay('A', '6', '9')], [other])).toEqual({ A: 'kept 9' });
    const decision = planSeats([stay('A', '6', '9')], [other])[0]!;
    expect(decision.kind === 'kept' && decision.conflict).toEqual(other);
  });

  it('прежняя ячейка чужой категории не сохраняется — рассадка отдельным проходом (13.09.2026, койка 35)', () => {
    const other = { unitId: '6', itemId: 'X', start: '2026-09-13', end: '2026-09-15' };
    const request = { ...stay('A', '6', null), current: { unitId: '41', typeId: SINGLE } };
    expect(seats([request], [other])).toEqual({ A: 'displaced' });
  });

  it('даты сдвинулись на чужую бронь в той же ячейке — проживание вытесняется, а не остаётся поверх', () => {
    const other = { unitId: '6', itemId: 'X', start: '2026-09-15', end: '2026-09-17' };
    expect(seats([stay('A', '6', '6', ['2026-09-14', '2026-09-16'])], [other])).toEqual({ A: 'displaced' });
  });

  it('первый импорт без мест: конфликт с соседом по пачке — вытеснен, ячейку найдёт отдельный проход', () => {
    expect(seats([stay('T1', '9011', null), stay('T5', '9011', null)])).toEqual({
      T1: 'desired 9011',
      T5: 'displaced',
    });
  });

  it('повтор импорта ничего не пересаживает: все на своих местах, вытесненный раньше — на своей пересадке', () => {
    expect(seats([stay('T1', '9010', '9010'), stay('T3', '9011', '9011'), stay('T5', '9011', '9012')])).toEqual({
      T1: 'desired 9010',
      T3: 'desired 9011',
      T5: 'kept 9012',
    });
  });

  it('не хуже прежнего: место из Exely занято в прошлые ночи — сосед по обмену не выгоняет проживание с его койки', () => {
    // репетиция 14.09.2026: …1262510492 (12 → 15) в Exely на 43, но 43 в ночь 12.09 занята выехавшей …1263600382;
    // …1261629766 (с 14.09) в Exely на 46, где стоит …1262510492. Пересадка по Exely оставила бы …1262510492 без койки
    const past = { unitId: '43', itemId: 'OUT', start: '2026-09-12', end: '2026-09-13' };
    const stayer = stay('D', '43', '46', ['2026-09-12', '2026-09-15']);
    const mover = stay('M', '46', '43', ['2026-09-14', '2026-09-16']);
    for (const order of [
      [stayer, mover],
      [mover, stayer],
    ])
      expect(seats(order, [past])).toEqual({ D: 'kept 46', M: 'kept 43' });
  });

  it('цепочка упирается в чужую бронь — остальные звенья остаются на своих койках, никто не остаётся без места', () => {
    const blocker = { unitId: '22', itemId: 'X', start: '2026-09-11', end: '2026-09-13' };
    expect(
      seats(
        [
          stay('P', '21', '6', ['2026-09-12', '2026-09-17']),
          stay('Q', '22', '21', ['2026-09-12', '2026-09-15']),
          stay('R', '6', '8', ['2026-09-14', '2026-09-16']),
        ],
        [blocker],
      ),
    ).toEqual({ P: 'kept 6', Q: 'kept 21', R: 'kept 8' });
  });

  it('в разные ночи одна ячейка не конфликтует', () => {
    expect(
      seats([stay('A', '6', '8', ['2026-09-14', '2026-09-15']), stay('B', '6', '6', ['2026-09-15', '2026-09-17'])]),
    ).toEqual({ A: 'desired 6', B: 'desired 6' });
  });
});
