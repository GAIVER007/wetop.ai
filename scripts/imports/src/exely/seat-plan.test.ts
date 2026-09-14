/**
 * Рассадка пачки импорта из Exely. Случаи — из сквозной проверки 14.09.2026 (cli-system-trace.ts): 13 проживаний
 * стояли на шахматке PMS не на тех койках, что в Exely, потому что Exely менял гостей местами и цепочками,
 * а цепочки упирались в переезды внутри срока (ADR-044, Q-120).
 */
import { describe, expect, it } from 'vitest';
import { planSeats, type SeatDecision, type SeatOccupancy, type SeatRequest } from './seat-plan';

const DORM = 'type-dorm';
const SINGLE = 'type-single';
/** До всех ночей в примерах: переезд внутри срока ещё не случился, правило ADR-044 не срабатывает */
const BEFORE = '2026-09-10';
const stay = (
  itemId: string,
  desiredUnitId: string,
  current: string | Array<[string, string, string]> | null,
  dates: [string, string] = ['2026-09-14', '2026-09-16'],
  typeId = DORM,
): SeatRequest => ({
  itemId,
  typeId,
  desiredUnitId,
  start: dates[0],
  end: dates[1],
  current:
    current === null
      ? []
      : typeof current === 'string'
        ? [{ unitId: current, typeId, start: dates[0], end: dates[1] }]
        : current.map(([unitId, start, end]) => ({ unitId, typeId, start, end })),
});
const fmt = (d: SeatDecision) => {
  if (d.kind === 'displaced') return d.exelyFrom ? `displaced, Exely с ${d.exelyFrom}` : 'displaced';
  const segments =
    d.segments.length === 1
      ? d.segments[0]!.unitId
      : d.segments.map((s) => `${s.unitId}[${s.start.slice(8)}–${s.end.slice(8)})`).join(' ');
  return `${d.kind} ${segments}`;
};
const seats = (requests: SeatRequest[], occupied: SeatOccupancy[] = [], today = BEFORE) =>
  Object.fromEntries(planSeats(requests, occupied, today).map((d) => [d.itemId, fmt(d)]));

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
    const decision = planSeats([stay('A', '6', '9')], [other], BEFORE)[0]!;
    expect(decision.kind === 'kept' && decision.conflict).toEqual(other);
  });

  it('прежняя ячейка чужой категории не сохраняется — рассадка отдельным проходом (13.09.2026, койка 35)', () => {
    const other = { unitId: '6', itemId: 'X', start: '2026-09-13', end: '2026-09-15' };
    const request: SeatRequest = {
      ...stay('A', '6', null),
      current: [{ unitId: '41', typeId: SINGLE, start: '2026-09-14', end: '2026-09-16' }],
    };
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

  it('не хуже прежнего: сосед по обмену не выгоняет проживание с его койки; будущий переезд не придумывается', () => {
    // …1262510492 (12 → 15) в Exely на 43, но 43 в ночь 12.09 занята …1263600382; …1261629766 (с 14.09) в Exely на 46.
    // Сегодня 12.09: место из Exely освободится только завтра — переезда ещё не было, оба на своих койках
    const past = { unitId: '43', itemId: 'OUT', start: '2026-09-12', end: '2026-09-13' };
    const stayer = stay('D', '43', '46', ['2026-09-12', '2026-09-15']);
    const mover = stay('M', '46', '43', ['2026-09-14', '2026-09-16']);
    for (const order of [
      [stayer, mover],
      [mover, stayer],
    ])
      expect(seats(order, [past], '2026-09-12')).toEqual({ D: 'kept 46', M: 'kept 43' });
  });

  it('цепочка упирается в чужую бронь в будущем — звенья остаются на своих койках, никто не остаётся без места', () => {
    const blocker = { unitId: '22', itemId: 'X', start: '2026-09-11', end: '2026-09-13' };
    expect(
      seats(
        [
          stay('P', '21', '6', ['2026-09-12', '2026-09-17']),
          stay('Q', '22', '21', ['2026-09-12', '2026-09-15']),
          stay('R', '6', '8', ['2026-09-14', '2026-09-16']),
        ],
        [blocker],
        '2026-09-12',
      ),
    ).toEqual({ P: 'kept 6', Q: 'kept 21', R: 'kept 8' });
  });

  it('в разные ночи одна ячейка не конфликтует', () => {
    expect(
      seats([stay('A', '6', '8', ['2026-09-14', '2026-09-15']), stay('B', '6', '6', ['2026-09-15', '2026-09-17'])]),
    ).toEqual({ A: 'desired 6', B: 'desired 6' });
  });
});

describe('переезд внутри срока (ADR-044, Q-120)', () => {
  const TODAY = '2026-09-14';
  const past = { unitId: '43', itemId: 'OUT', start: '2026-09-12', end: '2026-09-13' };

  it('переезд уже был: до ночи, когда место из Exely освободилось, — своя койка, дальше место из Exely', () => {
    const stayer = stay('D', '43', '46', ['2026-09-12', '2026-09-15']);
    const mover = stay('M', '46', '43', ['2026-09-14', '2026-09-16']);
    for (const order of [
      [stayer, mover],
      [mover, stayer],
    ])
      expect(seats(order, [past], TODAY)).toEqual({
        D: 'moved 46[12–13) 43[13–15)',
        M: 'desired 46',
      });
  });

  it('цепочка из живых данных 14.09 сходится переездами', () => {
    // …1262559618 (12 → 15): Exely 22, занята …1263193668 до 13.09; …1263463664 (12 → 17): Exely 21; …1263693976: Exely 6
    const blocker = { unitId: '22', itemId: 'X', start: '2026-09-11', end: '2026-09-13' };
    const chain = [
      stay('P', '21', '6', ['2026-09-12', '2026-09-17']),
      stay('Q', '22', '21', ['2026-09-12', '2026-09-15']),
      stay('R', '6', '8', ['2026-09-14', '2026-09-16']),
    ];
    for (const order of [chain, [...chain].reverse()])
      expect(seats(order, [blocker], TODAY)).toEqual({
        P: 'moved 6[12–13) 21[13–17)',
        Q: 'moved 21[12–13) 22[13–15)',
        R: 'desired 6',
      });
  });

  it('место из Exely освобождают двое соседей в разные ночи, и оба ждут койку переезжающего — группа меняется разом', () => {
    // живые данные 14.09: …1262510492 (12 → 15) в Exely 43; на 43 стоят …1262712627 (13 → 14) и …1261629766 (14 → 15),
    // оба в Exely на 46, где стоит …1262510492
    const stayer = stay('D', '43', '46', ['2026-09-12', '2026-09-15']);
    const first = stay('A', '46', '43', ['2026-09-13', '2026-09-14']);
    const second = stay('B', '46', '43', ['2026-09-14', '2026-09-15']);
    for (const order of [
      [stayer, first, second],
      [second, first, stayer],
    ])
      expect(seats(order, [past], TODAY)).toEqual({
        D: 'moved 46[12–13) 43[13–15)',
        A: 'desired 46',
        B: 'desired 46',
      });
  });

  it('длинная цепочка из живых данных: переезды по ночам сходятся в несколько кругов', () => {
    // …1263022076 (11 → 14) Exely 30, занята …1263435700 до 13.09; …1263664273 (13 → 23) Exely 28; …1263550450 (14 → 24)
    // Exely 30; …1263658023 (13 → 15) Exely 24; …1263723603 (14 → 16) Exely 35, стоит на 28
    const blocker = { unitId: '30', itemId: 'X', start: '2026-09-11', end: '2026-09-13' };
    const chain = [
      stay('K', '30', '28', ['2026-09-11', '2026-09-14']),
      stay('L', '28', '30', ['2026-09-13', '2026-09-23']),
      stay('N', '30', '24', ['2026-09-14', '2026-09-24']),
      stay('O', '24', '22', ['2026-09-13', '2026-09-15']),
    ];
    for (const order of [chain, [...chain].reverse()])
      expect(seats(order, [blocker], TODAY)).toEqual({
        K: 'moved 28[11–13) 30[13–14)',
        L: 'desired 28',
        N: 'desired 30',
        O: 'desired 24',
      });
  });

  it('девять броней живой цепочки 14.09 (койки 21, 22, 24, 28, 30, 6, 8, 5) сходятся одной группой', () => {
    // цели одних звеньев зависят от ночей до переезда других звеньев той же группы
    const foreign = [
      { unitId: '22', itemId: 'X', start: '2026-09-11', end: '2026-09-13' },
      { unitId: '30', itemId: 'Y', start: '2026-09-11', end: '2026-09-13' },
    ];
    const chain = [
      stay('Q', '22', '21', ['2026-09-12', '2026-09-15']),
      stay('P', '21', '6', ['2026-09-12', '2026-09-17']),
      stay('S', '6', '8', ['2026-09-14', '2026-09-16']),
      stay('T', '8', '28', ['2026-09-14', '2026-09-15']),
      stay('W', '8', '5', ['2026-09-15', '2026-09-17']),
      stay('L', '28', '30', ['2026-09-13', '2026-09-23']),
      stay('K', '30', '28', ['2026-09-11', '2026-09-14']),
      stay('N', '30', '24', ['2026-09-14', '2026-09-24']),
      stay('O', '24', '22', ['2026-09-13', '2026-09-15']),
    ];
    for (const order of [chain, [...chain].reverse()])
      expect(seats(order, foreign, TODAY)).toEqual({
        Q: 'moved 21[12–13) 22[13–15)',
        P: 'moved 6[12–13) 21[13–17)',
        S: 'desired 6',
        T: 'desired 8',
        W: 'desired 8',
        L: 'desired 28',
        K: 'moved 28[11–13) 30[13–14)',
        N: 'desired 30',
        O: 'desired 24',
      });
  });

  it('повтор импорта после переезда ничего не меняет', () => {
    const split = stay('D', '43', [
      ['46', '2026-09-12', '2026-09-13'],
      ['43', '2026-09-13', '2026-09-15'],
    ], ['2026-09-12', '2026-09-15']);
    expect(seats([split], [past], '2026-09-15')).toEqual({ D: 'moved 46[12–13) 43[13–15)' });
  });

  it('место из Exely освободилось на весь срок — переезд снимается, весь срок на месте из Exely', () => {
    const split = stay('D', '43', [
      ['46', '2026-09-12', '2026-09-13'],
      ['43', '2026-09-13', '2026-09-15'],
    ], ['2026-09-12', '2026-09-15']);
    expect(seats([split], [], TODAY)).toEqual({ D: 'desired 43' });
  });

  it('место из Exely занято в последние ночи срока — с него посреди срока не уезжают: своя койка', () => {
    const later = { unitId: '43', itemId: 'LATE', start: '2026-09-14', end: '2026-09-15' };
    expect(seats([stay('D', '43', '46', ['2026-09-12', '2026-09-15'])], [later], '2026-09-16')).toEqual({
      D: 'kept 46',
    });
  });

  it('без своей ячейки, переезд уже был — отдельному проходу подсказка: место из Exely свободно с 13.09', () => {
    expect(seats([stay('R', '43', null, ['2026-09-12', '2026-09-15'])], [past], TODAY)).toEqual({
      R: 'displaced, Exely с 2026-09-13',
    });
  });
});
