import { describe, expect, it } from 'vitest';
import {
  BRANCH_PAYMENT_METHODS,
  DEFAULT_BRANCH_PAYMENT_METHOD_SETTINGS,
  assertBranchPaymentMethodEnabled,
  enabledPaymentMethods,
  parseBranchPaymentMethodSettings,
  resolveBranchPaymentMethodSettings,
} from './payment-methods';
import { FOOD_PAYMENT_METHODS } from '../food/cash';

/**
 * Способы оплаты филиала салона и ресторана (DATA_MODEL §21.7, решение владельца 23.10.2026): те же правила, что
 * у объекта гостиницы (§21.6), но список шести денежных способов кассы филиала (§35), без депозита и гарантии картой.
 */
describe('способы оплаты филиала (§21.7)', () => {
  it('шесть способов кассы филиала, тот же порядок, что FOOD_PAYMENT_METHODS', () => {
    expect([...BRANCH_PAYMENT_METHODS]).toEqual([...FOOD_PAYMENT_METHODS]);
    expect(BRANCH_PAYMENT_METHODS).not.toContain('DEPOSIT');
    expect(BRANCH_PAYMENT_METHODS).not.toContain('CARD_GUARANTEE');
  });

  it('без строк все шесть включены: после выкладки у филиалов ничего не меняется', () => {
    expect(resolveBranchPaymentMethodSettings([])).toEqual(DEFAULT_BRANCH_PAYMENT_METHOD_SETTINGS);
    expect(enabledPaymentMethods(resolveBranchPaymentMethodSettings([]))).toEqual([...BRANCH_PAYMENT_METHODS]);
  });

  it('строки задают порядок и включение; гостиничные DEPOSIT и CARD_GUARANTEE отбрасываются', () => {
    const r = resolveBranchPaymentMethodSettings([
      { method: 'KASPI', enabled: true, sortOrder: 0 },
      { method: 'CASH', enabled: false, sortOrder: 1 },
      { method: 'DEPOSIT', enabled: true, sortOrder: 2 },
    ]);
    expect(r.map((s) => s.method)).toEqual([
      'KASPI',
      'CASH',
      'CARD_TERMINAL',
      'HALYK',
      'BANK_TRANSFER_PERSON',
      'BANK_TRANSFER_LEGAL',
    ]);
    expect(enabledPaymentMethods(r)).not.toContain('CASH');
  });

  it('разбор: все шесть ровно по разу, хотя бы один включён, лишний гостиничный способ отклоняется', () => {
    const all = BRANCH_PAYMENT_METHODS.map((method) => ({ method, enabled: method !== 'HALYK' }));
    const ok = parseBranchPaymentMethodSettings({ methods: all });
    expect(ok.ok && ok.value.find((m) => m.method === 'HALYK')?.enabled).toBe(false);
    expect(parseBranchPaymentMethodSettings({ methods: all.slice(1) })).toEqual({
      ok: false,
      reason: 'В списке не хватает: Наличные',
    });
    expect(
      parseBranchPaymentMethodSettings({ methods: [...all, { method: 'DEPOSIT', enabled: true }] }),
    ).toEqual({ ok: false, reason: 'Неизвестный способ оплаты: DEPOSIT' });
    expect(
      parseBranchPaymentMethodSettings({ methods: all.map((m) => ({ ...m, enabled: false })) }),
    ).toEqual({ ok: false, reason: 'Хотя бы один способ оплаты должен быть включён' });
  });

  it('выключенный способ не принимает денег, текст про филиал; коды вне списка не дело правила', () => {
    expect(() => assertBranchPaymentMethodEnabled('KASPI', ['CASH'])).toThrow(
      'Способ оплаты «Kaspi» выключен в настройках филиала',
    );
    expect(() => assertBranchPaymentMethodEnabled('CASH', ['CASH'])).not.toThrow();
    expect(() => assertBranchPaymentMethodEnabled('BONUS', ['CASH'])).not.toThrow();
    expect(() => assertBranchPaymentMethodEnabled('GIFT_CERTIFICATE', ['CASH'])).not.toThrow();
  });
});
