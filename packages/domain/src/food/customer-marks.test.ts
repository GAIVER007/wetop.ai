import { describe, expect, it } from 'vitest';
import { birthdayInDays, parseCustomerMarks } from './customer-marks';

/** VIP и день рождения клиента (DATA_MODEL §36, ADR-166) */
describe('через сколько дней день рождения', () => {
  it('сегодня 0, завтра 1, прошёл в этом году — на следующий', () => {
    expect(birthdayInDays('1990-10-11', '2026-10-11')).toBe(0);
    expect(birthdayInDays('1990-10-12', '2026-10-11')).toBe(1);
    expect(birthdayInDays('1990-10-10', '2026-10-11')).toBe(364);
  });
  it('через новый год', () => {
    expect(birthdayInDays('1985-01-02', '2026-12-30')).toBe(3);
  });
  it('29 февраля в невисокосный год празднуют 28-го', () => {
    expect(birthdayInDays('2000-02-29', '2026-02-27')).toBe(1);
    expect(birthdayInDays('2000-02-29', '2028-02-27')).toBe(2);
  });
});

describe('разбор правки клиента', () => {
  const today = '2026-10-11';
  it('метка и дата, дата снимается null', () => {
    expect(parseCustomerMarks({ isVip: true, birthDate: '1990-05-01' }, today)).toEqual({
      isVip: true,
      birthDate: '1990-05-01',
    });
    expect(parseCustomerMarks({ birthDate: null }, today)).toEqual({ birthDate: null });
  });
  it('будущая, слишком старая, несуществующая дата и пустой запрос отклоняются', () => {
    expect(() => parseCustomerMarks({ birthDate: '2026-10-12' }, today)).toThrow();
    expect(() => parseCustomerMarks({ birthDate: '1899-12-31' }, today)).toThrow();
    expect(() => parseCustomerMarks({ birthDate: '1990-02-30' }, today)).toThrow();
    expect(() => parseCustomerMarks({ isVip: 'да' }, today)).toThrow();
    expect(() => parseCustomerMarks({}, today)).toThrow();
  });
});
