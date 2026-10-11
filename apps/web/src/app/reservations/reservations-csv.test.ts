import { describe, expect, it } from 'vitest';
import { reservationsCsv } from './reservations-csv';

const row = {
  confirmationNumber: '20260913-TEST1',
  status: 'CONFIRMED',
  source: 'OTA',
  channel: 'Booking.com',
  arrivalDate: '2026-10-05',
  departureDate: '2026-10-08',
  currency: 'KZT',
  totalAmountMinor: '2400000',
  paidMinor: '100050',
  balanceMinor: '2299950',
  chargedMinor: '2400000',
  refundedMinor: '0',
  hasFolios: true,
  unitCodes: ['R01', 'R02'],
  itemsCount: 2,
  primaryGuest: {
    id: 'g1',
    label: 'Вымышленный Гость',
    phone: '+77010000000',
    email: 'x@example.invalid',
  },
};

describe('reservationsCsv (H11, ADR-144)', () => {
  it('шапка, BOM, CRLF и «;», как у выгрузок финансов; имён и контактов гостей в файле нет', () => {
    const csv = reservationsCsv([row]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [head, line] = csv.split('\r\n');
    expect(head).toBe(
      '\uFEFFБронь;Статус;Источник;Канал;Заезд;Выезд;Ночей;Размещений;Места;Сумма, ₸;Оплачено, ₸;Остаток, ₸',
    );
    expect(line).toBe(
      '20260913-TEST1;Подтверждена;Канал продаж;Booking.com;05.10.2026;08.10.2026;3;2;R01 R02;24000,00;1000,50;22999,50',
    );
    expect(csv).not.toContain('Вымышленный');
    expect(csv).not.toContain('+7701');
    expect(csv).not.toContain('example.invalid');
  });
  it('пустой список — только шапка', () => {
    expect(reservationsCsv([]).split('\r\n')).toHaveLength(1);
  });
});
