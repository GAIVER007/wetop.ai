import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_TYPE_RU, blockTypeLabel } from './block-types';

/**
 * План дизайн-системы §10 п. 4: подсказка блокировки на шахматке показывала сырой код
 * `OUT_OF_ORDER` / `MANAGEMENT` — словарь в `board-grid.tsx` знал только ремонт, а карточка ячейки
 * держала свой. Теперь словарь один, и у каждого значения `InventoryBlockType` из схемы есть слово.
 */
const SCHEMA = resolve(__dirname, '../../../../packages/database/prisma/schema.prisma');
const enumValues = (name: string): string[] => {
  const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(readFileSync(SCHEMA, 'utf8'));
  if (!m) throw new Error(`enum ${name} не найден в schema.prisma`);
  return m[1]!
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
};

describe('block-types: словарь блокировок покрывает InventoryBlockType', () => {
  it('у каждого значения перечисления есть слово, лишних ключей нет', () => {
    const values = enumValues('InventoryBlockType');
    expect(values.length).toBeGreaterThan(0);
    expect(Object.keys(BLOCK_TYPE_RU).sort()).toEqual([...values].sort());
    for (const v of values)
      expect(BLOCK_TYPE_RU[v as keyof typeof BLOCK_TYPE_RU]).toMatch(/^[а-яё ]+$/);
  });
  it('blockTypeLabel: известный тип — словом, пустой — «блокировка», неизвестный — как есть', () => {
    expect(blockTypeLabel('OUT_OF_ORDER')).toBe('неисправна');
    expect(blockTypeLabel('MANAGEMENT')).toBe('решение управляющего');
    expect(blockTypeLabel(null)).toBe('блокировка');
    expect(blockTypeLabel(undefined)).toBe('блокировка');
    expect(blockTypeLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});
