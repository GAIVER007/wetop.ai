import { describe, expect, it } from 'vitest';
import { lineGeometry } from './line-geometry';

describe('геометрия линейного графика (RPT2.2c-3, DESIGN.md §8.2 LineChart)', () => {
  it('точки равномерно по ширине, ноль внизу, максимум вверху; пропуски рвут линию', () => {
    const g = lineGeometry([[0, 50, null, 100, 100]], {
      width: 100,
      height: 100,
      pad: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(g.series[0]?.segments).toEqual(['M0,100 L25,50', 'M75,0 L100,0']);
    expect(g.max).toBe(100);
  });

  it('шкала округляется вверх до красивого шага и общая для всех линий', () => {
    const g = lineGeometry(
      [
        [10, 20],
        [90, 410],
      ],
      { width: 10, height: 10, pad: { top: 0, right: 0, bottom: 0, left: 0 } },
    );
    expect(g.max).toBe(500);
    expect(g.ticks).toEqual([0, 125, 250, 375, 500]);
  });

  it('одна точка рисуется отрезком нулевой длины (видна точкой), пустые данные дают пустую геометрию', () => {
    const one = lineGeometry([[5]], {
      width: 100,
      height: 100,
      pad: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(one.series[0]?.dots).toHaveLength(1);
    expect(lineGeometry([[null, null]], { width: 100, height: 100 }).series[0]?.segments).toEqual(
      [],
    );
    expect(lineGeometry([], { width: 100, height: 100 }).max).toBe(0);
  });

  it('все нули: шкала не нулевая, линия лежит на оси', () => {
    const g = lineGeometry([[0, 0, 0]], {
      width: 100,
      height: 100,
      pad: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(g.max).toBeGreaterThan(0);
    expect(g.series[0]?.segments).toEqual(['M0,100 L50,100 L100,100']);
  });

  it('одинокая точка между пропусками отрезка не даёт, остаётся маркером', () => {
    const g = lineGeometry([[5, null, 7]], { width: 100, height: 100 });
    expect(g.series[0]?.segments).toEqual([]);
    expect(g.series[0]?.dots.map((d) => d.index)).toEqual([0, 2]);
  });
});
