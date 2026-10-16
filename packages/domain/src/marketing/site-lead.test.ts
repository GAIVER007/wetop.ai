import { describe, expect, it } from 'vitest';
import { SITE_LEAD_ENDPOINTS, buildSiteBrief, parseSiteLead, type SiteBriefSnapshot } from './index';
import { parseBeautyBookRequest } from '../web-booking/site-forms';

const KEY = 'pms_0123456789ab';
const RK = '6f1c2a90-3b4d-4e5f-8a6b-7c8d9e0f1a2b';

describe('site-lead: тело заявки салона, ресторана и «перезвоните»', () => {
  it('адреса режимов', () => {
    expect(SITE_LEAD_ENDPOINTS).toEqual({
      HOTEL_BOOKING: '/w/book',
      BEAUTY_APPOINTMENT: '/w/beauty/book',
      TABLE_RESERVATION: '/w/food/reserve',
      CALLBACK: '/w/lead',
    });
  });

  it('запись к мастеру: тот же serviceId и ISO с поясом, что принимает публичный backend', () => {
    const r = parseSiteLead('BEAUTY_APPOINTMENT', {
      k: KEY, name: ' Гость ', phone: '+7 700 000 00 01', requestKey: RK, serviceId: RK, startsAt: '2026-10-20T14:30+05:00', turnstileToken: 'tok',
    });
    expect(r).toEqual({
      ok: true,
      body: { k: KEY, name: 'Гость', phone: '+7 700 000 00 01', requestKey: RK, turnstileToken: 'tok', mode: 'BEAUTY_APPOINTMENT', serviceId: RK, startsAt: '2026-10-20T14:30+05:00' },
    });
    if (r.ok) expect(parseBeautyBookRequest(r.body).ok).toBe(true);
    expect(parseSiteLead('BEAUTY_APPOINTMENT', { k: KEY, name: 'Guest', phone: '+77000000001', requestKey: RK, serviceCode: RK, startsAt: '2026-10-20T14:30' }).ok).toBe(false);
  });

  it('бронь стола: дата, время и число гостей', () => {
    const ok = parseSiteLead('TABLE_RESERVATION', { k: KEY, name: 'Гость', phone: '87000000001', requestKey: RK, date: '2026-10-20', time: '19:00', partySize: 4 });
    expect(ok.ok).toBe(true);
    const bad = parseSiteLead('TABLE_RESERVATION', { k: KEY, name: 'Гость', phone: '87000000001', requestKey: RK, date: '2026-02-30', time: '24:00', partySize: 0 });
    expect(bad).toEqual({ ok: false, errors: ['date', 'time', 'partySize'] });
  });

  it('чужое поле режима, пустое имя, неверный ключ: отказ со списком полей', () => {
    const r = parseSiteLead('CALLBACK', { k: 'bad', name: '  ', phone: 'abc', requestKey: 'x', serviceCode: 'svc-1' });
    expect(r.ok).toBe(false);
    expect(r.ok ? [] : r.errors.sort()).toEqual(['k', 'name', 'phone', 'requestKey', 'serviceCode']);
  });

  it('не объект: отказ', () => {
    expect(parseSiteLead('CALLBACK', null)).toEqual({ ok: false, errors: ['body'] });
  });
});

const base = (): SiteBriefSnapshot => ({
  platform: {
    location: { name: 'Салон', address: 'ул. Тестовая, 1', phone: '+77000000001', email: null, timezone: 'Asia/Almaty', currency: 'KZT' },
    property: null,
    categories: [],
  },
  seller: { state: 'MISSING', reason: 'NO_AGENT' },
  channex: { state: 'NO_MAPPING', checkedAt: null, content: null },
});

describe('бриф SITE-2: салон и ресторан', () => {
  it('гостиничный бриф без направления не меняется (нет новых полей, прежний хэш)', () => {
    const b = buildSiteBrief(base(), '2026-10-15T00:00:00.000Z');
    expect('vertical' in b.input).toBe(false);
    expect(b.input.capabilities).toEqual({ booking: true, fromPrice: true });
  });

  it('салон: услуги по группе и имени, цены строкой, мастера, часы; структура для заявок; хэш детерминирован', () => {
    const snap = base();
    snap.platform.vertical = {
      vertical: 'BEAUTY',
      services: [
        { code: 's2', name: 'Стрижка', category: null, durationMin: 45, priceMinor: '500000', currency: 'KZT' },
        { code: 's1', name: 'Маникюр', category: 'Ногти', durationMin: 60, priceMinor: '800000', currency: 'KZT' },
        { code: 's3', name: 'Битая цена', category: null, durationMin: 30, priceMinor: '-1', currency: 'KZT' },
      ],
      staff: [{ id: 'b', name: 'Мастер Б', specialization: null }, { id: 'a', name: 'Мастер А', specialization: 'Маникюр' }],
      menu: [],
      hours: [{ weekday: 2, open: '10:00', close: '19:00' }, { weekday: 1, open: '10:00', close: '20:00' }],
    };
    const b = buildSiteBrief(snap, '2026-10-15T00:00:00.000Z');
    expect(b.input.vertical).toBe('BEAUTY');
    expect(b.input.capabilities).toEqual({ booking: false, fromPrice: false });
    expect(b.input.services?.map((s) => s.code)).toEqual(['s2', 's1']);
    expect(b.input.staff?.map((s) => s.name)).toEqual(['Мастер А', 'Мастер Б']);
    expect(b.input.hours?.map((h) => h.weekday)).toEqual([1, 2]);
    expect(b.proposedStructure.pages[0]!.sections.map((s) => s.type)).toEqual(['hero', 'services', 'staff', 'leadForm', 'hours', 'contacts', 'cta']);
    expect(b.missing.map((m) => m.code)).not.toContain('accommodations');
    const again = structuredClone(snap);
    again.platform.vertical!.services.reverse();
    again.platform.vertical!.staff.reverse();
    expect(buildSiteBrief(again, '2026-10-16T00:00:00.000Z').briefHash).toBe(b.briefHash);
  });

  it('ресторан без меню и часов: пробелы в missing, форма брони стола всё равно предлагается', () => {
    const snap = base();
    snap.platform.vertical = { vertical: 'FOOD_SERVICE', services: [], staff: [], menu: [], hours: [] };
    const b = buildSiteBrief(snap, '2026-10-15T00:00:00.000Z');
    expect(b.missing.map((m) => m.code)).toEqual(expect.arrayContaining(['menu', 'hours']));
    expect(b.proposedStructure.pages[0]!.sections.map((s) => s.type)).toEqual(['hero', 'leadForm', 'contacts', 'cta']);
  });

  it('меню свыше предела режется с записью в усечения', () => {
    const snap = base();
    snap.platform.vertical = {
      vertical: 'FOOD_SERVICE',
      services: [],
      staff: [],
      menu: [{ title: 'Всё', items: Array.from({ length: 301 }, (_, i) => ({ code: `d${i}`, name: `Блюдо ${i}`, weightGrams: null, priceMinor: '100', currency: 'KZT', hasPhoto: false })) }],
      hours: [],
    };
    const b = buildSiteBrief(snap, '2026-10-15T00:00:00.000Z');
    expect(b.input.menu![0]!.items).toHaveLength(300);
    expect(b.truncations).toContainEqual({ source: 'PLATFORM', field: 'menu.items', originalLength: 301 });
  });
});
