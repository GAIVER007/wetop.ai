import { describe, expect, it } from 'vitest';
import { parseHotelSettingsPatch } from './settings';

/**
 * Сведения гостиницы правит владелец организации (ТЗ `plans/ux-retention-2026-09-26.md` п. 3.1, UQ-1 — «да» владельца
 * 26.09.2026). Разбор ввода — чистая функция: что пришло, то проверено и нормализовано; валюта и часовой пояс сюда не
 * попадают вовсе — они держат деньги и границы ночей.
 */
describe('parseHotelSettingsPatch', () => {
  it('accepts valid per-property Channex location and type, rejects malformed values', () => {
    expect(parseHotelSettingsPatch({ countryCode: 'KZ', city: 'Алматы', channexPropertyType: 'hostel' }))
      .toEqual({ ok: true, value: { countryCode: 'KZ', city: 'Алматы', channexPropertyType: 'hostel' } });
    expect(parseHotelSettingsPatch({ countryCode: 'Kazakhstan' }).ok).toBe(false);
    expect(parseHotelSettingsPatch({ channexPropertyType: 'unknown' }).ok).toBe(false);
  });
  it('нормализует пробелы, пустое необязательное поле — null', () => {
    expect(
      parseHotelSettingsPatch({
        name: '  Хостел   на Абая ',
        legalName: ' ',
        address: ' Астана, Абая 1 ',
        phone: '+7 (700) 123-45-67',
        email: ' Info@Hostel.KZ ',
        checkInTime: '15:00',
        checkOutTime: '11:30',
      }),
    ).toEqual({
      ok: true,
      value: {
        name: 'Хостел на Абая',
        legalName: null,
        address: 'Астана, Абая 1',
        phone: '+7 (700) 123-45-67',
        email: 'info@hostel.kz',
        checkInTime: '15:00',
        checkOutTime: '11:30',
      },
    });
  });

  it('валюту, часовой пояс и неизвестные поля не принимает', () => {
    expect(parseHotelSettingsPatch({ currency: 'USD' })).toEqual({
      ok: false,
      reason: 'Валюту и часовой пояс меняет поддержка WETOP: от них зависят деньги и границы ночей.',
    });
    expect(parseHotelSettingsPatch({ timezone: 'UTC' }).ok).toBe(false);
    expect(parseHotelSettingsPatch({ id: 'x' })).toEqual({ ok: false, reason: 'Неизвестное поле: id' });
  });

  it('проверяет время, почту, телефон, ИИН/БИН и пустое название словами', () => {
    expect(parseHotelSettingsPatch({ checkInTime: '25:00' })).toEqual({
      ok: false,
      reason: 'Время заезда — в виде 14:00',
    });
    expect(parseHotelSettingsPatch({ email: 'не почта' })).toEqual({
      ok: false,
      reason: 'Почта — в виде name@example.kz',
    });
    expect(parseHotelSettingsPatch({ phone: '12' })).toEqual({
      ok: false,
      reason: 'Телефон — от 5 до 15 цифр',
    });
    expect(parseHotelSettingsPatch({ bin: '123' })).toEqual({
      ok: false,
      reason: 'ИИН/БИН — 12 цифр',
    });
    expect(parseHotelSettingsPatch({ name: '  ' }).ok).toBe(false);
  });

  it('пустое тело — нечего сохранять', () => {
    expect(parseHotelSettingsPatch({})).toEqual({ ok: false, reason: 'Нечего сохранять' });
    expect(parseHotelSettingsPatch(null)).toEqual({ ok: false, reason: 'Нечего сохранять' });
  });
});
