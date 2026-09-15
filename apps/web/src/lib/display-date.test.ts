import { describe, expect, it } from 'vitest';
import { displayDay, displayPeriod } from './display-date';

describe('DESIGN.md §14: даты и периоды', () => {
  it('дата — 14.09.2026', () => {
    expect(displayDay('2026-09-14')).toBe('14.09.2026');
  });
  it('период — год один раз, если совпадает', () => {
    expect(displayPeriod('2026-09-14', '2026-09-17')).toBe('14.09 → 17.09.2026');
  });
  it('период через Новый год — оба года', () => {
    expect(displayPeriod('2026-12-28', '2027-01-02')).toBe('28.12.2026 → 02.01.2027');
  });
  it('не дата — возвращается как есть', () => {
    expect(displayPeriod('вчера', '2026-09-17')).toBe('вчера → 2026-09-17');
  });
});
