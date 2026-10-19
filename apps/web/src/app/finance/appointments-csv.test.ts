import { describe, expect, it } from 'vitest';
import type { BeautyDay } from '../../lib/api';
import { appointmentsCsv } from './appointments-csv';

const row = (over: Partial<BeautyDay['appointments'][number]>) =>
  ({
    id: 'a1',
    employeeId: 'e1',
    serviceId: 's',
    serviceName: 'Стрижка',
    customer: { id: 'c', name: 'Анна Клиентова', phone: '+7 701 000 00 00' },
    startsAt: '2026-10-14T05:00:00.000Z',
    endsAt: '2026-10-14T06:00:00.000Z',
    startMinutes: 600,
    endMinutes: 660,
    status: 'DONE',
    next: [],
    priceMinor: '800000',
    paidMinor: '800000',
    refundedMinor: '30000',
    currency: 'KZT',
    notes: null,
    ...over,
  }) as BeautyDay['appointments'][number];
const day = (date: string, appointments: BeautyDay['appointments'], timezone = 'Asia/Almaty') =>
  ({
    location: { id: 'salon-location', name: 'Тестовый салон', timezone, currency: 'KZT' },
    date,
    columns: [{ id: 'e1', name: '=Мастер Дина' }],
    appointments,
  }) as unknown as BeautyDay;

describe('выгрузка записей салона (Q-BS-6)', () => {
  it('строки по записям, суммы для Excel, без имени и телефона клиента, формулы обезврежены', () => {
    const csv = appointmentsCsv([
      day('2026-10-14', [
        row({}),
        row({
          id: 'a2',
          startMinutes: 690,
          status: 'CANCELLED',
          paidMinor: '0',
          refundedMinor: '0',
        }),
      ]),
    ]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Дата;Время;Мастер;Услуга;Статус;Валюта;Цена;Оплачено;Возвращено');
    expect(lines[1]).toBe(
      "14.10.2026;10:00;'=Мастер Дина;Стрижка;Завершена;KZT;8000,00;8000,00;300,00",
    );
    expect(lines[2]).toBe("14.10.2026;11:30;'=Мастер Дина;Стрижка;Отменена;KZT;8000,00;0,00;0,00");
    expect(csv).not.toContain('Анна');
    expect(csv).not.toContain('701');
  });
});

it('exports each visit currency and all service/master names without relabelling USD as tenge', () => {
  const usd = row({ currency: 'USD', priceMinor: '12345', paidMinor: '5000', refundedMinor: '0' });
  usd.items = [
    { serviceName: 'Стрижка', employeeName: 'Тест мастер А' },
    { serviceName: 'Укладка', employeeName: 'Тест мастер Б' },
  ] as NonNullable<typeof usd.items>;
  const csv = appointmentsCsv([day('2026-10-14', [usd, row({ id: 'kzt' })])]);
  expect(csv.split('\r\n')[0]).toBe(
    '\uFEFFДата;Время;Мастер;Услуга;Статус;Валюта;Цена;Оплачено;Возвращено',
  );
  expect(csv).toContain(
    'Тест мастер А, Тест мастер Б;Стрижка, Укладка;Завершена;USD;123,45;50,00;0,00',
  );
  expect(csv).toContain(';KZT;8000,00;8000,00;300,00');
  expect(csv).not.toContain('₸');
});

it('attributes a cross-midnight visit once to its local start day, not each overlapping day', () => {
  const visit = row({
    startsAt: '2026-10-14T18:30:00.000Z', // 23:30 in the salon, not UTC midnight.
    endsAt: '2026-10-14T19:30:00.000Z',
    startMinutes: 1410,
    endMinutes: 1470,
    priceMinor: '12345',
    paidMinor: '10000',
    refundedMinor: '2000',
  });
  const first = day('2026-10-14', [visit]);
  const tail = day('2026-10-15', [{ ...visit, startMinutes: -30, endMinutes: 30 }]);
  const csv = appointmentsCsv([tail, first]);
  expect(csv.split('\r\n')).toEqual([
    '\uFEFFДата;Время;Мастер;Услуга;Статус;Валюта;Цена;Оплачено;Возвращено',
    "14.10.2026;23:30;'=Мастер Дина;Стрижка;Завершена;KZT;123,45;100,00;20,00",
  ]);
  expect(first.appointments).toHaveLength(1);
  expect(tail.appointments).toHaveLength(1);
});

it('does not export prior-period tails even when the start day was not requested', () => {
  const csv = appointmentsCsv([
    day('2026-10-15', [row({
      startsAt: '2026-10-14T18:30:00.000Z',
      endsAt: '2026-10-14T19:30:00.000Z',
      startMinutes: -30,
      endMinutes: 30,
    })]),
  ]);
  expect(csv.split('\r\n')).toHaveLength(1);
});

it('uses the branch timezone, not UTC or the server calendar date, for start attribution', () => {
  const visit = row({
    startsAt: '2026-10-15T06:30:00.000Z', // 23:30 on October14 in Los Angeles.
    endsAt: '2026-10-15T07:30:00.000Z',
    startMinutes: 1410,
    endMinutes: 1470,
    currency: 'USD',
  });
  const csv = appointmentsCsv([
    day('2026-10-14', [visit], 'America/Los_Angeles'),
    day('2026-10-15', [{ ...visit, startMinutes: -30 }], 'America/Los_Angeles'),
  ]);
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('14.10.2026;23:30;');
  expect(csv).not.toContain('15.10.2026;');
  expect(csv).toContain(';USD;8000,00;8000,00;300,00');
});

it('exports one visit once even if the same day response or appointment is repeated', () => {
  const a = row({});
  const sameDay = day('2026-10-14', [a, { ...a }]);
  expect(appointmentsCsv([sameDay, sameDay]).split('\r\n')).toHaveLength(2);
});
