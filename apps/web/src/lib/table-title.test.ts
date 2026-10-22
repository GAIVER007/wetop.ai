import { describe, expect, it } from 'vitest';
import { tableTitle } from './table-title';

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
