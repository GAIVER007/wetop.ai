import { describe, expect, it } from 'vitest';
import { chargeLine, humanizeIsoDates, stayRangeText } from './charge-text';

describe('строка начисления без ISO-дат и без повтора вида (аудит 22.10.2026 P1-7, P1-8)', () => {
  it('экран: «22 окт. – 24 окт.», печать: «22.10.2026 – 24.10.2026»', () => {
    expect(humanizeIsoDates('Проживание 2026-10-22 → 2026-10-24', 'screen')).toBe(
      'Проживание 22 окт. – 24 окт.',
    );
    expect(humanizeIsoDates('Проживание 2026-10-22 → 2026-10-24', 'print')).toBe(
      'Проживание 22.10.2026 – 24.10.2026',
    );
    expect(humanizeIsoDates('Штраф за незаезд (2026-09-15 → 2026-09-18)', 'print')).toBe(
      'Штраф за незаезд (15.09.2026 – 18.09.2026)',
    );
    expect(humanizeIsoDates('Поздний выезд 2026-10-24', 'screen')).toBe('Поздний выезд 24 окт.');
    expect(humanizeIsoDates('Мини-бар', 'screen')).toBe('Мини-бар');
  });

  it('вид начисления не повторяет описание: «Проживание 22 окт. – 24 окт.», а не «проживание Проживание …»', () => {
    expect(chargeLine('проживание', 'Проживание 2026-10-22 → 2026-10-24')).toEqual({
      kind: null,
      text: 'Проживание 22 окт. – 24 окт.',
    });
    expect(chargeLine('услуга', 'Мини-бар')).toEqual({ kind: 'услуга', text: 'Мини-бар' });
  });

  it('период проживания словами для печати', () => {
    expect(stayRangeText('2026-10-22', '2026-10-24', 'print')).toBe('22.10.2026 – 24.10.2026');
    expect(stayRangeText('2026-10-22', '2026-10-24', 'screen')).toBe('22 окт. – 24 окт.');
  });
});
