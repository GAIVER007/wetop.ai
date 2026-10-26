import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay } from '../../lib/api';

let activeQuery = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(activeQuery),
  usePathname: () => '/calendar',
}));
vi.mock('./appointment-editor', () => ({ AppointmentEditor: () => null }));
vi.mock('./appointment-card', () => ({ AppointmentCard: () => createElement('div', null, 'Synthetic appointment card') }));
vi.mock('../../components/day-nav', () => ({ DayNav: () => null }));
vi.mock('./journal-actions', () => ({ moveAppointment: vi.fn(), beautyPeriodRows: vi.fn() }));
vi.mock('../../components/quick-report', () => ({ QuickReport: () => null }));

import { JournalBoard } from './journal';

const day = {
  location: { id: 'synthetic-location', name: 'Synthetic salon', timezone: 'UTC', currency: 'USD' },
  date: '2026-10-18',
  columns: [{
    id: 'synthetic-master', name: 'Synthetic master', intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
    timeOff: false, timeOffReason: null, serviceIds: ['synthetic-service'],
  }],
  appointments: [{
    id: 'synthetic-appointment', employeeId: 'synthetic-master', serviceId: 'synthetic-service',
    serviceName: 'Synthetic service', customer: { id: 'synthetic-customer', name: 'Synthetic Customer', phone: null },
    startsAt: '2026-10-18T10:00:00.000Z', endsAt: '2026-10-18T11:00:00.000Z',
    startMinutes: 600, endMinutes: 660, status: 'BOOKED' as const, next: [],
    priceMinor: '10000', paidMinor: '0', refundedMinor: '0', currency: 'USD', notes: null,
  }],
  services: [{
    id: 'synthetic-service', name: 'Synthetic service', category: null, sellable: true,
    durationMinutes: 60, priceMinor: '10000', currency: 'USD',
  }],
  bounds: { fromMinutes: 540, toMinutes: 1080 },
} satisfies BeautyDay;


import { MonthCalendar } from './month-calendar';
describe('multi-service occupancy', () => {
  const multi: BeautyDay = {
    ...day,
    columns: [...day.columns, { ...day.columns[0]!, id: 'second-master', name: 'Second master' }],
    appointments: [{ ...day.appointments[0]!, items: [
      { id: 'line-one', position: 0, employeeId: 'synthetic-master', employeeName: 'Synthetic master', serviceId: 'synthetic-service', serviceName: 'First service', startsAt: '2026-10-18T10:00:00.000Z', endsAt: '2026-10-18T10:30:00.000Z', startMinutes: 600, endMinutes: 630, durationMinutes: 30, basePriceMinor: '5000', discountMinor: '0', surchargeMinor: '0', priceMinor: '5000', currency: 'USD', discountPercent: null },
      { id: 'line-two', position: 1, employeeId: 'second-master', employeeName: 'Second master', serviceId: 'second-service', serviceName: 'Second service', startsAt: '2026-10-18T10:30:00.000Z', endsAt: '2026-10-18T11:00:00.000Z', startMinutes: 630, endMinutes: 660, durationMinutes: 30, basePriceMinor: '5000', discountMinor: '0', surchargeMinor: '0', priceMinor: '5000', currency: 'USD', discountPercent: null },
    ] }],
  };
  it('shows each master occupied only for their service segment', () => {
    const html = renderToStaticMarkup(createElement(JournalBoard, { day: multi, customers: [], employees: [], readOnly: false }));
    expect(html).toContain('Synthetic master, 10:30, свободно');
    expect(html).not.toContain('Second master, 10:30, свободно');
    expect(html).toContain('First service');
    expect(html).toContain('Second service');
  });
  it('counts the visit for a secondary master filter', () => {
    activeQuery = 'employee=second-master';
    try {
      const html = renderToStaticMarkup(createElement(JournalBoard, { day: multi, customers: [], employees: [], readOnly: false }));
      expect(html).toContain('Записей: 1');
    } finally { activeQuery = ''; }
  });
  it('shows every service and master in the month without duplicating the visit', () => {
    const rows = multi.appointments.map((a) => ({ ...a, localDate: multi.date }));
    const html = renderToStaticMarkup(createElement(MonthCalendar, { day: multi, rows, selectedDate: multi.date, employees: [] }));
    expect(html).toContain('First service');
    expect(html).toContain('Second service');
    expect(html.match(/appointment=synthetic-appointment/g)).toHaveLength(1);
  });
});
