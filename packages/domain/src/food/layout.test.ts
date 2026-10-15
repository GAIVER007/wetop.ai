import { describe, expect, it } from 'vitest';
import { layoutSpots, parseAreaLayout, tableShapeOf } from './layout';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('схема зала (§42)', () => {
  it('форма: своя, иначе по вместимости', () => {
    expect(tableShapeOf({ capacity: 2, shape: null })).toBe('ROUND');
    expect(tableShapeOf({ capacity: 4, shape: null })).toBe('SQUARE');
    expect(tableShapeOf({ capacity: 6, shape: null })).toBe('RECT');
    expect(tableShapeOf({ capacity: 6, shape: 'ROUND' })).toBe('ROUND');
  });

  it('места: расставленные стоят где стоят, остальные по порядку внутри полотна', () => {
    const spots = layoutSpots([
      { id: 'a', posX: 500, posY: 500 },
      { id: 'b', posX: null, posY: null },
      { id: 'c', posX: null, posY: null },
    ]);
    expect(spots.get('a')).toEqual({ x: 500, y: 500 });
    const b = spots.get('b')!, c = spots.get('c')!;
    expect(b).not.toEqual(c);
    for (const p of [b, c]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1000);
    }
    // много столов не выходят за полотно
    const many = layoutSpots(Array.from({ length: 40 }, (_, i) => ({ id: String(i), posX: null, posY: null })));
    expect([...many.values()].every((p) => p.y <= 1000)).toBe(true);
  });

  it('разбор расстановки: целые в пределах, формы из списка, без повторов', () => {
    const ok = parseAreaLayout({
      tables: [{ id: ID(1), posX: 0, posY: 1000, shape: 'RECT', scale: 150, rotation: 90 }],
    });
    expect(ok).toEqual([{ id: ID(1), posX: 0, posY: 1000, shape: 'RECT', scale: 150, rotation: 90 }]);
    const t = { id: ID(1), posX: 10, posY: 10, shape: null, scale: 100, rotation: 0 };
    expect(parseAreaLayout({ tables: [t] })[0]!.shape).toBeNull();
    for (const bad of [
      { tables: [] },
      { tables: [{ ...t, posX: 1001 }] },
      { tables: [{ ...t, posY: -1 }] },
      { tables: [{ ...t, posX: 1.5 }] },
      { tables: [{ ...t, scale: 49 }] },
      { tables: [{ ...t, scale: 201 }] },
      { tables: [{ ...t, rotation: 45 }] },
      { tables: [{ ...t, shape: 'OVAL' }] },
      { tables: [t, t] },
      { tables: [{ ...t, extra: 1 }] },
      { tables: [{ ...t, id: 'x' }] },
    ])
      expect(() => parseAreaLayout(bad)).toThrow();
  });
});
