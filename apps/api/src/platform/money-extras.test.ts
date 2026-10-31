import { describe, expect, it } from 'vitest';
import { parseExpenseExtras, parseSubscriptionExtras } from './money';

/**
 * Поля подписки и расхода WETOP (DATA_MODEL PLATFORM-FIELDS-20261031, миграция 176; владелец 31.10.2026 «Да делай»):
 * подписка: промокод, скидка %, автопродление; расход: получатель, проект, повторяется, документ.
 */
describe('поля подписки', () => {
  it('промокод заглавными без пробелов, скидка целым 0–100, автопродление по умолчанию включено', () => {
    expect(parseSubscriptionExtras({ promoCode: ' start-10 ', discountPercent: '10', autoRenew: 'false' })).toEqual({
      promoCode: 'START-10',
      discountPercent: 10,
      autoRenew: false,
    });
    expect(parseSubscriptionExtras({})).toEqual({ promoCode: null, discountPercent: null, autoRenew: true });
  });
  it('неверная скидка и промокод: ошибка', () => {
    for (const bad of [{ discountPercent: '101' }, { discountPercent: '-1' }, { discountPercent: '5.5' }, { promoCode: 'с пробелом внутри' }, { promoCode: 'X'.repeat(41) }])
      expect(() => parseSubscriptionExtras(bad)).toThrow();
  });
});

describe('поля расхода', () => {
  it('получатель, проект, документ обрезаются; повторяется да/нет', () => {
    expect(parseExpenseExtras({ payee: ' Hetzner ', project: ' Сервер ', recurring: 'true', document: ' Счёт 17 ' })).toEqual({
      payee: 'Hetzner',
      project: 'Сервер',
      recurring: true,
      documentRef: 'Счёт 17',
    });
    expect(parseExpenseExtras({})).toEqual({ payee: null, project: null, recurring: false, documentRef: null });
  });
});
