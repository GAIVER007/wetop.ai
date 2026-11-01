import { describe, expect, it } from 'vitest';
import { CITIZENSHIP_COUNTRIES } from '@pms/domain';
import { countryName } from './citizenship-name';

/**
 * Гражданство на английском и казахском (инструкция гостиницы 01.11.2026): в карточке брони английского интерфейса
 * было «citizenship: Казахстан». Название страны по языку человека; по-русски прежнее название из списка.
 */
const cyr = /[А-Яа-яЁё]/;
describe('country name in the reader language', () => {
  it('ru keeps the list name', () => {
    expect(countryName('KAZ', 'ru')).toBe('Казахстан');
    expect(countryName('ARE', 'ru')).toBe('ОАЭ');
  });
  it('en and kk name every country of the list', () => {
    expect(countryName('KAZ', 'en')).toBe('Kazakhstan');
    expect(countryName('kaz', 'kk')).toBe('Қазақстан');
    for (const c of CITIZENSHIP_COUNTRIES) expect(countryName(c.code, 'en'), c.code).not.toMatch(cyr);
  });
  it('empty and unknown codes', () => {
    expect(countryName(null, 'en')).toBeNull();
    expect(countryName('  ', 'en')).toBeNull();
    expect(countryName('XXX', 'en')).toBe('XXX');
  });
});
