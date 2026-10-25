import { describe, expect, it } from 'vitest';
import { branchMethodsShown, cashMethodsShown } from './shown';

const ALL = ['CASH', 'CARD_TERMINAL', 'KASPI', 'HALYK', 'BANK_TRANSFER_PERSON', 'BANK_TRANSFER_LEGAL'] as const;

describe('способы в форме приёма денег филиала (§21.7)', () => {
  it('без настройки или без ответа все шесть, как раньше', () => {
    expect(branchMethodsShown(ALL, null)).toEqual([...ALL]);
  });
  it('включённые в порядке настройки, чужие коды отброшены', () => {
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH', 'DEPOSIT'])).toEqual(['KASPI', 'CASH']);
  });
  it('выбранный раньше и выключенный способ остаётся последним, а не подменяется', () => {
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH'], 'HALYK')).toEqual(['KASPI', 'CASH', 'HALYK']);
    expect(branchMethodsShown(ALL, ['KASPI', 'CASH'], 'KASPI')).toEqual(['KASPI', 'CASH']);
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
