import { describe, expect, it } from 'vitest';
import { dayClock, shortPeriod, visitRange, zoneLabel } from './human-period';

describe('период и часовой пояс словами (аудит 21.10.2026, пп. 1, 8, 9, 22)', () => {
  it('период внутри месяца пишется одним месяцем', () => {
    expect(shortPeriod('2026-10-15', '2026-10-21')).toBe('15-21 окт.');
  });
  it('период через два месяца: оба месяца, без двоеточия', () => {
    expect(shortPeriod('2026-10-15', '2026-11-02')).toBe('15 окт. - 2 нояб.');
  });
  it('один день: одна дата', () => {
    expect(shortPeriod('2026-10-21', '2026-10-21')).toBe('21 окт.');
  });
  it('период через год: с годами', () => {
    expect(shortPeriod('2026-12-28', '2027-01-03')).toBe('28 дек. 2026 - 3 янв. 2027');
  });
  it('пояс показывается городом и сдвигом, а не кодом Asia/Almaty', () => {
    const label = zoneLabel('Asia/Almaty');
    expect(label).toMatch(/^Алматы, UTC\+\d$/);
    expect(label).not.toContain('Asia/');
    expect(zoneLabel('Europe/Moscow')).toBe('Москва, UTC+3');
    expect(zoneLabel('UTC')).toBe('UTC');
  });
  it('бронь словами в поясе филиала: «чт, 22 окт., 19:00–21:00», без ISO', () => {
    expect(visitRange('2026-10-22T14:00:00.000Z', '2026-10-22T16:00:00.000Z', 'Asia/Almaty')).toBe(
      'чт, 22 окт., 19:00–21:00',
    );
    expect(visitRange('2026-10-22T14:00:00.000Z', '2026-10-22T16:00:00.000Z', 'UTC')).toBe(
      'чт, 22 окт., 14:00–16:00',
    );
  });
  it('бронь через полночь показывает день конца', () => {
    expect(visitRange('2026-10-22T17:00:00.000Z', '2026-10-22T20:00:00.000Z', 'Asia/Almaty')).toBe(
      'чт, 22 окт., 22:00 – пт, 23 окт., 01:00',
    );
  });
  it('момент операции кассы: «22 окт., 01:06» в поясе филиала', () => {
    expect(dayClock('2026-10-21T20:06:00.000Z', 'Asia/Almaty')).toBe('22 окт., 01:06');
    expect(dayClock('2026-10-21T20:06:00.000Z', 'UTC')).toBe('21 окт., 20:06');
  });
  it('неизвестный пояс: город из кода без подчёркиваний', () => {
    expect(zoneLabel('America/New_York')).toMatch(/^New York, UTC-\d$/);
  });
});
