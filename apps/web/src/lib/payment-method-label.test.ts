import { describe, expect, it } from 'vitest';
import { DESK_PAYMENT_METHODS, methodInline, methodRu } from './payment-method-label';

describe('способы оплаты в счёте брони (аудит 22.10.2026 P2-2)', () => {
  it('в списке и таблице «Оплаты» с заглавной буквы, как в «Финансах»', () => {
    expect(methodRu('CASH')).toBe('Наличные');
    expect(methodRu('CARD_TERMINAL')).toBe('Карта (терминал)');
    expect(methodRu('KASPI')).toBe('Kaspi');
    expect(DESK_PAYMENT_METHODS.map(([, t]) => t)).toContain('Перевод от юрлица');
    expect(DESK_PAYMENT_METHODS.map(([k]) => k)).not.toContain('EXTERNAL');
  });
  it('внутри фразы строчными, названия банков как есть', () => {
    expect(methodInline('CASH')).toBe('наличные');
    expect(methodInline('KASPI')).toBe('Kaspi');
  });
});
