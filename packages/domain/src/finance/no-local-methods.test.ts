import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRANCH_PAYMENT_METHOD_SETTINGS,
  DEFAULT_PAYMENT_METHOD_SETTINGS,
  enabledPaymentMethods,
  resolveBranchPaymentMethodSettings,
  resolvePaymentMethodSettings,
} from './payment-methods';

/**
 * Без привязки к Казахстану (владелец 27.10.2026: «убери везде каспи халык, не привязывайся к Казахстану»).
 * Kaspi и Halyk без настройки выключены у гостиницы, салона и ресторана. Кто включил их сам, сохраняет: строка в
 * базе главнее умолчания. Деньги, уже принятые так, видны в кассе, пока их не выведут (`cashMethodsShown`).
 */
const LOCAL = ['KASPI', 'HALYK'];

describe('Kaspi и Halyk не включены сами (NO-KZ-METHODS-20261027)', () => {
  it('гостиница без настройки: Kaspi и Halyk выключены, остальные как были', () => {
    const on = enabledPaymentMethods(resolvePaymentMethodSettings([]));
    expect(on).toEqual(['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL', 'DEPOSIT', 'CARD_GUARANTEE']);
    expect(DEFAULT_PAYMENT_METHOD_SETTINGS.filter((s) => LOCAL.includes(s.method)).every((s) => !s.enabled)).toBe(true);
  });
  it('салон и ресторан без настройки: Kaspi, Halyk и «Другое» выключены', () => {
    expect(enabledPaymentMethods(resolveBranchPaymentMethodSettings([]))).toEqual([
      'CASH',
      'CARD_TERMINAL',
      'BANK_TRANSFER_PERSON',
      'BANK_TRANSFER_LEGAL',
    ]);
    expect(DEFAULT_BRANCH_PAYMENT_METHOD_SETTINGS.filter((s) => LOCAL.includes(s.method)).every((s) => !s.enabled)).toBe(true);
  });
  it('кто сам включил Kaspi, у того он остаётся включённым и на своём месте', () => {
    const rows = [
      { method: 'KASPI', enabled: true, sortOrder: 0 },
      { method: 'CASH', enabled: true, sortOrder: 1 },
    ];
    expect(enabledPaymentMethods(resolvePaymentMethodSettings(rows)).slice(0, 2)).toEqual(['KASPI', 'CASH']);
    expect(enabledPaymentMethods(resolveBranchPaymentMethodSettings(rows)).slice(0, 2)).toEqual(['KASPI', 'CASH']);
    // Halyk строки не имеет: выключен
    expect(enabledPaymentMethods(resolvePaymentMethodSettings(rows))).not.toContain('HALYK');
  });
});
