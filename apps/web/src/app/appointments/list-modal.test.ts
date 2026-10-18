import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
  useSearchParams: () => new URLSearchParams('date=2026-10-18&appointment=synthetic-appointment'),
}));
vi.mock('../beauty/appointment-editor', () => ({ AppointmentEditor: () => null }));
vi.mock('../beauty/appointment-card', () => ({ AppointmentCard: () => createElement('div', null, 'Synthetic list card') }));
vi.mock('../../components/date-bar', () => ({ DateBar: () => null }));

import { AppointmentsList } from './list';

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

describe('appointments list card modal placement', () => {
  it('renders the selected appointment in a wide centered overlay', () => {
    const html = renderToStaticMarkup(createElement(AppointmentsList, {
      day,
      customers: [],
      readOnly: false,
    }));

    expect(html).toContain('class="ui-overlay  ui-overlay--lg appointment-card-modal"');
    expect(html).toContain('Synthetic list card');
    expect(html).not.toContain('ui-drawer');
  });
});


it('offers a period and shows the local date alongside appointments', () => {
  const html = renderToStaticMarkup(createElement(AppointmentsList, {
    day, customers: [], readOnly: false,
  }));
  expect(html).toContain('Период с');
  expect(html).toContain('Период по');
  expect(html).toContain('Показать период');
  expect(html).not.toContain('Поиск только по выбранному дню');
});
