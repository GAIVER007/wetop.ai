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
      exelyRoomNumber: '9001',
      categoryName: 'Тестовая одиночная',
      kind: 'ROOM',
      capacity: 1,
    });
    expect(r.units[2]).toEqual({
      exelyRoomNumber: '9010',
      categoryName: 'Тестовый dorm',
      kind: 'BED',
      capacity: 1,
    });
    // порядок и номера берутся как есть — из номера ничего не выводится
    expect(r.units.map((u) => u.exelyRoomNumber)).toEqual([
      '9001',
      '9002',
      '9010',
      '9011',
      '9012',
      '9003',
      '9099',
    ]);
  });
  it('rejects an unknown unit type instead of guessing', () => {
    const broken = fixture.replace(
      '| 9099 | Тестовая двойная | номер | 2 |',
      '| 9099 | Тестовая двойная | апартамент | 2 |',
    );
    expect(() => parseExelyInventory(broken)).toThrow(/9099.*апартамент/);
  });
  it('rejects a duplicated Exely room number', () => {
    const broken = fixture.replace(
      '| 9099 | Тестовая двойная | номер | 2 |',
      '| 9001 | Тестовая двойная | номер | 2 |',
    );
    expect(() => parseExelyInventory(broken)).toThrow(/дубл.*9001/i);
  });
  it('fails when the units table is missing', () => {
    expect(() => parseExelyInventory('# пусто')).toThrow(/Единицы продажи/);
  });
});
