import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay } from '../../lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/calendar', unstable_rethrow() {} }));
vi.mock('../../components/overlay', () => ({ Overlay: () => null }));
vi.mock('./appointment-form', () => ({ AppointmentForm: () => null }));
vi.mock('./appointment-card', () => ({ AppointmentCard: () => null }));
vi.mock('./date-bar', () => ({ DateBar: () => null }));
vi.mock('./actions', () => ({}));
vi.mock('../customers/actions', () => ({ markBeautyCustomer: vi.fn(), applyBeautyCustomerImport: vi.fn(), createBeautyCustomer: vi.fn(), previewBeautyCustomerImport: vi.fn() }));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({}) }));

import { JournalBoard } from './journal';
import { ScheduleBoard } from './schedule/board';
import CustomersPage from '../customers/page';
vi.mock('../../lib/api', () => ({ beautyApi: { customers: async () => ({ items: [] }) } }));
vi.mock('../../lib/vertical-guard', () => ({
  requireVertical: async () => ({ context: { vertical: 'BEAUTY' } }),
  requireFeature: async () => ({ context: { vertical: 'BEAUTY' } }),
}));

const day = {
  date: '2026-10-11',
  location: {
    id: 'fixture-location',
    name: 'Тестовый салон',
    timezone: 'Asia/Almaty',
    currency: 'KZT',
  },
  bounds: { fromMinutes: 540, toMinutes: 1080 },
  columns: [],
  appointments: [],
  services: [],
} satisfies BeautyDay;

describe('Пустые рабочие экраны салона', () => {
  it('разрешает перенос мышью открытой записи, но запрещает его в режиме чтения', () => {
    const populated = {
      ...day,
      columns: [
        {
          id: 'master',
          name: 'Тестовый мастер',
          intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
          timeOff: false,
          timeOffReason: null,
          serviceIds: ['service'],
        },
      ],
      appointments: [
        {
          id: 'appointment',
          employeeId: 'master',
          serviceId: 'service',
          serviceName: 'Тестовая услуга',
          customer: { id: 'customer', name: 'Тестовый клиент', phone: null },
          startsAt: '2026-10-11T05:00:00Z',
          endsAt: '2026-10-11T06:00:00Z',
          startMinutes: 600,
          endMinutes: 660,
          status: 'BOOKED' as const,
          next: [],
          priceMinor: '800000',
          paidMinor: '0',
          refundedMinor: '0',
          currency: 'KZT',
          notes: null,
        },
      ],
    } satisfies BeautyDay;
    const editable = renderToStaticMarkup(
      createElement(JournalBoard, {
        day: populated,
        customers: [],
        employees: [],
        readOnly: false,
      }),
    );
    expect(editable).toContain('draggable="true"');
    const locked = renderToStaticMarkup(
      createElement(JournalBoard, { day: populated, customers: [], employees: [], readOnly: true }),
    );
    expect(locked).not.toContain('draggable="true"');
  });
  it('показывает часы и сетку без мастеров и услуг, не разрешая запись', () => {
    const html = renderToStaticMarkup(
      createElement(JournalBoard, { day, customers: [], employees: [], readOnly: false }),
    );
    expect(html).toContain('data-testid="beauty-grid"');
    expect(html).toContain('09:00');
    expect(html).toContain('17:30');
    expect(html).toContain('data-testid="beauty-empty-timeline"');
    expect(html).toContain('href="/employees"');
    expect(html).not.toContain('beauty-slot-free');
    expect(html).toMatch(/disabled=""[^>]*>\+ Новая запись/);
  });
  it('сохраняет настоящую колонку мастера без услуг', () => {
    const column = {
      id: 'fixture-master',
      name: 'Тестовый мастер',
      intervals: [],
      timeOff: false,
      timeOffReason: null,
      serviceIds: [],
    };
    const html = renderToStaticMarkup(
      createElement(JournalBoard, {
        day: { ...day, columns: [column] },
        customers: [],
        employees: [],
        readOnly: false,
      }),
    );
    expect(html).toContain('data-testid="beauty-grid"');
    expect(html).toContain('Тестовый мастер');
    expect(html).not.toContain('Пока нечего показывать');
  });
  it('сохраняет заголовки таблицы клиентов без строк', async () => {
    const html = renderToStaticMarkup(await CustomersPage());
    expect(html).toContain('<table');
    expect(html).toContain('Клиент');
  });
  it('показывает семь дней недели в сетке без мастеров', () => {
    const data = { location: null, monday: '2026-10-12', masters: [], elsewhere: 0 };
    const html = renderToStaticMarkup(createElement(ScheduleBoard, { data, canEdit: true }));
    expect(html).toContain('<table');
    expect(html).toContain('12 октября, пн');
    expect(html).toContain('18 октября, вс');
    expect(html).toContain('В этом филиале пока нет специалистов');
  });
});
