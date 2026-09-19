import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_NAME_MAX,
  isOrganizationNameShaped,
  normalizeOrganizationName,
} from './registration';

describe('normalizeOrganizationName', () => {
  it('обрезает края и схлопывает пробелы внутри', () => {
    expect(normalizeOrganizationName('  Хостел   «Пример»\t\n')).toBe('Хостел «Пример»');
  });
  it('обычное название не трогает', () => {
    expect(normalizeOrganizationName('Luxx Aparts')).toBe('Luxx Aparts');
  });
});

describe('isOrganizationNameShaped', () => {
  it('одна буква — уже название', () => {
    expect(isOrganizationNameShaped('Я')).toBe(true);
  });
  it('пустая строка и одни пробелы — нет', () => {
    expect(isOrganizationNameShaped('')).toBe(false);
    expect(isOrganizationNameShaped('   \t ')).toBe(false);
  });
  it(`ровно ${ORGANIZATION_NAME_MAX} знаков проходит, на один больше — нет: столько влезает в колонку`, () => {
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX))).toBe(true);
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX + 1))).toBe(false);
  });
  it('длина считается после схлопывания пробелов', () => {
    expect(isOrganizationNameShaped('а'.repeat(ORGANIZATION_NAME_MAX) + '     ')).toBe(true);
  });
});
