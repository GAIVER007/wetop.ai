import { describe, expect, it } from 'vitest';
import { blankToNull } from './text';

describe('blankToNull', () => {
  it('отсутствующее значение в любом виде — NULL', () => {
    for (const v of [null, undefined, '', ' ', '   ', '\t\n']) expect(blankToNull(v)).toBeNull();
  });
  it('значение обрезается по краям, середина не трогается', () => {
    expect(blankToNull(' +7 701 123 45 67 ')).toBe('+7 701 123 45 67');
    expect(blankToNull('ivan@example.invalid')).toBe('ivan@example.invalid');
  });
});
