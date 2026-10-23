import { describe, expect, it } from 'vitest';
import { halfLinks } from './half-nav';

describe('форма 910: кнопки называют полугодие (аудит 22.10.2026 P2-8)', () => {
  it('первое полугодие: назад второе прошлого года, вперёд второе этого', () => {
    expect(halfLinks(2026, 1)).toEqual({
      prev: { href: '/reports/form-910?year=2025&half=2', label: '← 2-е полугодие 2025' },
      next: { href: '/reports/form-910?year=2026&half=2', label: '2-е полугодие 2026 →' },
    });
  });
  it('второе полугодие: вперёд первое следующего года', () => {
    expect(halfLinks(2026, 2).next).toEqual({
      href: '/reports/form-910?year=2027&half=1',
      label: '1-е полугодие 2027 →',
    });
  });
});
