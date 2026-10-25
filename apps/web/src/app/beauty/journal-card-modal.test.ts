import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh() {}, replace() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/calendar',
}));
vi.mock('./appointment-editor', () => ({
  AppointmentEditor: ({ open, employeeId }: { open: boolean; employeeId: string }) =>
    open ? createElement('div', { 'data-testid': 'synthetic-new-form', 'data-employee': employeeId }) : null,
}));
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

it('аудит 22.10.2026: «Новая запись» из карточки мастера открывает форму к этому мастеру', () => {
  const html = renderToStaticMarkup(createElement(JournalBoard, {
    day, customers: [], employees: [], readOnly: false, newFor: 'synthetic-master',
  }));
  expect(html).toContain('data-testid="synthetic-new-form" data-employee="synthetic-master"');
  const closed = renderToStaticMarkup(createElement(JournalBoard, {
    day, customers: [], employees: [], readOnly: false, newFor: 'unknown-master',
  }));
  expect(closed).not.toContain('synthetic-new-form');
});

it('плашка записи (владелец 25.10.2026): время и клиент сверху, услуга своей строкой, цена и оплата значком', () => {
  const html = renderToStaticMarkup(createElement(JournalBoard, {
    day: { ...day, appointments: [{ ...day.appointments[0]!, paidMinor: '2500' }] },
    customers: [], employees: [], readOnly: false,
  }));
  const tile = html.slice(html.indexOf('class="beauty-tile beauty-tile--booked"'));
  expect(tile).toMatch(/beauty-tile-top"><span class="beauty-tile-time">10:00–11:00<\/span><strong class="beauty-tile-name">Synthetic Customer<\/strong>/);
  expect(tile).toContain('<span class="beauty-tile-service">Synthetic service</span>');
  expect(tile).toMatch(/class="beauty-tile-pay beauty-tile-pay--partial" title="Оплачено частично"[^>]*><span class="beauty-tile-dot" aria-hidden="true"><\/span>Частично</);
  expect(tile).not.toContain('Не опл.');
});
