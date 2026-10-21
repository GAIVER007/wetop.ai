import { describe, expect, it } from 'vitest';
import { shortPeriod, zoneLabel } from './human-period';

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
  it('неизвестный пояс: город из кода без подчёркиваний', () => {
    expect(zoneLabel('America/New_York')).toMatch(/^New York, UTC-\d$/);
  });
});
