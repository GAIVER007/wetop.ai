import { describe, expect, it } from 'vitest';
import { hasCitizenship, normalizeCitizenship } from './citizenship';

describe('normalizeCitizenship', () => {
  it('blank values are «no citizenship»: null, undefined, empty string and CHAR(3) padding', () => {
    expect(normalizeCitizenship(null)).toBeNull();
    expect(normalizeCitizenship(undefined)).toBeNull();
    expect(normalizeCitizenship('')).toBeNull();
    // Postgres CHAR(3) хранит '' как '   ' и отдаёт его с пробелами
    expect(normalizeCitizenship('   ')).toBeNull();
    expect(normalizeCitizenship('\t \n')).toBeNull();
  });
  it('a code is trimmed and upper-cased, nothing else is changed', () => {
    expect(normalizeCitizenship('KAZ')).toBe('KAZ');
    expect(normalizeCitizenship(' kaz ')).toBe('KAZ');
    expect(normalizeCitizenship('KZ ')).toBe('KZ'); // не валидирует: короткий код всплывёт в сверке, а не потеряется
  });
  it('hasCitizenship is the check-in predicate', () => {
    expect(hasCitizenship('KAZ')).toBe(true);
    expect(hasCitizenship('   ')).toBe(false);
    expect(hasCitizenship(null)).toBe(false);
  });
});
