import { describe, expect, it } from 'vitest';
import { beautyBookFingerprint, parseBeautyBookRequest, BEAUTY_BOOK_MAX_SERVICES } from './site-forms';

// Онлайн-запись салона на несколько услуг подряд к одному мастеру (подготовка салонов, 20.10.2026)
const KEY = 'pms_0123456789ab';
const RK = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';
const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const base = { k: KEY, name: 'Гость', phone: '+7 700 000 00 01', requestKey: RK, startsAt: '2026-10-20T14:30+05:00' };

describe('parseBeautyBookRequest: несколько услуг', () => {
  it('одна услуга, как прежде: serviceIds из serviceId', () => {
    const r = parseBeautyBookRequest({ ...base, serviceId: S1 });
    expect(r.ok && r.value.serviceIds).toEqual([S1]);
    expect(r.ok && r.value.serviceId).toBe(S1);
  });
  it('список услуг по порядку визита, первая = serviceId', () => {
    const r = parseBeautyBookRequest({ ...base, serviceId: S1, serviceIds: [S1, S2.toUpperCase()] });
    expect(r.ok && r.value.serviceIds).toEqual([S1, S2]);
  });
  it('serviceIds без serviceId тоже принимается', () => {
    const r = parseBeautyBookRequest({ ...base, serviceIds: [S2, S1] });
    expect(r.ok && r.value.serviceId).toBe(S2);
  });
  it('пусто, повтор, не UUID и больше предела: отказ словами', () => {
    expect(parseBeautyBookRequest({ ...base, serviceIds: [] }).ok).toBe(false);
    expect(parseBeautyBookRequest({ ...base, serviceIds: [S1, S1] })).toEqual({ ok: false, reason: 'serviceIds: услуга повторяется' });
    expect(parseBeautyBookRequest({ ...base, serviceIds: ['x'] }).ok).toBe(false);
    const many = Array.from({ length: BEAUTY_BOOK_MAX_SERVICES + 1 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`);
    expect(parseBeautyBookRequest({ ...base, serviceIds: many }).ok).toBe(false);
    expect(parseBeautyBookRequest({ ...base, serviceId: S1, serviceIds: [S2] })).toEqual({
      ok: false,
      reason: 'serviceId: первая услуга списка',
    });
  });
  it('отпечаток различает состав услуг, а для одной услуги не меняется', () => {
    const one = parseBeautyBookRequest({ ...base, serviceId: S1 });
    const two = parseBeautyBookRequest({ ...base, serviceIds: [S1, S2] });
    if (!one.ok || !two.ok) throw new Error('parse');
    expect(beautyBookFingerprint(one.value)).not.toBe(beautyBookFingerprint(two.value));
    expect(beautyBookFingerprint(one.value)).toBe(
      beautyBookFingerprint({ ...one.value, serviceIds: [S1] }),
    );
  });
});
