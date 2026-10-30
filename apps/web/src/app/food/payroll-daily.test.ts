import { describe, expect, it } from 'vitest';
import { monthEnd, payDateDefault, payScheduleText, paySettingsBody } from './payroll-board';
import { translator } from '../../i18n';

/** Выплаты по дням в «Зарплате» (PAYROLL-DAILY-20261030, владелец 30.10.2026) */
describe('выплаты по дням: окно условий и выплаты', () => {
  const ru = translator('ru');
  const en = translator('en');
  it('частота уходит на сервер, день недели только у недели', () => {
    expect(paySettingsBody('PERCENT', '', '40', 'QAR', ru, { payFrequency: 'DAILY', payWeekday: 3, payMethod: 'CASH' })).toEqual({
      model: 'PERCENT', fixedMinor: 0, percent: 40, payFrequency: 'DAILY', payWeekday: null, payMethod: 'CASH',
    });
    expect(paySettingsBody('PERCENT', '', '40', 'QAR', ru, { payFrequency: 'WEEKLY', payWeekday: 6, payMethod: null })).toMatchObject({
      payFrequency: 'WEEKLY', payWeekday: 6,
    });
    // старые вызовы без частоты: прежнее тело без новых полей
    expect('payFrequency' in paySettingsBody('PERCENT', '', '40', 'QAR', ru)).toBe(false);
  });
  it('подпись частоты на трёх языках', () => {
    expect(payScheduleText(ru, 'DAILY', null)).toBe('Каждый день');
    expect(payScheduleText(ru, 'WEEKLY', 6)).toBe('Раз в неделю, суббота');
    expect(payScheduleText(en, 'WEEKLY', 6)).toBe('Once a week, Saturday');
    expect(payScheduleText(en, 'MONTHLY', null)).toBe('Once a month');
  });
  it('день выплаты по умолчанию: сегодня в текущем месяце, иначе последний день', () => {
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(payDateDefault('2026-10', '2026-10-30')).toBe('2026-10-30');
    expect(payDateDefault('2026-09', '2026-10-30')).toBe('2026-09-30');
  });
});
