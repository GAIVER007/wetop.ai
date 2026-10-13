import { foodId, foodInt, foodObject } from './food';

/** Схема зала (DATA_MODEL §42): полотно зоны 0–1000 по каждой оси, центр стола в этих единицах */
export const LAYOUT_SIZE = 1000;
export const TABLE_SHAPES = ['ROUND', 'SQUARE', 'RECT'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

/** Своя форма, иначе по вместимости, как рисовался план до схемы */
export function tableShapeOf(t: { capacity: number; shape: TableShape | null }): TableShape {
  return t.shape ?? (t.capacity <= 2 ? 'ROUND' : t.capacity <= 4 ? 'SQUARE' : 'RECT');
}

/**
 * Места столов зоны: расставленные стоят где стоят, остальные по порядку рядами по пять. Производное, не хранится.
 * ponytail: нерасставленный стол может лечь поверх расставленного; редактор покажет его, и его перетащат
 */
export function layoutSpots(
  tables: ReadonlyArray<{ id: string; posX: number | null; posY: number | null }>,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const free = tables.filter((t) => t.posX === null || t.posY === null);
  const rows = Math.max(1, Math.ceil(free.length / 5));
  free.forEach((t, i) =>
    out.set(t.id, { x: 100 + (i % 5) * 200, y: Math.round(((Math.floor(i / 5) + 0.5) * LAYOUT_SIZE) / rows) }),
  );
  for (const t of tables) if (t.posX !== null && t.posY !== null) out.set(t.id, { x: t.posX, y: t.posY });
  return out;
}

export interface TableLayout {
  id: string;
  posX: number;
  posY: number;
  shape: TableShape | null;
  scale: number;
  rotation: 0 | 90;
}

/** Расстановка зоны целиком: `{ tables: [...] }`, каждый стол один раз */
export function parseAreaLayout(raw: unknown): TableLayout[] {
  const b = foodObject(raw, ['tables']);
  if (!Array.isArray(b.tables) || b.tables.length === 0 || b.tables.length > 300)
    throw new Error('Пришлите столы зоны списком');
  const seen = new Set<string>();
  return b.tables.map((row: unknown) => {
    const t = foodObject(row, ['id', 'posX', 'posY', 'shape', 'scale', 'rotation']);
    const id = foodId(t.id);
    if (seen.has(id)) throw new Error('Стол указан дважды');
    seen.add(id);
    if (t.shape !== null && !TABLE_SHAPES.includes(t.shape as TableShape)) throw new Error('Форма стола: круг, квадрат или прямоугольник');
    if (t.rotation !== 0 && t.rotation !== 90) throw new Error('Поворот стола: 0 или 90 градусов');
    return {
      id,
      posX: foodInt(t.posX, 0, LAYOUT_SIZE),
      posY: foodInt(t.posY, 0, LAYOUT_SIZE),
      shape: (t.shape as TableShape | null) ?? null,
      scale: foodInt(t.scale, 50, 200),
      rotation: t.rotation,
    };
  });
}
