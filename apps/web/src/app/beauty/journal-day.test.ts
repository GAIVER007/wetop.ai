import { describe, expect, it } from 'vitest';
import type { BeautyAppointmentRow, BeautyDayColumn } from '../../lib/api';
import { dayMoney, masterLoad, quickAction, shortHour, shortName, tilePayment, upcoming } from './journal-day';

/** Журнал салона, вариант B (владелец 24.10.2026): загрузка мастера, ближайшие, деньги дня, быстрое действие */
const row = (p: Partial<BeautyAppointmentRow>): BeautyAppointmentRow => ({
  id: p.id ?? 'a',
  employeeId: 'm1',
  serviceId: 's',
  serviceName: 'Маникюр',
  customer: { id: 'c', name: 'Алия', phone: null },
  startsAt: '2026-10-24T05:00:00Z',
  endsAt: '2026-10-24T06:00:00Z',
  startMinutes: 600,
  endMinutes: 660,
  status: 'BOOKED',
  next: ['CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'],
  priceMinor: '1000000',
  paidMinor: '0',
  refundedMinor: '0',
  currency: 'KZT',
  notes: null,
  ...p,
});
const col = (p: Partial<BeautyDayColumn>): BeautyDayColumn => ({
  id: 'm1',
  name: 'Айгерим',
  intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
  timeOff: false,
  timeOffReason: null,
  serviceIds: [],
  ...p,
});

describe('загрузка мастера', () => {
  it('занятые минуты от рабочих, отмена и незаезд не считаются', () => {
    const rows = [
      row({ id: '1', startMinutes: 600, endMinutes: 690 }),
      row({ id: '2', startMinutes: 720, endMinutes: 810, status: 'CANCELLED' }),
      row({ id: '3', startMinutes: 840, endMinutes: 900, status: 'NO_SHOW' }),
    ];
    expect(masterLoad(col({}), rows)).toEqual({ count: 1, percent: 17 });
  });
  it('выходной или отсутствие: нет процента', () => {
    expect(masterLoad(col({ intervals: [] }), [])).toEqual({ count: 0, percent: null });
    expect(masterLoad(col({ timeOff: true }), [])).toEqual({ count: 0, percent: null });
  });
  it('процент не больше 100 при наложении записей', () => {
    expect(masterLoad(col({ intervals: [{ timeFrom: '10:00', timeTo: '11:00' }] }), [row({ startMinutes: 540, endMinutes: 720 })]).percent).toBe(100);
  });
});

describe('ближайшие', () => {
  it('записанные и подтверждённые от «сейчас» минус 30 минут, по времени, не больше пяти', () => {
    const rows = [
      row({ id: 'late', startMinutes: 900 }),
      row({ id: 'past', startMinutes: 500 }),
      row({ id: 'conf', startMinutes: 760, status: 'CONFIRMED' }),
      row({ id: 'work', startMinutes: 780, status: 'IN_PROGRESS' }),
      row({ id: 'soon', startMinutes: 740 }),
    ];
    expect(upcoming(rows, 765).map((r) => r.id)).toEqual(['soon', 'conf', 'late']);
    expect(upcoming(Array.from({ length: 9 }, (_, i) => row({ id: String(i), startMinutes: 800 + i })), 765)).toHaveLength(5);
  });
  it('не сегодня: весь день сначала', () => {
    expect(upcoming([row({ id: 'x', startMinutes: 500 })], null).map((r) => r.id)).toEqual(['x']);
  });
});

describe('быстрое действие в «Ближайших»', () => {
  it('подтверждённая: «Пришла» (начать визит); записанная: «Подтвердить»', () => {
    expect(quickAction(row({ status: 'CONFIRMED', next: ['IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED'] }))).toEqual({ to: 'IN_PROGRESS', label: 'Пришла' });
    expect(quickAction(row({}))).toEqual({ to: 'CONFIRMED', label: 'Подтвердить' });
  });
  it('API не разрешает переход: кнопки нет', () => {
    expect(quickAction(row({ status: 'CONFIRMED', next: [] }))).toBeNull();
  });
});

describe('деньги за день', () => {
  it('получено = оплачено минус возвращено; ждём оплату по всем визитам дня, кроме отменённых и «не пришёл»', () => {
    const rows = [
      row({ id: '1', status: 'DONE', priceMinor: '1200000', paidMinor: '1200000' }),
      row({ id: '2', status: 'IN_PROGRESS', priceMinor: '2200000', paidMinor: '500000' }),
      row({ id: '3', status: 'DONE', priceMinor: '800000', paidMinor: '800000', refundedMinor: '200000' }),
      row({ id: '4', status: 'BOOKED', priceMinor: '900000' }),
      row({ id: '5', status: 'CANCELLED', priceMinor: '900000', paidMinor: '0' }),
      row({ id: '6', status: 'NO_SHOW', priceMinor: '500000', paidMinor: '0' }),
    ];
    expect(dayMoney(rows)).toEqual({ received: 2300000n, waiting: 2600000n, currency: 'KZT' });
  });
  it('бонусы и сертификат в «получено» не входят: это не деньги в кассе (paidMinor API их включает)', () => {
    expect(dayMoney([row({ status: 'DONE', priceMinor: '1000000', paidMinor: '1000000', paidLoyaltyMinor: '300000' })])).toEqual({ received: 700000n, waiting: 0n, currency: 'KZT' });
  });
  it('пустой день в валюте филиала, а не в тенге (салон в Катаре видел «0 ₸»)', () => {
    expect(dayMoney([], 'QAR')).toEqual({ received: 0n, waiting: 0n, currency: 'QAR' });
  });
});

describe('shortName: имя мастера в узкой колонке (5+ мастеров)', () => {
  it('имя и первая буква фамилии', () => {
    expect(shortName('Айгерим Сапарова')).toBe('Айгерим С.');
    expect(shortName('  Дина   Ахметова Кызы ')).toBe('Дина А.');
  });
  it('одно слово остаётся как есть', () => {
    expect(shortName('Мадина')).toBe('Мадина');
  });
});

describe('shortHour: часы работы в узкой колонке', () => {
  it('ровный час без минут, иначе как есть', () => {
    expect(shortHour('09:00')).toBe('9');
    expect(shortHour('18:00')).toBe('18');
    expect(shortHour('10:30')).toBe('10:30');
  });
});

describe('оплата на плашке записи: короткое слово, полное в подсказке (владелец 25.10.2026)', () => {
  it('«Оплачено», «Частично», «Долг» по оплате и цене', () => {
    expect(tilePayment(row({ priceMinor: '40000', paidMinor: '40000' }))).toEqual({
      kind: 'paid', word: 'Оплачено', full: 'Оплачено',
    });
    expect(tilePayment(row({ priceMinor: '40000', paidMinor: '10000' }))).toEqual({
      kind: 'partial', word: 'Частично', full: 'Оплачено частично',
    });
    expect(tilePayment(row({ priceMinor: '40000', paidMinor: '0' }))).toEqual({
      kind: 'debt', word: 'Долг', full: 'Не оплачено',
    });
  });
  it('у неявки оплаты на плашке нет; бесплатная запись оплачена', () => {
    expect(tilePayment(row({ status: 'NO_SHOW', priceMinor: '40000', paidMinor: '0' }))).toBeNull();
    expect(tilePayment(row({ priceMinor: '0', paidMinor: '0' }))?.kind).toBe('paid');
  });
});
