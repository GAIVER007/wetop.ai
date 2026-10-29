import { describe, expect, it } from 'vitest';
import { PHONE_COUNTRIES, registrationPhone } from './registration-contact';
import { countryFromPhone, suggestedLocale, WORLD_DIALS } from './phone-country';

/**
 * Владелец 29.10.2026: «при регистрации человек выбирает страну, а их всего три (Дубай, Катар, Казахстан); с других
 * стран не зарегистрируются. Пусть страна подтягивается по первым цифрам номера: +7 747/707 Казахстан, +7 9xx Россия,
 * +1 и так под каждую страну; и по стране сразу предлагается язык системы».
 */
describe('countryFromPhone: страна по первым цифрам номера', () => {
  it('+7: Казахстан по 6 и 7 после кода (747, 707, 701, 777), Россия по остальным (9xx, 4xx, 8xx)', () => {
    expect(countryFromPhone('+7 747 123 45 67')?.code).toBe('KZ');
    expect(countryFromPhone('+7 707')?.code).toBe('KZ');
    expect(countryFromPhone('+77011234567')?.code).toBe('KZ');
    expect(countryFromPhone('+7 600 000 00 00')?.code).toBe('KZ');
    expect(countryFromPhone('+7 916 123 45 67')?.code).toBe('RU');
    expect(countryFromPhone('+7 495 123 45 67')?.code).toBe('RU');
  });
  it('пока после +7 цифр нет, страна предварительная: Казахстан (основной рынок)', () => {
    expect(countryFromPhone('+7')?.code).toBe('KZ');
    expect(countryFromPhone('+7')?.sure).toBe(false);
    expect(countryFromPhone('+7 7')?.sure).toBe(true);
  });
  it('местная запись 8 и 87… это Казахстан/Россия с +7, без плюса код не угадываем', () => {
    expect(countryFromPhone('8 701 555 44 33')?.code).toBe('KZ');
    expect(countryFromPhone('8 916 555 44 33')?.code).toBe('RU');
    expect(countryFromPhone('701 555 44 33')).toBeNull();
  });
  it('длинный код побеждает короткий: +971 ОАЭ, +974 Катар, +998 Узбекистан, +996 Кыргызстан', () => {
    expect(countryFromPhone('+971 50 123 4567')?.code).toBe('AE');
    expect(countryFromPhone('+974 5550 1234')?.code).toBe('QA');
    expect(countryFromPhone('+998 90 123 45 67')?.code).toBe('UZ');
    expect(countryFromPhone('+996 555 123 456')?.code).toBe('KG');
  });
  it('страны всего мира: США, Индия, Саудовская Аравия, Франция, Бразилия, Египет, Нигерия, Австралия', () => {
    expect(countryFromPhone('+1 212 555 0100')?.code).toBe('US');
    expect(countryFromPhone('+91 98765 43210')?.code).toBe('IN');
    expect(countryFromPhone('+966 50 123 4567')?.code).toBe('SA');
    expect(countryFromPhone('+33 6 12 34 56 78')?.code).toBe('FR');
    expect(countryFromPhone('+55 11 91234 5678')?.code).toBe('BR');
    expect(countryFromPhone('+20 10 1234 5678')?.code).toBe('EG');
    expect(countryFromPhone('+234 803 123 4567')?.code).toBe('NG');
    expect(countryFromPhone('+61 412 345 678')?.code).toBe('AU');
  });
  it('незнакомое начало и пустое поле: null (форма просит номер с кодом)', () => {
    expect(countryFromPhone('')).toBeNull();
    expect(countryFromPhone('+')).toBeNull();
    expect(countryFromPhone('+0 123')).toBeNull();
  });
  it('местная часть без кода: то, что остаётся после кода страны', () => {
    expect(countryFromPhone('+974 5550 1234')?.national).toBe('55501234');
    expect(countryFromPhone('+7 (701) 555-44-33')?.national).toBe('7015554433');
  });
});

describe('мир целиком в списке стран регистрации', () => {
  it('каждая страна мира с кодом есть в PHONE_COUNTRIES, Казахстан первым, коды уникальны', () => {
    expect(PHONE_COUNTRIES[0]?.code).toBe('KZ');
    expect(PHONE_COUNTRIES.length).toBeGreaterThanOrEqual(200);
    const codes = new Set(PHONE_COUNTRIES.map((c) => c.code));
    expect(codes.size).toBe(PHONE_COUNTRIES.length);
    for (const [code] of WORLD_DIALS) expect(codes.has(code), code).toBe(true);
  });
  it('у каждой страны русское название', () => {
    for (const c of PHONE_COUNTRIES) expect(c.name, c.code).toMatch(/[А-Яа-яЁё]/);
  });
  it('API принимает номер любой страны: Индия, Франция, США', () => {
    expect(registrationPhone('IN', '+91 98765 43210')).toBe('+919876543210');
    expect(registrationPhone('FR', '+33 6 12 34 56 78')).toBe('+33612345678');
    expect(registrationPhone('US', '+1 212 555 0100')).toBe('+12125550100');
  });
});

describe('suggestedLocale: язык системы по стране', () => {
  it('Казахстан и страны СНГ: русский (казахский и английский в списке рядом)', () => {
    expect(suggestedLocale('KZ')).toBe('ru');
    for (const c of ['RU', 'BY', 'KG', 'UZ', 'TJ', 'TM', 'AZ', 'AM', 'GE', 'MD']) expect(suggestedLocale(c), c).toBe('ru');
  });
  it('остальной мир: английский', () => {
    for (const c of ['QA', 'AE', 'US', 'IN', 'FR', 'TR', 'SA', 'BR']) expect(suggestedLocale(c), c).toBe('en');
  });
  it('языки на выбор по стране: для Казахстана казахский первым рядом с русским', () => {
    expect(suggestedLocale('KZ', 'choices')).toEqual(['kk', 'ru', 'en']);
    expect(suggestedLocale('RU', 'choices')).toEqual(['ru', 'en', 'kk']);
    expect(suggestedLocale('QA', 'choices')).toEqual(['en', 'ru', 'kk']);
  });
});
