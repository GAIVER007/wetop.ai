import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseExelyAccommodationTypes } from './parse-accommodation-types';

const fixture = readFileSync(new URL('./__fixtures__/spravochniki.md', import.meta.url), 'utf-8');

describe('parseExelyAccommodationTypes', () => {
  it('parses the category table with Exely ids, kinds and max adults', () => {
    const types = parseExelyAccommodationTypes(fixture);
    expect(types).toHaveLength(3);
    expect(types[0]).toEqual({
      exelyId: '900001',
      name: 'Тестовая одиночная',
      shortName: 'Одиночная',
      kind: 'PRIVATE_ROOM',
      capacityAdults: 1,
      extraBeds: 0,
      childrenWithoutBed: 0,
      active: true,
    });
    // «1 или 2» → максимум 2; **койко-место** → DORM_BED
    expect(types[1]?.capacityAdults).toBe(2);
    expect(types[2]?.kind).toBe('DORM_BED');
  });
  it('fails when the category section is missing', () => {
    expect(() => parseExelyAccommodationTypes('# пусто')).toThrow(/Категории размещения/);
  });
});
