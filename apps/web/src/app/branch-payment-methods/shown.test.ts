import { describe, expect, it } from 'vitest';
import { branchMethodsShown } from './shown';

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
