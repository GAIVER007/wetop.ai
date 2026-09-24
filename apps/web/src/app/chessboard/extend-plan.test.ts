import { describe, expect, it } from 'vitest';
import { extensionNights } from './extend-plan';

describe('продление за правый край', () => {
  it('добавляет ночи до выбранной последней ночи, включая границу месяца', () => {
    expect(extensionNights('2026-09-29', '2026-10-02')).toBe(3);
  });
  it('не сокращает проживание и не принимает неверные даты или более 30 ночей', () => {
    expect(extensionNights('2026-09-29', '2026-09-29')).toBe(0);
    expect(extensionNights('2026-09-29', '2026-09-28')).toBe(0);
    expect(extensionNights('2026-09-29', '2026-11-01')).toBe(0);
    expect(extensionNights('2026-02-30', '2026-03-04')).toBe(0);
  });
});
