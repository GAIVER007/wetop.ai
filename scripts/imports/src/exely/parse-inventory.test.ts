import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExelyInventory } from './parse-inventory';

const fixture = readFileSync(new URL('./__fixtures__/inventory.md', import.meta.url), 'utf-8');

describe('parseExelyInventory', () => {
  it('parses buildings, declared total and every unit row in file order', () => {
    const r = parseExelyInventory(fixture);
    expect(r.declaredTotal).toBe(7);
    expect(r.buildings).toEqual([{ name: 'Тестовый', floors: ['1'] }]);
    expect(r.units).toHaveLength(7);
    expect(r.units[0]).toEqual({
      exelyRoomNumber: '1',
      categoryName: 'Тестовая одиночная',
      kind: 'ROOM',
      capacity: 1,
    });
    expect(r.units[2]).toEqual({
      exelyRoomNumber: '10',
      categoryName: 'Тестовый dorm',
      kind: 'BED',
      capacity: 1,
    });
    // порядок и номера берутся как есть — из номера ничего не выводится
    expect(r.units.map((u) => u.exelyRoomNumber)).toEqual(['1', '2', '10', '11', '12', '3', '99']);
  });
  it('rejects an unknown unit type instead of guessing', () => {
    const broken = fixture.replace(
      '| 99 | Тестовая двойная | номер | 2 |',
      '| 99 | Тестовая двойная | апартамент | 2 |',
    );
    expect(() => parseExelyInventory(broken)).toThrow(/99.*апартамент/);
  });
  it('rejects a duplicated Exely room number', () => {
    const broken = fixture.replace(
      '| 99 | Тестовая двойная | номер | 2 |',
      '| 1 | Тестовая двойная | номер | 2 |',
    );
    expect(() => parseExelyInventory(broken)).toThrow(/дубл.*1/i);
  });
  it('fails when the units table is missing', () => {
    expect(() => parseExelyInventory('# пусто')).toThrow(/Единицы продажи/);
  });
});
