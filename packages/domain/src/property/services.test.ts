import { describe, expect, it } from 'vitest';
import { normalizeClockTime, parseHotelSettingsPatch } from './settings';
import { parseServiceInput } from './services';

/**
 * «Настройки объекта» v2, SET2 и SET3 (`plans/property-settings-set2-set3-2026-09-28.md`, дополнение к ADR-115): время
 * заезда и выезда — всегда 24 часа, каталог услуг правится из стойки. Разбор ввода — чистые функции домена: ими же
 * пользуются стойка (подсказка у поля) и API (запись), поэтому ответы у них одинаковые.
 */
describe('normalizeClockTime', () => {
  it('приводит привычные записи к ЧЧ:ММ', () => {
    expect(normalizeClockTime('14:00')).toBe('14:00');
    expect(normalizeClockTime('9:00')).toBe('09:00');
    expect(normalizeClockTime(' 9.30 ')).toBe('09:30');
    expect(normalizeClockTime('0900')).toBe('09:00');
    expect(normalizeClockTime('1430')).toBe('14:30');
    expect(normalizeClockTime('23:59')).toBe('23:59');
  });

  it('не принимает то, что не время суток', () => {
    for (const bad of ['', '24:00', '14:60', '2 PM', '02:00 PM', '14', '930', '14:0', 'abc'])
      expect(normalizeClockTime(bad)).toBeNull();
  });

  it('разбор настроек принимает ту же запись и хранит ЧЧ:ММ', () => {
    expect(parseHotelSettingsPatch({ checkInTime: '9:00', checkOutTime: '1130' })).toEqual({
      ok: true,
      value: { checkInTime: '09:00', checkOutTime: '11:30' },
    });
    expect(parseHotelSettingsPatch({ checkInTime: '02:00 PM' })).toEqual({
      ok: false,
      reason: 'Время заезда — в виде 14:00',
    });
  });
});

describe('parseServiceInput', () => {
  it('новая услуга: название, группа, цена в тиынах, статус', () => {
    expect(
      parseServiceInput({ name: '  Вода   0,5 ', group: ' Минибар ', price: '700', active: true }),
    ).toEqual({
      ok: true,
      value: { name: 'Вода 0,5', group: 'Минибар', priceMinor: 70000n, active: true },
    });
    expect(parseServiceInput({ name: 'Трансфер', price: '8 000,50' })).toEqual({
      ok: true,
      value: { name: 'Трансфер', group: null, priceMinor: 800050n, active: true },
    });
  });

  it('без названия или цены — причина словами', () => {
    expect(parseServiceInput({ name: ' ', price: '700' })).toEqual({
      ok: false,
      reason: 'Укажите название услуги',
      field: 'name',
    });
    expect(parseServiceInput({ name: 'Вода' })).toEqual({
      ok: false,
      reason: 'Укажите цену услуги',
      field: 'price',
    });
  });

  it('цена — больше нуля, не больше двух знаков после запятой', () => {
    for (const price of ['0', '-100', '12.345', 'сто', '1e3'])
      expect(parseServiceInput({ name: 'Вода', price })).toEqual({
        ok: false,
        reason: 'Цена — больше нуля, например 700 или 700,50',
        field: 'price',
      });
  });

  it('длина названия и группы ограничена', () => {
    expect(parseServiceInput({ name: 'я'.repeat(201), price: '1' })).toMatchObject({
      ok: false,
      field: 'name',
    });
    expect(parseServiceInput({ name: 'Вода', group: 'г'.repeat(101), price: '1' })).toMatchObject({
      ok: false,
      field: 'group',
    });
  });

  it('правка: только присланные поля; архив — active = false', () => {
    expect(parseServiceInput({ active: false }, { partial: true })).toEqual({
      ok: true,
      value: { active: false },
    });
    expect(parseServiceInput({ price: '750', group: '' }, { partial: true })).toEqual({
      ok: true,
      value: { priceMinor: 75000n, group: null },
    });
    expect(parseServiceInput({}, { partial: true })).toEqual({
      ok: false,
      reason: 'Нечего сохранять',
    });
  });

  it('код, налог и неизвестные поля не принимает: код даёт система', () => {
    expect(parseServiceInput({ name: 'Вода', price: '700', code: 'x' })).toEqual({
      ok: false,
      reason: 'Неизвестное поле: code',
    });
    expect(parseServiceInput({ active: 'да' }, { partial: true })).toMatchObject({ ok: false });
  });
});
