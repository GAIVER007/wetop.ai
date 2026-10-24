import { describe, expect, it } from 'vitest';
import { headerClockParts } from './header-clock';

/** Дата и время филиала у логотипа (владелец 24.10.2026, вариант A): «24 октября 20:00 суббота» */
describe('часы шапки', () => {
  const at = new Date('2026-10-24T15:00:00Z');
  it('время и дата по поясу филиала, не по браузеру', () => {
    expect(headerClockParts(at, 'Asia/Almaty', 'ru')).toEqual({ date: '24 октября', short: '24 окт.', time: '20:00', weekday: 'суббота' });
    expect(headerClockParts(at, 'Europe/Moscow', 'ru')).toEqual({ date: '24 октября', short: '24 окт.', time: '18:00', weekday: 'суббота' });
  });
  it('полночь переводит день по поясу филиала', () => {
    expect(headerClockParts(new Date('2026-10-24T19:30:00Z'), 'Asia/Almaty', 'ru')).toMatchObject({ date: '25 октября', time: '00:30', weekday: 'воскресенье' });
  });
  it('неизвестный пояс: пояс платформы, без падения', () => {
    expect(headerClockParts(at, 'Invalid/Zone', 'ru').time).toMatch(/^\d{2}:\d{2}$/);
  });
  it('казахский язык стойки', () => {
    const kk = headerClockParts(at, 'Asia/Almaty', 'kk');
    expect(kk.time).toBe('20:00');
    expect(kk.date).not.toBe('24 октября');
  });
});
