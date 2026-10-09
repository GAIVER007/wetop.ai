import { describe, expect, it } from 'vitest';
import { buildUnitStats, type UnitBoardTally } from './units';

/** REP3: свод по единицам — те же клетки шахматки, что у сводки; денег нет (Q-251) */
const units: UnitBoardTally[] = [
  {
    code: 'B02',
    categoryCode: 'DORM',
    categoryName: 'Койки',
    kind: 'BED',
    occupiedNights: 0,
    blockedNights: 0,
    arrivals: 0,
  },
  {
    code: 'R01',
    categoryCode: 'ROOM',
    categoryName: 'Номера',
    kind: 'ROOM',
    occupiedNights: 5,
    blockedNights: 2,
    arrivals: 2,
  },
  {
    code: 'B01',
    categoryCode: 'DORM',
    categoryName: 'Койки',
    kind: 'BED',
    occupiedNights: 10,
    blockedNights: 0,
    arrivals: 1,
  },
];

const input = { from: '2026-10-01', to: '2026-10-10', nights: 10, units, unassignedStays: 2 };

describe('buildUnitStats', () => {
  it('строки по каждой единице: загрузка от дней периода без закрытых ночей (ADR-154), порядок — категория, затем код', () => {
    const s = buildUnitStats(input, 'all');
    expect(s.rows.map((r) => r.code)).toEqual(['B01', 'B02', 'R01']);
    const r01 = s.rows.find((r) => r.code === 'R01')!;
    expect(r01).toMatchObject({ occupiedNights: 5, blockedNights: 2, arrivals: 2, percent: 62.5 });
    expect(s.rows.find((r) => r.code === 'B01')!.percent).toBe(100);
    expect(s.rows.find((r) => r.code === 'B02')!.percent).toBe(0);
  });

  it('итог сходится со сводкой по построению: суммы тех же клеток', () => {
    const s = buildUnitStats(input, 'all');
    expect(s.totals).toEqual({
      units: 3,
      unitNights: 30,
      occupiedNights: 15,
      blockedNights: 2,
      percent: 53.6,
      arrivals: 3,
    });
    expect(s.unassignedStays).toBe(2);
    expect(s.nights).toBe(10);
  });

  it('тип фонда режет строки и итог, как в сводке', () => {
    const rooms = buildUnitStats(input, 'rooms');
    expect(rooms.rows.map((r) => r.code)).toEqual(['R01']);
    expect(rooms.totals).toMatchObject({
      units: 1,
      unitNights: 10,
      occupiedNights: 5,
      percent: 62.5,
    });
    const beds = buildUnitStats(input, 'beds');
    expect(beds.rows).toHaveLength(2);
    expect(beds.totals.percent).toBe(50);
  });

  it('пустой фонд и нулевой период не делят на ноль', () => {
    const s = buildUnitStats(
      { from: '2026-10-01', to: '2026-10-01', nights: 0, units: [], unassignedStays: 0 },
      'all',
    );
    expect(s.rows).toEqual([]);
    expect(s.totals.percent).toBe(0);
  });
});
