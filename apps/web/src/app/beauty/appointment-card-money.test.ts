import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';
import { AppointmentCard } from './appointment-card';

vi.mock('../../components/use-confirm', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));
vi.mock('./journal-actions', () => ({
  moveAppointment: vi.fn(),
  payAppointment: vi.fn(),
  refundAppointment: vi.fn(),
  setAppointmentStatus: vi.fn(),
}));

const row: BeautyAppointmentRow = {
  id: 'synthetic-appointment',
  employeeId: 'synthetic-master',
  serviceId: 'synthetic-service',
  serviceName: 'Synthetic service',
  customer: { id: 'synthetic-customer', name: 'Synthetic Customer', phone: null },
  startsAt: '2026-10-18T10:00:00.000Z',
  endsAt: '2026-10-18T11:00:00.000Z',
  startMinutes: 600,
  endMinutes: 660,
  status: 'DONE',
  next: [],
  priceMinor: '20000',
  paidMinor: '12345',
  refundedMinor: '0',
  currency: 'USD',
  notes: null,
};

const day: BeautyDay = {
  location: { id: 'synthetic-location', name: 'Synthetic Location', timezone: 'UTC', currency: 'USD' },
  date: '2026-10-18',
  columns: [{
    id: 'synthetic-master',
    name: 'Synthetic Master',
    intervals: [],
    timeOff: false,
    timeOffReason: null,
    serviceIds: ['synthetic-service'],
  }],
  appointments: [row],
  services: [],
  bounds: { fromMinutes: 480, toMinutes: 1200 },
};

describe('AppointmentCard money fields', () => {
  it('keeps cents in defaults and labels fields with the appointment currency', () => {
    const html = renderToStaticMarkup(createElement(AppointmentCard, {
      day,
      row,
      canEdit: true,
      canRefund: true,
      onDone: vi.fn(),
    }));

    expect(html).toMatch(/Сумма, USD[\s\S]*value="76\.55"/);
    expect(html).toMatch(/Сумма возврата, USD[\s\S]*value="123\.45"/);
    expect(html.match(/inputMode="decimal"/g)).toHaveLength(2);
    expect(html).not.toContain('Сумма, ₸');
  });
});

describe('AppointmentCard service lines', () => {
  it('shows the stored price, discount, surcharge, master and interval of every line', () => {
    const items = [
      { id: 'line-one', position: 0, employeeId: 'synthetic-master', employeeName: 'First Master', serviceId: 'service-one', serviceName: 'First service', startsAt: row.startsAt, endsAt: '2026-10-18T10:30:00.000Z', startMinutes: 600, endMinutes: 630, durationMinutes: 30, basePriceMinor: '10000', discountMinor: '1000', surchargeMinor: '125', priceMinor: '9125', currency: 'USD', discountPercent: null },
      { id: 'line-two', position: 1, employeeId: 'second-master', employeeName: 'Second Master', serviceId: 'service-two', serviceName: 'Second service', startsAt: '2026-10-18T10:30:00.000Z', endsAt: row.endsAt, startMinutes: 630, endMinutes: 660, durationMinutes: 30, basePriceMinor: '10875', discountMinor: '0', surchargeMinor: '0', priceMinor: '10875', currency: 'USD', discountPercent: null },
    ];
    const html = renderToStaticMarkup(createElement(AppointmentCard, { day, row: { ...row, items }, canEdit: true, onDone: vi.fn() }));
    expect(html).toContain('First service'); expect(html).toContain('Second service');
    expect(html).toContain('First Master'); expect(html).toContain('Second Master');
    expect(html).toContain('Скидка'); expect(html).toContain('Наценка');
    expect(html).toContain('10:00–10:30'); expect(html).toContain('10:30–11:00');
    expect(html).toContain('91,25'); expect(html).toContain('108,75');
  });
});
