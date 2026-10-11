import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyDay, BeautySchedule } from '../../lib/api';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), unstable_rethrow() {} }));
vi.mock('../../components/overlay', () => ({ Overlay: () => null }));
vi.mock('./appointment-form', () => ({ AppointmentForm: () => null }));
vi.mock('./appointment-card', () => ({ AppointmentCard: () => null }));
vi.mock('./date-bar', () => ({ DateBar: () => null }));
vi.mock('./actions', () => ({}));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({}) }));

import { JournalBoard } from './journal';
import { ScheduleBoard } from './schedule/board';
import CustomersPage from '../customers/page';
vi.mock('../../lib/api', () => ({ beautyApi: { customers: async () => ({ items: [] }) } }));
vi.mock('../../lib/vertical-guard', () => ({
  requireVertical: async () => ({ context: { vertical: 'BEAUTY' } }),
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
  it('показывает семь дней графика без мастера', () => {
    const data = {
      employee: null,
      employees: [],
      week: [],
      timeOffs: [],
      locations: [],
      location: null,
    } as BeautySchedule;
    const html = renderToStaticMarkup(createElement(ScheduleBoard, { data, canEdit: true }));
    expect(html).toContain('Понедельник');
    expect(html).toContain('Воскресенье');
    expect(html).toContain('<table');
  });
});
