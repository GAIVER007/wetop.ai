import { describe, expect, it } from 'vitest';
import { followNewDates } from './manual-seat';

describe('ручная посадка следует за новым сроком (Q-164)', () => {
  it('одна ячейка — весь новый срок на ней: сдвиг, продление, сокращение', () => {
    const seat = [{ unitId: 'A', start: '2026-11-01', end: '2026-11-03' }];
    expect(followNewDates(seat, '2026-11-02', '2026-11-05')).toEqual([
      { unitId: 'A', start: '2026-11-02', end: '2026-11-05' },
    ]);
    expect(followNewDates(seat, '2026-11-01', '2026-11-02')).toEqual([
      { unitId: 'A', start: '2026-11-01', end: '2026-11-02' },
    ]);
    // срок уехал целиком — ячейка та же
    expect(followNewDates(seat, '2026-12-10', '2026-12-12')).toEqual([
      { unitId: 'A', start: '2026-12-10', end: '2026-12-12' },
    ]);
  });

  it('переезд внутри срока: края подрезаются под новый срок', () => {
    const seat = [
      { unitId: 'B', start: '2026-11-03', end: '2026-11-06' },
      { unitId: 'A', start: '2026-11-01', end: '2026-11-03' },
    ];
    expect(followNewDates(seat, '2026-11-02', '2026-11-05')).toEqual([
      { unitId: 'A', start: '2026-11-02', end: '2026-11-03' },
      { unitId: 'B', start: '2026-11-03', end: '2026-11-05' },
    ]);
  });

  it('переезд внутри срока, срок стал длиннее: первая ячейка — назад, последняя — вперёд', () => {
    const seat = [
      { unitId: 'A', start: '2026-11-02', end: '2026-11-03' },
      { unitId: 'B', start: '2026-11-03', end: '2026-11-04' },
    ];
    expect(followNewDates(seat, '2026-11-01', '2026-11-06')).toEqual([
      { unitId: 'A', start: '2026-11-01', end: '2026-11-03' },
      { unitId: 'B', start: '2026-11-03', end: '2026-11-06' },
    ]);
  });

  it('следовать не за чем — null: посадки нет, срок пустой, несколько ячеек и срок уехал целиком', () => {
    expect(followNewDates([], '2026-11-01', '2026-11-02')).toBeNull();
    expect(
      followNewDates([{ unitId: 'A', start: '2026-11-01', end: '2026-11-02' }], '2026-11-02', '2026-11-02'),
    ).toBeNull();
    expect(
      followNewDates(
        [
          { unitId: 'A', start: '2026-11-01', end: '2026-11-02' },
          { unitId: 'B', start: '2026-11-02', end: '2026-11-03' },
        ],
        '2026-12-01',
        '2026-12-03',
      ),
    ).toBeNull();
  });
});
