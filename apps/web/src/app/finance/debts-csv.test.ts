import { describe, expect, it } from 'vitest';
import { debtsCsv } from './debts-csv';

const row = {
  confirmationNumber: '20260913-TEST1',
  status: 'CONFIRMED',
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-08',
  guestLabel: 'Вымышленный Гость',
  chargedMinor: '2400000',
  paidMinor: '100050',
  refundedMinor: '50',
  balanceMinor: '2300000',
  overdue: false,
};

describe('debtsCsv', () => {
  it('шапка, BOM, CRLF и «;» — как у выгрузки операций; имён гостей в файле нет', () => {
    const csv = debtsCsv([row]);
    expect(csv.startsWith('﻿')).toBe(true);
    const [head, line] = csv.split('\r\n');
    expect(head).toBe(
      '﻿Бронь;Статус;Заезд;Выезд;Ночей;Начислено, ₸;Оплачено, ₸;Возвращено, ₸;Остаток, ₸;Просрочено',
    );
    expect(line).toBe(
      '20260913-TEST1;Подтверждена;05.10.2026;08.10.2026;3;24000,00;1000,50;0,50;23000,00;',
    );
    expect(csv).not.toContain('Вымышленный');
  });

  it('просроченный долг отмечен словом «да»', () => {
    const csv = debtsCsv([{ ...row, overdue: true }]);
    expect(csv.split('\r\n')[1]).toMatch(/;да$/);
  });

  it('поле с «;» берётся в кавычки', () => {
    const csv = debtsCsv([{ ...row, confirmationNumber: 'A;B' }]);
    expect(csv.split('\r\n')[1]!.startsWith('"A;B"')).toBe(true);
  });
});
