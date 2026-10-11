import { describe, expect, it } from 'vitest';
import { donutSlices } from './donut';

describe('доли для кольца (RPT2.2c-3, DESIGN.md §8.2 DonutShare)', () => {
  it('доли в промилле целыми числами и в сумме ровно 1000, деньги не проходят через float', () => {
    const s = donutSlices(
      [
        { label: 'A', valueMinor: '9007199254740993' },
        { label: 'B', valueMinor: '9007199254740993' },
        { label: 'C', valueMinor: '9007199254740993' },
      ],
      5,
    );
    expect(s.map((x) => x.permille)).toEqual([334, 333, 333]);
    expect(s.reduce((n, x) => n + x.permille, 0)).toBe(1000);
  });

  it('по убыванию, после лимита хвост сворачивается в «Прочие»', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7'].map((v) => ({
      label: `К${v}`,
      valueMinor: `${Number(v) * 100}`,
    }));
    const s = donutSlices(items, 4);
    expect(s.map((x) => x.label)).toEqual(['К7', 'К6', 'К5', 'Прочие']);
    expect(s[3]).toMatchObject({ valueMinor: '1000', other: true });
    expect(s.reduce((n, x) => n + x.permille, 0)).toBe(1000);
  });

  it('нулевые и отрицательные значения отбрасываются; пусто и ноль дают пустой список', () => {
    expect(donutSlices([{ label: 'A', valueMinor: '0' }], 5)).toEqual([]);
    expect(donutSlices([], 5)).toEqual([]);
    const s = donutSlices(
      [
        { label: 'A', valueMinor: '500' },
        { label: 'B', valueMinor: '-200' },
        { label: 'C', valueMinor: '0' },
      ],
      5,
    );
    expect(s.map((x) => [x.label, x.permille])).toEqual([['A', 1000]]);
  });

  it('смещения дуг идут подряд от нуля', () => {
    const s = donutSlices(
      [
        { label: 'A', valueMinor: '600' },
        { label: 'B', valueMinor: '400' },
      ],
      5,
    );
    expect(s.map((x) => x.startPermille)).toEqual([0, 600]);
  });
});
