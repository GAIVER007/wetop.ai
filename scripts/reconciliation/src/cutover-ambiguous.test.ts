import { describe, expect, it } from 'vitest';
import { composition, groupAmbiguous, money, type AmbiguousRow } from './cutover-ambiguous';

const row = (
  o: Partial<AmbiguousRow> & Pick<AmbiguousRow, 'confirmationNumber'>,
): AmbiguousRow => ({
  channel: 'Trip.com Group',
  stays: [{ category: 'Общая женская комната', arrival: '2026-10-07', departure: '2026-10-11' }],
  units: ['78'],
  totalAmountMinor: 2_282_880n,
  paidMinor: 0n,
  ...o,
});

describe('группы неразличимых броней переезда', () => {
  it('одиночная бронь в список не попадает', () => {
    expect(groupAmbiguous([row({ confirmationNumber: 'A' })])).toEqual([]);
  });

  it('две брони одного канала с одинаковым составом — группа', () => {
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A' }),
      row({ confirmationNumber: 'B', units: ['59'] }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.rows.map((r) => r.confirmationNumber)).toEqual(['A', 'B']);
    expect(g[0]!.channel).toBe('Trip.com Group');
    expect(g[0]!.composition).toBe('Общая женская комната: 2026-10-07 → 2026-10-11');
  });

  it('разные каналы с одинаковым составом не смешиваются', () => {
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A' }),
      row({ confirmationNumber: 'B', channel: 'booking.com' }),
    ]);
    expect(g).toEqual([]);
  });

  it('порядок проживаний внутри брони не важен', () => {
    const two = [
      { category: 'Двухместная комната', arrival: '2026-09-18', departure: '2026-09-19' },
      { category: 'Общая женская комната', arrival: '2026-09-18', departure: '2026-09-19' },
    ];
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A', stays: two }),
      row({ confirmationNumber: 'B', stays: [...two].reverse() }),
    ]);
    expect(g).toHaveLength(1);
  });

  it('суммы разные — группу можно разобрать по сумме', () => {
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A', totalAmountMinor: 1_202_850n }),
      row({ confirmationNumber: 'B', totalAmountMinor: 1_400_000n }),
    ]);
    expect(g[0]!.byAmount).toBe(true);
  });

  it('суммы совпадают — по сумме не разобрать, и группа может быть больше пары', () => {
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A' }),
      row({ confirmationNumber: 'B' }),
      row({ confirmationNumber: 'C' }),
    ]);
    expect(g[0]!.byAmount).toBe(false);
    expect(g[0]!.rows).toHaveLength(3);
  });

  it('группы покрупнее идут первыми', () => {
    const other = {
      category: 'Двухместная комната',
      arrival: '2026-09-17',
      departure: '2026-09-18',
    };
    const g = groupAmbiguous([
      row({ confirmationNumber: 'A', stays: [other] }),
      row({ confirmationNumber: 'B', stays: [other] }),
      row({ confirmationNumber: 'C' }),
      row({ confirmationNumber: 'D' }),
      row({ confirmationNumber: 'E' }),
    ]);
    expect(g.map((x) => x.rows.length)).toEqual([3, 2]);
  });

  it('состав печатается устойчиво и читаемо', () => {
    expect(
      composition([
        { category: 'Двухместная комната', arrival: '2026-09-17', departure: '2026-09-18' },
      ]),
    ).toBe('Двухместная комната: 2026-09-17 → 2026-09-18');
  });

  it('деньги — тиыны с разрядами', () => {
    expect(money(2_282_880n)).toBe('22 828,80 ₸');
  });
});
