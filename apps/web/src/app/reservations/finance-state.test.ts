import { describe, expect, it } from 'vitest';
import { financeState } from './finance-state';

const row = (over: Partial<Parameters<typeof financeState>[0]>) => ({
  hasFolios: true,
  paidMinor: '0',
  balanceMinor: '0',
  chargedMinor: '0',
  refundedMinor: '0',
  ...over,
});

describe('колонка «Финансы» (ADR-106): состояние по счетам, без выдумок на фронте', () => {
  it('брони без счетов и пустой счёт — «—», а не «оплачено» (случай отменённой брони из ТЗ §16)', () => {
    expect(financeState(row({ hasFolios: false }))).toEqual({ kind: 'none' });
    expect(financeState(row({}))).toEqual({ kind: 'none' });
  });
  it('начислено и не оплачено ни тиына — «не оплачено»', () => {
    expect(financeState(row({ chargedMinor: '800000', balanceMinor: '800000' }))).toEqual({
      kind: 'unpaid',
    });
  });
  it('частичная оплата — «к оплате остаток»', () => {
    expect(
      financeState(row({ chargedMinor: '1200000', paidMinor: '400000', balanceMinor: '800000' })),
    ).toEqual({ kind: 'due', minor: 800000n });
  });
  it('баланс нулевой при живой оплате — «оплачено», и когда возврат покрыл лишь переплату — тоже', () => {
    expect(
      financeState(row({ chargedMinor: '800000', paidMinor: '800000', balanceMinor: '0' })),
    ).toEqual({ kind: 'paid' });
    expect(
      financeState(
        row({
          chargedMinor: '800000',
          paidMinor: '1000000',
          refundedMinor: '200000',
          balanceMinor: '0',
        }),
      ),
    ).toEqual({ kind: 'paid' });
  });
  it('платёж остался после сторно начислений — «к возврату» на сумму переплаты', () => {
    expect(financeState(row({ paidMinor: '800000', balanceMinor: '-800000' }))).toEqual({
      kind: 'refund-due',
      minor: 800000n,
    });
  });
  it('начислений нет и возврат сделан — «возвращено»', () => {
    expect(
      financeState(row({ paidMinor: '800000', refundedMinor: '800000', balanceMinor: '0' })),
    ).toEqual({ kind: 'refunded' });
  });
  it('старый API без chargedMinor/refundedMinor: поведение считается из баланса и оплаты', () => {
    expect(
      financeState({ hasFolios: true, paidMinor: '800000', balanceMinor: '0' }),
    ).toEqual({ kind: 'paid' });
    expect(financeState({ hasFolios: true, paidMinor: '0', balanceMinor: '0' })).toEqual({
      kind: 'none',
    });
    expect(financeState({ hasFolios: true, paidMinor: '0', balanceMinor: '500000' })).toEqual({
      kind: 'unpaid',
    });
  });
  it('деньги — BigInt из строк тиынов, суммы за пределами Number не теряются (ADR-008)', () => {
    expect(
      financeState(
        row({
          chargedMinor: '9007199254740999',
          paidMinor: '1',
          balanceMinor: '9007199254740998',
        }),
      ),
    ).toEqual({ kind: 'due', minor: 9007199254740998n });
  });
});
