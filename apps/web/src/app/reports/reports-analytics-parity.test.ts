import { describe, expect, it } from 'vitest';
import type { BeautyDay } from '../../lib/api';
import { buildSalonReport } from './salon-report-data';
import { beautyPult } from '../management/analytics/vertical/pult';

/**
 * Владелец 27.10.2026: «проверь, что в Отчётах всё чётко бьётся, вся статистика подтягивается ровно и в отчёты, и в
 * аналитику». Одни и те же дни: выручка, визиты, статусы, деньги по мастерам и по услугам совпадают до тиына.
 */
const appt = (
  id: string,
  status: string,
  lines: Array<{ employeeId: string; serviceId: string; serviceName: string; priceMinor: string }>,
  customer = 'c1',
) => ({
  id,
  status,
  currency: 'QAR',
  startsAt: '2026-10-27T08:00:00Z',
  endsAt: '2026-10-27T09:00:00Z',
  startMinutes: 660,
  endMinutes: 720,
  employeeId: lines[0]!.employeeId,
  serviceId: lines[0]!.serviceId,
  serviceName: lines[0]!.serviceName,
  priceMinor: lines.reduce((s, l) => s + BigInt(l.priceMinor), 0n).toString(),
  paidMinor: '0',
  source: 'DESK',
  customer: { id: customer, name: 'Client' },
  items: lines.map((l, i) => ({ ...l, employeeName: l.employeeId === 'm1' ? 'Aina' : 'Dana', startMinutes: 660 + i * 30, endMinutes: 690 + i * 30 })),
  payments: [],
});
const day = (date: string, appointments: unknown[]): BeautyDay =>
  ({
    date,
    location: { id: 'l', timezone: 'Asia/Qatar' },
    columns: [
      { id: 'm1', name: 'Aina', intervals: [{ timeFrom: '10:00', timeTo: '24:00' }], timeOff: null },
      { id: 'm2', name: 'Dana', intervals: [{ timeFrom: '10:00', timeTo: '22:00' }], timeOff: null },
    ],
    appointments,
    services: [],
  }) as unknown as BeautyDay;

const days = [
  day('2026-10-27', [
    appt('a1', 'DONE', [{ employeeId: 'm1', serviceId: 's1', serviceName: 'Lashes', priceMinor: '35000' }]),
    appt('a2', 'DONE', [
      { employeeId: 'm1', serviceId: 's2', serviceName: 'Brows', priceMinor: '12000' },
      { employeeId: 'm2', serviceId: 's3', serviceName: 'Nails', priceMinor: '18050' },
    ], 'c2'),
    appt('a3', 'NO_SHOW', [{ employeeId: 'm2', serviceId: 's3', serviceName: 'Nails', priceMinor: '18050' }]),
    appt('a4', 'CANCELLED', [{ employeeId: 'm1', serviceId: 's1', serviceName: 'Lashes', priceMinor: '35000' }]),
  ]),
  day('2026-10-28', [
    appt('a5', 'DONE', [{ employeeId: 'm2', serviceId: 's3', serviceName: 'Nails', priceMinor: '18050' }], 'c1'),
    appt('a6', 'BOOKED', [{ employeeId: 'm1', serviceId: 's1', serviceName: 'Lashes', priceMinor: '35000' }]),
  ]),
];

describe('«Отчёты» и «Аналитика» салона считают одно и то же', () => {
  const report = buildSalonReport(days);
  const pult = beautyPult(days, 'QAR');
  it('выручка и визиты', () => {
    expect(report.currencies).toEqual([{ currency: 'QAR', visits: 3, costMinor: '83100' }]);
    expect(pult.revenueMinor).toBe('83100');
    expect(pult.visits).toBe(3);
  });
  it('статусы записей', () => {
    for (const k of ['BOOKED', 'DONE', 'NO_SHOW', 'CANCELLED'] as const) expect(pult.counts[k]).toBe(report.counts[k]);
  });
  it('деньги и визиты по мастерам', () => {
    const fromReport = Object.fromEntries(report.masters.map((m) => [m.id, [m.costMinor, m.visits]]));
    const fromPult = Object.fromEntries(pult.masters.map((m) => [m.id, [m.revenueMinor, m.visits]]));
    expect(fromPult).toEqual(fromReport);
    expect(fromReport).toEqual({ m1: ['47000', 2], m2: ['36100', 2] });
  });
  it('деньги по услугам', () => {
    const fromReport = Object.fromEntries(report.services.map((s) => [s.name, s.costMinor]));
    const fromPult = Object.fromEntries(pult.services.map((s) => [s.name, s.revenueMinor]));
    expect(fromPult).toEqual(fromReport);
  });
  it('сумма по мастерам и по услугам равна выручке', () => {
    const sum = (xs: string[]) => xs.reduce((a, b) => a + BigInt(b), 0n).toString();
    expect(sum(report.masters.map((m) => m.costMinor))).toBe('83100');
    expect(sum(report.services.map((s) => s.costMinor))).toBe('83100');
    expect(sum(pult.byDay.map((d) => d.revenueMinor))).toBe('83100');
  });
});
