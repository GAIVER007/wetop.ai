import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildChessboard, dateRange, daySpan, type ChessboardInput } from './index';

const BUILD_MODULE = fileURLToPath(new URL('./build.ts', import.meta.url));

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

  // Аудит 26.09.2026, В-6: после 9999-12-31 строка даты становится «+010000-01», а она по строкам меньше
  // «9999-12-31» — цикл не кончался, и один запрос шахматки вешал весь API. Зависание синхронное, vitest его
  // не прервёт, поэтому вызов идёт в отдельном процессе с таймаутом.
  it('ends on the last representable date instead of looping forever', () => {
    const run = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        `import('${BUILD_MODULE}').then((m) => console.log(JSON.stringify(m.dateRange('9999-12-30', '9999-12-31'))))`,
      ],
      { encoding: 'utf8', timeout: 15_000 },
    );
    expect(run.signal, 'dateRange завис и был убит по таймауту').toBeNull();
    expect(run.stdout.trim()).toBe('["9999-12-30","9999-12-31"]');
  });
});

describe('daySpan', () => {
  it('counts inclusive days without building the list', () => {
    expect(daySpan('2026-09-10', '2026-09-13')).toBe(4);
    expect(daySpan('2026-09-10', '2026-09-10')).toBe(1);
    expect(daySpan('2026-02-27', '2026-03-01')).toBe(3);
    expect(daySpan('1000-01-01', '9999-12-31')).toBe(3_287_182);
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

/**
 * Срез 7.1: на клетке видно то, ради чего администратор сейчас открывает карточку — из какого канала
 * бронь, сколько по ней не заплачено и убрана ли ячейка. Всё три факта уже есть в базе; шахматка их
 * только передаёт. Документ ментора 14.09 берёт это из Exely: бейдж канала и красная плашка суммы на
 * полосе брони, значок уборки у номера.
 */
describe('buildChessboard: канал, долг и уборка', () => {
  const withExtras: ChessboardInput = {
    ...input,
    units: input.units.map((u, i) =>
      i === 1 ? { ...u, housekeepingStatus: 'DIRTY' as const } : u,
    ),
    allocations: input.allocations.map((a) =>
      a.itemId === 'i2'
        ? { ...a, source: 'OTA' as const, channel: 'Booking.com', balanceMinor: '1250000' }
        : a,
    ),
  };

  it('канал и остаток к оплате едут на каждую клетку проживания', () => {
    const b = buildChessboard(withExtras);
    const row = b.rows.find((r) => r.unit.code === '9010')!;
    const busy = row.cells.filter((c) => c.state === 'OCCUPIED');
    expect(busy).toHaveLength(3); // ночи 11, 12 и 13 сентября — проживание 11→14
    for (const cell of busy)
      expect(cell).toMatchObject({ channel: 'Booking.com', balanceMinor: '1250000' });
  });

  it('статус уборки — свойство ячейки, а не клетки', () => {
    const b = buildChessboard(withExtras);
    expect(b.rows.find((r) => r.unit.code === '9010')!.unit.housekeepingStatus).toBe('DIRTY');
    // у ячейки без статуса поля просто нет — экран покажет строку без бейджа
    expect(b.rows.find((r) => r.unit.code === '9001')!.unit.housekeepingStatus).toBeUndefined();
  });

  it('без этих полей шахматка работает как раньше: клетка их не выдумывает', () => {
    const b = buildChessboard(input);
    const cell = b.rows.find((r) => r.unit.code === '9010')!.cells[1]!;
    expect(cell.state).toBe('OCCUPIED');
    expect(cell.channel).toBeUndefined();
    expect(cell.balanceMinor).toBeUndefined();
  });
});

// Аудит 26.09, С-37: блокировка и проживание обходились день за днём по всей длине, даже за пределами доски. Блокировка
// до 9999 года — 2,9 млн шагов на каждую отрисовку шахматки и Главной, секунды занятого процесса.
describe('шахматка и далёкие даты', () => {
  it('блокировка до 9999 года красит только окно доски и не обходит тысячелетия', () => {
    const started = performance.now();
    const b = buildChessboard({
      ...input,
      blocks: [
        { unitId: 'u3', dateFrom: '2026-09-11', dateTo: '9999-12-31', type: 'MAINTENANCE', reason: null },
      ],
    });
    const ms = performance.now() - started;
    expect(b.rows.find((r) => r.unit.code === '9011')!.cells.map((c) => c.state)).toEqual([
      'FREE',
      'BLOCKED',
      'BLOCKED',
      'BLOCKED',
    ]);
    expect(ms, `шахматка строилась ${Math.round(ms)} мс`).toBeLessThan(500);
  });

  it('проживание, начатое до доски, красится с первого дня доски и не помечается заездом', () => {
    const b = buildChessboard(input);
    const u1 = b.rows.find((r) => r.unit.code === '9001')!.cells;
    expect(u1[0]).toMatchObject({ state: 'OCCUPIED', isArrival: false, isLastNight: true });
  });
});
