import { describe, expect, it } from 'vitest';
import { currencySign } from '../../lib/money';
import { debtsCsv } from './debts-csv';
import { operationsCsv } from './operations-csv';
import { servicesCsv } from './services-csv';
import { reservationsCsv } from '../reservations/reservations-csv';
import type { ReservationListRow } from '../../lib/hotel-api';

/**
 * Валюта объекта в подписях (поручение владельца 20.10.2026: «расходы и т.д. в той валюте, которая выбрана»).
 * Суммы приходят в валюте объекта (`currency` в ответе API), а шапки выгрузок были прибиты к «₸».
 */
describe('выгрузки и поля подписаны валютой объекта, а не всегда тенге', () => {
  it('знак валюты: тенге значком, остальные кодом', () => {
    expect(currencySign('KZT')).toBe('₸');
    expect(currencySign('USD')).toBe('USD');
    expect(currencySign('AED')).toBe('AED');
  });

  it('лента денег в USD: «Сумма, USD»', () => {
    const head = operationsCsv([], 'USD').slice(1).split('\r\n')[0];
    expect(head).toBe('Дата;Время;Тип;Статус;Способ;Сумма, USD;Бронь;Статья;Комментарий');
  });

  it('долги в USD: все денежные колонки в USD', () => {
    const head = debtsCsv([], 'USD').slice(1).split('\r\n')[0]!;
    expect(head).toContain('Начислено, USD;Оплачено, USD;Возвращено, USD;Остаток, USD');
    expect(head).not.toContain('₸');
  });

  it('услуги в USD: «Сумма, USD»', () => {
    expect(servicesCsv([], 'USD').slice(1).split('\r\n')[0]).toBe('Услуга;Группа;Начислений;Штук;Сумма, USD');
  });

  it('без валюты остаётся тенге, как раньше', () => {
    expect(servicesCsv([]).slice(1).split('\r\n')[0]).toBe('Услуга;Группа;Начислений;Штук;Сумма, ₸');
  });

  it('брони в USD: денежные колонки в USD', () => {
    const head = reservationsCsv([] as ReservationListRow[], 'USD').slice(1).split('\r\n')[0]!;
    expect(head).toContain('Сумма, USD;Оплачено, USD;Остаток, USD');
  });
});
