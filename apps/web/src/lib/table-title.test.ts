import { describe, expect, it } from 'vitest';
import { compareTables, tableTitle } from './table-title';

describe('подпись стола без повтора «Стол Стол 2» (аудит ресторана 22.10.2026)', () => {
  it('номер читается как «Стол 7»', () => {
    expect(tableTitle('7')).toBe('Стол 7');
  });
  it('название, которое уже начинается со «Стол», не дублируется', () => {
    expect(tableTitle('Стол 2')).toBe('Стол 2');
    expect(tableTitle('стол 3')).toBe('стол 3');
    expect(tableTitle('Столик у окна')).toBe('Столик у окна');
  });
  it('своё название без номера остаётся как есть', () => {
    expect(tableTitle('Терраса 2')).toBe('Терраса 2');
    expect(tableTitle('VIP')).toBe('VIP');
  });
  it('пробелы по краям не мешают', () => {
    expect(tableTitle(' 5 ')).toBe('Стол 5');
  });
});

describe('порядок столов: sortOrder, потом число в названии (аудит ресторана 22.10.2026)', () => {
  it('«Стол 1, Стол 2, Стол 10», а не «Стол 10, Стол 2» и не «Стол 2, Стол 3, Стол 1»', () => {
    const rows = ['Стол 2', 'Стол 10', 'Стол 3', 'Стол 1'].map((name) => ({ name, sortOrder: 0 }));
    expect(rows.sort(compareTables).map((t) => t.name)).toEqual(['Стол 1', 'Стол 2', 'Стол 3', 'Стол 10']);
  });
  it('sortOrder важнее названия', () => {
    const rows = [
      { name: 'Стол 1', sortOrder: 2 },
      { name: 'Терраса', sortOrder: 1 },
    ];
    expect(rows.sort(compareTables).map((t) => t.name)).toEqual(['Терраса', 'Стол 1']);
  });
});
