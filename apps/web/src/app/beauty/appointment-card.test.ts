import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';

vi.mock('./journal-actions', () => ({
  moveAppointment: vi.fn(), payAppointment: vi.fn(), refundAppointment: vi.fn(), setAppointmentStatus: vi.fn(),
}));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
import { AppointmentCard } from './appointment-card';

const row: BeautyAppointmentRow = {
  id: 'appointment', employeeId: 'employee', serviceId: 'service', serviceName: 'Тестовая услуга',
  customer: { id: 'customer', name: 'Тестовый клиент', phone: null },
  startsAt: '2026-10-18T13:00:00Z', endsAt: '2026-10-18T14:00:00Z', startMinutes: 1080, endMinutes: 1140,
  status: 'BOOKED', next: ['CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'], priceMinor: '0', paidMinor: '0',
  refundedMinor: '0', currency: 'KZT', notes: null,
};
const day: BeautyDay = {
  location: { id: 'location', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  date: '2026-10-18', columns: [], appointments: [row], services: [], bounds: { fromMinutes: 480, toMinutes: 1200 },
};
const render = (appointment = row, canEdit = true) => renderToStaticMarkup(createElement(AppointmentCard, {
  day, row: appointment, canEdit, onDone() {},
}));

describe('Пояснение недоступной неявки', () => {
  const renderSplit = (appointment: BeautyAppointmentRow, canUpdate: boolean, canEdit?: boolean) =>
    renderToStaticMarkup(createElement(AppointmentCard, {
      day, row: appointment, canUpdate, ...(canEdit === undefined ? {} : { canEdit }), canCreate: true, canPay: true, onDone() {},
    }));

  it.each(['BOOKED', 'CONFIRMED'] as const)('объясняет будущий %s с canUpdate без legacy canEdit', (status) => {
    const html = renderSplit({ ...row, status }, true);
    expect(html).toContain('Не пришёл: Можно после начала визита');
    expect(html).not.toMatch(/<button[^>]*>Не пришёл<\/button>/);
  });
  it('не подменяет canUpdate правами создания, оплаты или legacy canEdit', () => {
    expect(renderSplit(row, false)).not.toContain('Можно после начала визита');
    expect(renderSplit(row, false, true)).not.toContain('Можно после начала визита');
  });
  it('с canUpdate скрывает пояснение при разрешённой неявке и в конечном состоянии', () => {
    const allowed = renderSplit({ ...row, next: [...row.next, 'NO_SHOW'] }, true);
    expect(allowed).not.toContain('Можно после начала визита');
    expect(allowed).toMatch(/<button[^>]*>Не пришёл<\/button>/);
    expect(renderSplit({ ...row, status: 'DONE', next: [] }, true)).not.toContain('Можно после начала визита');
  });
  it('объясняет серверный запрет и не рисует кнопку преждевременной неявки', () => {
    const html = render();
    expect(html).toContain('Можно после начала визита');
    expect(html).not.toMatch(/<button[^>]*>Не пришёл<\/button>/);
  });
  it('не показывает пояснение, когда сервер разрешил неявку', () => {
    expect(render({ ...row, next: [...row.next, 'NO_SHOW'] })).not.toContain('Можно после начала визита');
  });
  it('не показывает ограничение для завершённого визита или режима чтения', () => {
    expect(render({ ...row, status: 'DONE', next: [] })).not.toContain('Можно после начала визита');
    expect(render(row, false)).not.toContain('Можно после начала визита');
  });
});
