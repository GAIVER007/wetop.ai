import { describe, expect, it } from 'vitest';
import { parseReceiptNumber } from './fiscal-receipt';

describe('номер фискального чека (DATA_MODEL §26)', () => {
  it('обрезает пробелы и принимает номер из кассы', () => {
    expect(parseReceiptNumber('  ФП 0001234/56  ')).toBe('ФП 0001234/56');
  });
  it('пустой и слишком длинный номер — отказ словами', () => {
    expect(() => parseReceiptNumber('   ')).toThrow('Номер чека');
    expect(() => parseReceiptNumber(undefined)).toThrow('Номер чека');
    expect(() => parseReceiptNumber('1'.repeat(65))).toThrow('64');
  });
  it('переводы строк и управляющие знаки не принимаются', () => {
    expect(() => parseReceiptNumber('12\n34')).toThrow('Номер чека');
  });
});
