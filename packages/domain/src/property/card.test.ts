import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_RULES,
  DEPOSIT_RULES,
  ONSITE_PAYMENTS,
  PROPERTY_AMENITIES,
  parseHotelSettingsPatch,
} from './settings';

/**
 * Карточка объекта (ADR-157, DATA_MODEL §32): описание, сайт, публичное имя, правила проживания, удобства.
 * Один разбор для API и стойки; деньги и бронирование он не трогает.
 */
const parse = (patch: Record<string, unknown>) => parseHotelSettingsPatch(patch);
const reason = (patch: Record<string, unknown>) => {
  const r = parse(patch);
  return r.ok ? null : r.reason;
};

describe('карточка объекта: тексты', () => {
  it('нормализует описание, сайт и публичное имя; пустое значит «нет»', () => {
    expect(parse({ description: '  Уют   и комфорт ', website: ' https://luxxaparts.kz ', publicName: ' ИП «L.A» ' })).toEqual({
      ok: true,
      value: { description: 'Уют и комфорт', website: 'https://luxxaparts.kz', publicName: 'ИП «L.A»' },
    });
    expect(parse({ description: ' ', website: '', publicName: null })).toEqual({
      ok: true,
      value: { description: null, website: null, publicName: null },
    });
  });
  it('адрес сайта без схемы получает https, чужие схемы и мусор отклоняются', () => {
    expect(parse({ website: 'luxxaparts.kz' })).toEqual({ ok: true, value: { website: 'https://luxxaparts.kz' } });
    expect(reason({ website: 'javascript:alert(1)' })).toMatch(/адрес сайта/i);
    expect(reason({ website: 'ftp://x.kz' })).toMatch(/адрес сайта/i);
    expect(reason({ website: 'не сайт' })).toMatch(/адрес сайта/i);
    expect(reason({ website: `https://${'a'.repeat(300)}.kz` })).toMatch(/300/);
  });
  it('описание не длиннее 500 знаков, комментарий к правилам тоже', () => {
    expect(reason({ description: 'я'.repeat(501) })).toMatch(/500/);
    expect(parse({ description: 'я'.repeat(500) }).ok).toBe(true);
    expect(reason({ houseRulesNote: 'я'.repeat(501) })).toMatch(/500/);
  });
  it('комментарий к правилам сохраняет переводы строк', () => {
    expect(parse({ houseRulesNote: 'Тишина после 22:00.\nСпасибо!' })).toEqual({
      ok: true,
      value: { houseRulesNote: 'Тишина после 22:00.\nСпасибо!' },
    });
  });
});

describe('карточка объекта: правила проживания', () => {
  it('переключатели только булевы', () => {
    expect(
      parse({ earlyCheckIn: true, lateCheckOut: false, childrenAllowed: true, petsAllowed: false, smokingAllowed: false }),
    ).toEqual({
      ok: true,
      value: { earlyCheckIn: true, lateCheckOut: false, childrenAllowed: true, petsAllowed: false, smokingAllowed: false },
    });
    expect(reason({ petsAllowed: 'yes' })).toMatch(/да или нет/i);
    expect(reason({ earlyCheckIn: null })).toMatch(/да или нет/i);
  });
  it('способ оплаты, отмена и залог только из списков', () => {
    for (const code of ONSITE_PAYMENTS) expect(parse({ onsitePayment: code }).ok).toBe(true);
    for (const code of CANCELLATION_RULES) expect(parse({ cancellationRule: code }).ok).toBe(true);
    for (const code of DEPOSIT_RULES) expect(parse({ depositRule: code }).ok).toBe(true);
    expect(reason({ onsitePayment: 'BITCOIN' })).toMatch(/способ оплаты/i);
    expect(reason({ cancellationRule: 'WHENEVER' })).toMatch(/отмен/i);
    expect(reason({ depositRule: 'KIDNEY' })).toMatch(/залог/i);
  });
  it('минимальный возраст целое от 0 до 99', () => {
    expect(parse({ minGuestAge: 18 })).toEqual({ ok: true, value: { minGuestAge: 18 } });
    expect(parse({ minGuestAge: '21' })).toEqual({ ok: true, value: { minGuestAge: 21 } });
    expect(reason({ minGuestAge: 100 })).toMatch(/возраст/i);
    expect(reason({ minGuestAge: -1 })).toMatch(/возраст/i);
    expect(reason({ minGuestAge: 17.5 })).toMatch(/возраст/i);
    expect(reason({ minGuestAge: '' })).toMatch(/возраст/i);
  });
  it('тихие часы заданы парой, в 24-часовом виде', () => {
    expect(parse({ quietHoursFrom: '22:00', quietHoursTo: '8:00' })).toEqual({
      ok: true,
      value: { quietHoursFrom: '22:00', quietHoursTo: '08:00' },
    });
    expect(parse({ quietHoursFrom: '', quietHoursTo: null })).toEqual({
      ok: true,
      value: { quietHoursFrom: null, quietHoursTo: null },
    });
    expect(reason({ quietHoursFrom: '22:00' })).toMatch(/тихие часы/i);
    expect(reason({ quietHoursFrom: '25:00', quietHoursTo: '08:00' })).toMatch(/тихие часы/i);
  });
});

describe('карточка объекта: удобства', () => {
  it('коды из каталога, без повторов, порядок каталога', () => {
    const [a, b] = PROPERTY_AMENITIES.map((x) => x.code);
    expect(parse({ amenities: [b, a, b] })).toEqual({ ok: true, value: { amenities: [a, b] } });
    expect(parse({ amenities: [] })).toEqual({ ok: true, value: { amenities: [] } });
  });
  it('чужой код и не массив отклоняются', () => {
    expect(reason({ amenities: ['wifi', 'teleport'] })).toMatch(/удобств/i);
    expect(reason({ amenities: 'wifi' })).toMatch(/удобств/i);
    expect(reason({ amenities: [1] })).toMatch(/удобств/i);
  });
  it('каталог без повторов кодов и с подписями', () => {
    const codes = PROPERTY_AMENITIES.map((x) => x.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const x of PROPERTY_AMENITIES) expect(x.label.length).toBeGreaterThan(1);
    for (const code of ['wifi', 'parking', 'air_conditioning', 'kitchen', 'transfer', 'breakfast', 'laundry'])
      expect(codes).toContain(code);
  });
});
