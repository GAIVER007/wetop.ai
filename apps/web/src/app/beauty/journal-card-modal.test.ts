import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/calendar',
}));
vi.mock('./appointment-editor', () => ({ AppointmentEditor: () => null }));
vi.mock('./appointment-card', () => ({ AppointmentCard: () => createElement('div', null, 'Synthetic appointment card') }));
vi.mock('./date-bar', () => ({ DateBar: () => null }));
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

describe('appointment card modal placement', () => {
  it('renders the existing appointment in a wide centered overlay', () => {
    const html = renderToStaticMarkup(createElement(JournalBoard, {
      day,
      customers: [],
      employees: [],
      readOnly: false,
      appointmentId: 'synthetic-appointment',
    }));

    expect(html).toContain('class="ui-overlay  ui-overlay--lg appointment-card-modal"');
    expect(html).toContain('Synthetic appointment card');
    expect(html).not.toContain('ui-drawer');
  });
});


it('offers an accessible compact calendar toggle', () => {
  const html = renderToStaticMarkup(createElement(JournalBoard, {
    day, customers: [], employees: [], readOnly: false,
  }));
  expect(html).toMatch(/aria-pressed="false"[^>]*>Компактный вид/);
});
