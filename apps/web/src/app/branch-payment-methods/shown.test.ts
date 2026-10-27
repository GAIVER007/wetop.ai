import { describe, expect, it } from 'vitest';
import { branchMethodsAll, branchMethodsShown, cashMethodsList, cashMethodsShown } from './shown';

const ALL = ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL'] as const;

describe('способы в форме приёма денег филиала (§21.7)', () => {
  it('без настройки или без ответа все, кроме Kaspi и Halyk (NO-KZ-METHODS-20261027)', () => {
    expect(branchMethodsShown(ALL, null)).toEqual(['CASH', 'CARD_TERMINAL', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL']);
    // выбранный раньше Kaspi не теряется
    expect(branchMethodsShown(ALL, null, 'KASPI')).toContain('KASPI');
  });
  it('включённые в порядке настройки, чужие коды отброшены', () => {
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH', 'DEPOSIT'])).toEqual(['KASPI', 'CASH']);
  });
  it('выбранный раньше и выключенный способ остаётся последним, а не подменяется', () => {
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH'], 'HALYK')).toEqual(['KASPI', 'CASH', 'HALYK']);
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH'], 'KASPI')).toEqual(['KASPI', 'CASH']);
  });
  it('«Другое» (PAYMENT-OTHER-20261025): без настройки не показывается, включённое показывается', () => {
    const withOther = [...ALL, 'OTHER'] as const;
    expect(branchMethodsShown(withOther, null)).toEqual(ALL.filter((m) => m !== 'KASPI' && m !== 'HALYK'));
    expect(branchMethodsShown(withOther, ['OTHER', 'CASH'])).toEqual(['OTHER', 'CASH']);
  });
  it('выдача и возврат: «Другое» только включённое или с остатком', () => {
    const withOther = [...ALL, 'OTHER'] as const;
    const base = ALL.filter((m) => m !== 'KASPI' && m !== 'HALYK');
    expect(branchMethodsAll(withOther, null)).toEqual(base);
    expect(branchMethodsAll(withOther, ['CASH', 'OTHER'])).toEqual([...base, 'OTHER']);
    expect(branchMethodsAll(withOther, ['CASH'], ['OTHER'])).toEqual([...base, 'OTHER']);
    // Kaspi включён или по нему остались деньги: выдать и вернуть можно
    expect(branchMethodsAll(withOther, ['KASPI'])).toContain('KASPI');
    expect(branchMethodsAll(withOther, ['CASH'], ['HALYK'])).toContain('HALYK');
  });
});

describe('способы в остатках кассы, сверке и расходе филиала', () => {
  const balances = [
    { method: 'CASH', balanceMinor: '50000' },
    { method: 'KASPI', balanceMinor: '0' },
    { method: 'HALYK', balanceMinor: '1200' },
    { method: 'BANK_TRANSFER_LEGAL', balanceMinor: '0' },
  ];
  it('выключенный способ с нулём не показывается (салону в Катаре не нужен Kaspi с 0)', () => {
    expect(cashMethodsShown(balances, ['CASH', 'BANK_TRANSFER_LEGAL']).map((b) => b.method)).toEqual([
      'CASH',
      'HALYK',
      'BANK_TRANSFER_LEGAL',
    ]);
  });
  it('выключенный способ с деньгами остаётся: деньги не прячем, их можно перевести или потратить', () => {
    expect(cashMethodsShown(balances, ['CASH']).map((b) => b.method)).toContain('HALYK');
  });
});

describe('способы расхода и сверки кассы филиала', () => {
  const balances = [
    { method: 'CASH', balanceMinor: '0' },
    { method: 'HALYK', balanceMinor: '1200' },
  ];
  it('включённые в порядке настройки филиала (Kaspi поднят вверх), затем выключенные с деньгами', () => {
    expect(cashMethodsList(ALL, ['CASH', 'KASPI', 'CARD_TERMINAL', 'BANK_TRANSFER_LEGAL'], balances)).toEqual([
      'CASH',
      'KASPI',
      'CARD_TERMINAL',
      'BANK_TRANSFER_LEGAL',
      'HALYK',
    ]);
  });
  it('выключенный способ с нулём не показывается', () => {
    expect(cashMethodsList(ALL, ['CASH'], [{ method: 'KASPI', balanceMinor: '0' }])).toEqual(['CASH']);
  });
});
