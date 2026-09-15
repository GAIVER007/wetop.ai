import { describe, expect, it } from 'vitest';
import { buildChessboard, dateRange, type ChessboardInput } from './index';

/** Вымышленный фонд: 3 ячейки, 2 назначения, 1 блокировка. Полуинтервалы [start, end). */
const input: ChessboardInput = {
  from: '2026-09-10',
  to: '2026-09-13',
  units: [
    {
      id: 'u1',
      code: '9001',
      kind: 'ROOM',
      accommodationTypeCode: 'exely-900001',
      accommodationTypeName: 'Тестовая одиночная',
    },
    {
      id: 'u2',
      code: '9010',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Тестовый dorm',
    },
    {
      id: 'u3',
      code: '9011',
      kind: 'BED',
      accommodationTypeCode: 'exely-900003',
      accommodationTypeName: 'Тестовый dorm',
    },
  ],
  allocations: [
    {
      unitId: 'u1',
      startDate: '2026-09-09',
      endDate: '2026-09-11',
      itemId: 'i1',
      itemStatus: 'CHECKED_IN',
      confirmationNumber: 'A',
      guestLabel: 'Гость Тест-1',
    },
    {
      unitId: 'u2',
      startDate: '2026-09-11',
      endDate: '2026-09-14',
      itemId: 'i2',
      itemStatus: 'CONFIRMED',
      confirmationNumber: 'B',
      guestLabel: 'Гость Тест-2',
    },
  ],
  blocks: [
    {
      unitId: 'u3',
      dateFrom: '2026-09-12',
      dateTo: '2026-09-13',
      type: 'MAINTENANCE',
      reason: 'ремонт',
    },
  ],
};

describe('dateRange', () => {
  it('lists inclusive dates', () => {
    expect(dateRange('2026-09-10', '2026-09-13')).toEqual([
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
  });
});

describe('buildChessboard', () => {
  it('produces one row per unit and one cell per date with FREE / OCCUPIED / BLOCKED', () => {
    const b = buildChessboard(input);
    expect(b.dates).toHaveLength(4);
    expect(b.rows).toHaveLength(3);
    const states = (code: string) =>
      b.rows.find((r) => r.unit.code === code)!.cells.map((c) => c.state);
    // u1: занята 09–10 (выезд 11 не занимает ночь 11)
    expect(states('9001')).toEqual(['OCCUPIED', 'FREE', 'FREE', 'FREE']);
    // u2: заезд 11 → ночи 11,12,13
    expect(states('9010')).toEqual(['FREE', 'OCCUPIED', 'OCCUPIED', 'OCCUPIED']);
    // u3: блок [12, 13) → только 12
    expect(states('9011')).toEqual(['FREE', 'FREE', 'BLOCKED', 'FREE']);
  });
  it('cells carry the stay reference and status; blocked cells carry the block type', () => {
    const b = buildChessboard(input);
    const c = b.rows.find((r) => r.unit.code === '9010')!.cells[1]!;
    expect(c).toMatchObject({
      state: 'OCCUPIED',
      itemId: 'i2',
      itemStatus: 'CONFIRMED',
      confirmationNumber: 'B',
      guestLabel: 'Гость Тест-2',
      isArrival: true,
    });
    expect(b.rows.find((r) => r.unit.code === '9011')!.cells[2]).toMatchObject({
      state: 'BLOCKED',
      blockType: 'MAINTENANCE',
    });
  });
  it('summarises occupied / free / blocked per date and per category', () => {
    const b = buildChessboard(input);
    expect(b.summary['2026-09-11']).toEqual({ occupied: 1, blocked: 0, free: 2 });
    expect(b.summary['2026-09-12']).toEqual({ occupied: 1, blocked: 1, free: 1 });
    expect(b.byCategory['2026-09-12']!['exely-900003']).toEqual({
      units: 2,
      occupied: 1,
      blocked: 1,
      free: 0,
    });
  });
  it('refuses overlapping allocations on one unit (overbooking is a data error, not a display choice)', () => {
    const bad = {
      ...input,
      allocations: [
        ...input.allocations,
        {
          unitId: 'u1',
          startDate: '2026-09-10',
          endDate: '2026-09-12',
          itemId: 'i9',
          itemStatus: 'CONFIRMED' as const,
          confirmationNumber: 'Z',
          guestLabel: '',
        },
      ],
    };
    expect(() => buildChessboard(bad)).toThrow(/9001.*2026-09-10/);
  });
  it('refuses a range longer than 62 days', () => {
    expect(() => buildChessboard({ ...input, to: '2026-12-31' })).toThrow(/62/);
  });
});

describe('buildChessboard: проживания без ячейки (паритет со строкой «Без номера» в Exely)', () => {
  it('без входного списка на доске пустой список — не undefined', () => {
    expect(buildChessboard(input).unassigned).toEqual([]);
  });
  it('пропускает проживания без ячейки на доску, отсортировав по категории, затем по заезду', () => {
    const b = buildChessboard({
      ...input,
      unassigned: [
        {
          confirmationNumber: 'U-3',
          categoryCode: 'exely-900003',
          categoryName: 'Тестовый dorm',
          arrivalDate: '2026-09-12',
          departureDate: '2026-09-13',
          status: 'CONFIRMED',
        },
        {
          confirmationNumber: 'U-1',
          categoryCode: 'exely-900001',
          categoryName: 'Тестовая одиночная',
          arrivalDate: '2026-09-11',
          departureDate: '2026-09-12',
          status: 'TENTATIVE',
        },
        {
          confirmationNumber: 'U-2',
          categoryCode: 'exely-900003',
          categoryName: 'Тестовый dorm',
          arrivalDate: '2026-09-10',
          departureDate: '2026-09-11',
          status: 'CONFIRMED',
        },
      ],
    });
    expect(b.unassigned.map((u) => u.confirmationNumber)).toEqual(['U-1', 'U-2', 'U-3']);
    expect(b.unassigned[0]).toEqual({
      confirmationNumber: 'U-1',
      categoryCode: 'exely-900001',
      categoryName: 'Тестовая одиночная',
      arrivalDate: '2026-09-11',
      departureDate: '2026-09-12',
      status: 'TENTATIVE',
    });
    // сетка и сводка от броней без ячейки не меняются: ячейки они не занимают
    expect(b.summary['2026-09-11']).toEqual({ occupied: 1, blocked: 0, free: 2 });
  });
});

describe('buildChessboard: срез 7.1 — канал, остаток счёта, уборка и заказчик на доске (DESIGN.md §8, §9)', () => {
  const rich: ChessboardInput = {
    ...input,
    units: input.units.map((u, i) => ({ ...u, housekeeping: (['DIRTY', 'CLEAN', 'INSPECTED'] as const)[i]! })),
    allocations: [
      { ...input.allocations[0]!, source: 'OTA', channel: 'Booking.com', balanceMinor: '1600000' },
      { ...input.allocations[1]!, source: 'DESK', channel: null, balanceMinor: '0' },
    ],
    unassigned: [
      {
        confirmationNumber: 'U-9',
        categoryCode: 'exely-900003',
        categoryName: 'Тестовый dorm',
        arrivalDate: '2026-09-12',
        departureDate: '2026-09-13',
        status: 'CONFIRMED',
        guestLabel: 'Гость Тест-без-ячейки',
        source: 'OTA',
        channel: 'Trip.com',
        balanceMinor: '400000',
      },
    ],
  };
  it('клетка проживания несёт канал, источник и остаток к оплате — плашка и бейдж на полосе', () => {
    const b = buildChessboard(rich);
    const cell = b.rows[0]!.cells[0]!; // u1, 2026-09-10 — проживание A
    expect(cell).toMatchObject({ source: 'OTA', channel: 'Booking.com', balanceMinor: '1600000' });
    const desk = b.rows[1]!.cells[1]!; // u2, 2026-09-11 — проживание B
    expect(desk).toMatchObject({ source: 'DESK', channel: null, balanceMinor: '0' });
  });
  it('строка ячейки несёт статус уборки — бейдж словом и фильтр «Уборка» по настоящему статусу', () => {
    const b = buildChessboard(rich);
    expect(b.rows.map((r) => r.unit.housekeeping)).toEqual(['DIRTY', 'CLEAN', 'INSPECTED']);
  });
  it('строка «Без ячейки» несёт заказчика, канал и остаток', () => {
    const b = buildChessboard(rich);
    expect(b.unassigned[0]).toMatchObject({
      guestLabel: 'Гость Тест-без-ячейки',
      channel: 'Trip.com',
      balanceMinor: '400000',
    });
  });
  it('без новых полей на входе клетка их не выдумывает', () => {
    const b = buildChessboard(input);
    const cell = b.rows[0]!.cells[0]!;
    expect('channel' in cell).toBe(false);
    expect('balanceMinor' in cell).toBe(false);
  });
});
