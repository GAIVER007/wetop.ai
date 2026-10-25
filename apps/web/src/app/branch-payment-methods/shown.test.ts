import { describe, expect, it } from 'vitest';
import { branchMethodsAll, branchMethodsShown } from './shown';

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
  it('«Другое» (PAYMENT-OTHER-20261025): без настройки не показывается, включённое показывается', () => {
    const withOther = [...ALL, 'OTHER'] as const;
    expect(branchMethodsShown(withOther, null)).toEqual([...ALL]);
    expect(branchMethodsShown(withOther, ['OTHER', 'CASH'])).toEqual(['OTHER', 'CASH']);
  });
  it('выдача и возврат: «Другое» только включённое или с остатком', () => {
    const withOther = [...ALL, 'OTHER'] as const;
    expect(branchMethodsAll(withOther, null)).toEqual([...ALL]);
    expect(branchMethodsAll(withOther, ['CASH', 'OTHER'])).toEqual([...withOther]);
    expect(branchMethodsAll(withOther, ['CASH'], ['OTHER'])).toEqual([...withOther]);
  });
});
