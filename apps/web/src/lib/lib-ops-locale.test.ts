import { describe, expect, it } from 'vitest';
import { translator } from '../i18n';
import { previewLine } from './action-preview';
import { penaltyText } from './penalty-text';
import { waitingFor } from './support-queue';
import { tableTitle } from './table-title';
import { zoneLabel } from './human-period';
import { portalMonthLine } from './portal-month';

/** KK3: шаблонные строки lib собираются через `t`, казахский и английский экраны не видят русских слов */
describe('lib-ops на трёх языках', () => {
  const kk = translator('kk');
  const en = translator('en');
  it('стол, ожидание, пояс', () => {
    expect(tableTitle('7', kk)).toBe('Үстел 7');
    expect(tableTitle('7', en)).toBe('Table 7');
    expect(waitingFor('2026-10-24T10:00:00Z', Date.parse('2026-10-24T12:05:00Z'), en)).toBe('waiting 2 h 5 min');
    expect(zoneLabel('Asia/Almaty', en)).toMatch(/^Almaty/);
  });
  it('месяц сотрудника по-казахски', () => {
    const stats = { month: '2026-10', status: 'AVAILABLE', currency: 'KZT', shifts: 12, daysOff: 3, absenceDays: null, appointmentsDone: null, servicesDone: null, ordersClosed: null, tablesServed: null, guests: null, revenueMinor: null, bonusMinor: null, percent: null } as const;
    expect(portalMonthLine(stats as never, '2026', kk, 'kk')).toBe('Қазан: 12 ауысым, 3 демалыс күні');
  });
  it('деньги: только слова меняются, суммы прежние', () => {
    expect(penaltyText({ totalPenaltyMinor: '500000', items: [] } as never, 'cancel', 'KZT', en)).toMatch(
      /^A 5\s000\s?₸ penalty will stay on the folio$/u,
    );
    const line = previewLine(
      { action: 'extend', currency: 'KZT', currentPriceMinor: '1000000', newPriceMinor: '1500000', differenceMinor: '500000', nights: 2, departureDate: '2026-10-26' },
      en,
      'en',
    );
    expect(line).toMatch(/^New nights — .*The stay will be .*, check-out 26 Oct$/);
  });
});
