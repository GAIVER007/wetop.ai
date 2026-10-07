import { describe, expect, it } from 'vitest';
import {
  CONFIGURABLE_PAYMENT_METHODS,
  DEFAULT_PAYMENT_METHOD_SETTINGS,
  PAYMENT_METHOD_RU,
  assertPaymentMethodEnabled,
  enabledPaymentMethods,
  parsePaymentMethodSettings,
  resolvePaymentMethodSettings,
} from './payment-methods';

describe('способы оплаты объекта (DATA_MODEL §21.6, ADR-152)', () => {
  it('восемь настраиваемых способов, EXTERNAL не настраивается, у каждого есть подпись', () => {
    expect(CONFIGURABLE_PAYMENT_METHODS).toEqual([
      'CASH',
      'CARD_TERMINAL',
      'KASPI',
      'HALYK',
      'BANK_TRANSFER_PERSON',
      'BANK_TRANSFER_LEGAL',
      'DEPOSIT',
      'CARD_GUARANTEE',
    ]);
    expect(CONFIGURABLE_PAYMENT_METHODS).not.toContain('EXTERNAL');
    for (const m of [...CONFIGURABLE_PAYMENT_METHODS, 'EXTERNAL'])
      expect(PAYMENT_METHOD_RU[m], m).toBeTruthy();
    expect(PAYMENT_METHOD_RU['KASPI']).toBe('Kaspi');
    expect(PAYMENT_METHOD_RU['CASH']).toBe('Наличные');
  });

  it('без строк действуют умолчания: все восемь включены в системном порядке', () => {
    expect(resolvePaymentMethodSettings([])).toEqual(DEFAULT_PAYMENT_METHOD_SETTINGS);
    expect(DEFAULT_PAYMENT_METHOD_SETTINGS.every((s) => s.enabled)).toBe(true);
    expect(enabledPaymentMethods(DEFAULT_PAYMENT_METHOD_SETTINGS)).toEqual([
      ...CONFIGURABLE_PAYMENT_METHODS,
    ]);
  });

  it('строки объекта задают порядок и включение; недостающие способы дописываются включёнными, чужие коды отбрасываются', () => {
    const resolved = resolvePaymentMethodSettings([
      { method: 'KASPI', enabled: true, sortOrder: 0 },
      { method: 'CASH', enabled: false, sortOrder: 1 },
      { method: 'EXTERNAL', enabled: true, sortOrder: 2 },
      { method: 'NOPE', enabled: true, sortOrder: 3 },
    ]);
    expect(resolved.map((s) => s.method)).toEqual([
      'KASPI',
      'CASH',
      'CARD_TERMINAL',
      'HALYK',
      'BANK_TRANSFER_PERSON',
      'BANK_TRANSFER_LEGAL',
      'DEPOSIT',
      'CARD_GUARANTEE',
    ]);
    expect(resolved[1]).toEqual({ method: 'CASH', enabled: false });
    expect(enabledPaymentMethods(resolved)).not.toContain('CASH');
    expect(enabledPaymentMethods(resolved)[0]).toBe('KASPI');
  });

  it('разбор: полный список из восьми без повторов, хотя бы один включён', () => {
    const all = CONFIGURABLE_PAYMENT_METHODS.map((method) => ({ method, enabled: true }));
    const ok = parsePaymentMethodSettings({ methods: [...all].reverse() });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value[0]!.method).toBe('CARD_GUARANTEE');

    const none = parsePaymentMethodSettings({
      methods: all.map((s) => ({ ...s, enabled: false })),
    });
    expect(none).toEqual({ ok: false, reason: 'Хотя бы один способ оплаты должен быть включён' });

    const missing = parsePaymentMethodSettings({ methods: all.slice(0, 7) });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.reason).toContain('Гарантия картой');

    const twice = parsePaymentMethodSettings({ methods: [...all, all[0]] });
    expect(twice.ok).toBe(false);
    if (!twice.ok) expect(twice.reason).toContain('дважды');

    const foreign = parsePaymentMethodSettings({
      methods: [...all.slice(0, 7), { method: 'EXTERNAL', enabled: true }],
    });
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.reason).toContain('EXTERNAL');

    expect(parsePaymentMethodSettings(null).ok).toBe(false);
    expect(parsePaymentMethodSettings({ methods: 'CASH' }).ok).toBe(false);
    expect(parsePaymentMethodSettings({ methods: [{ method: 'CASH', enabled: 'yes' }] }).ok).toBe(
      false,
    );
  });

  it('выключенный способ отказывает словами; EXTERNAL и неизвестные коды это не дело этого правила', () => {
    const enabled = ['CASH', 'CARD_TERMINAL'];
    expect(() => assertPaymentMethodEnabled('CASH', enabled)).not.toThrow();
    expect(() => assertPaymentMethodEnabled('KASPI', enabled)).toThrow(
      'Способ оплаты «Kaspi» выключен в настройках объекта',
    );
    expect(() => assertPaymentMethodEnabled('EXTERNAL', enabled)).not.toThrow();
    expect(() => assertPaymentMethodEnabled('NOPE', enabled)).not.toThrow();
  });
});
