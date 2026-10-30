import { describe, expect, it } from 'vitest';
import { riskChange, riskComment } from './journal-risk';

/**
 * «История действий» для контроля краж (владелец 30.10.2026): в строке видно было → стало по деньгам и комментарий
 * сотрудника; где комментария нет, экран прямо пишет «Нет комментария».
 */
describe('строка риска: было → стало', () => {
  it('скидка: цена до и после', () => {
    expect(riskChange({ priceMinor: '50000', currency: 'QAR' }, { priceMinor: '35000', currency: 'QAR' })).toEqual({
      before: '50000',
      after: '35000',
      currency: 'QAR',
    });
  });
  it('возврат и аннулирование: одна сумма со знаком минус', () => {
    expect(riskChange({}, { amountMinor: '30000', currency: 'QAR' })).toEqual({ before: null, after: '-30000', currency: 'QAR' });
    expect(riskChange({ amountMinor: '150050' }, { voided: true })).toEqual({ before: null, after: '-150050', currency: null });
  });
  it('без денег в снимке: ничего', () => {
    expect(riskChange({ status: 'BOOKED' }, { status: 'CANCELLED' })).toBeNull();
  });
});

describe('комментарий сотрудника', () => {
  it('причина или комментарий из снимка, пустое не считается', () => {
    expect(riskComment({}, { reason: '  постоянная клиентка ' })).toBe('постоянная клиентка');
    expect(riskComment({ note: 'перенос' }, {})).toBe('перенос');
    expect(riskComment({}, { reason: '   ' })).toBeNull();
    expect(riskComment({}, {})).toBeNull();
  });
});
