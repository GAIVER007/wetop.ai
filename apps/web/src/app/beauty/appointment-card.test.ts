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
  day, row: appointment, canEdit, scopeKey: JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' }), onDone() {},
}));

describe('Пояснение недоступной неявки', () => {
  it('объясняет серверный запрет и не рисует кнопку преждевременной неявки', () => {
    const html = render();
    expect(html).toContain('Можно после начала визита');
    expect(html).not.toMatch(/<button[^>]*>Не пришёл<\/button>/);
  });
  it('не показывает пояснение, когда сервер разрешил неявку', () => {
    expect(render({ ...row, next: [...row.next, 'NO_SHOW'] })).not.toContain('Можно после начала визита');
  });
  it('журнал передаёт право изменения как canUpdate, без canEdit: пояснение всё равно видно', () => {
    const html = renderToStaticMarkup(createElement(AppointmentCard, {
      day, row, canUpdate: true, canCreate: true, canPay: true,
      scopeKey: JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' }), onDone() {},
    }));
    expect(html).toContain('Можно после начала визита');
  });
  it('не показывает ограничение для завершённого визита или режима чтения', () => {
    expect(render({ ...row, status: 'DONE', next: [] })).not.toContain('Можно после начала визита');
    expect(render(row, false)).not.toContain('Можно после начала визита');
  });
});

describe('аудит салона 22.10.2026: цена один раз, бонусы только при балансе', () => {
  const priced = { ...row, priceMinor: '800000' };
  const count = (html: string, text: string) => html.split(text).length - 1;
  it('одна услуга: цена видна один раз, в строке «Оплачено»', () => {
    const html = render(priced);
    expect(count(html, '8 000')).toBe(1);
    expect(html).toContain('data-testid="beauty-card-paid">0 ₸ из 8 000 ₸');
  });
  it('запись из одной строки услуги: без повторов цены', () => {
    const html = render({
      ...priced,
      items: [{
        id: 'line', serviceId: 'service', serviceName: 'Тестовая услуга', employeeId: 'employee', employeeName: 'Мастер',
        startMinutes: 1080, endMinutes: 1140, durationMinutes: 60, basePriceMinor: '800000', discountMinor: '0',
        surchargeMinor: '0', priceMinor: '800000', currency: 'KZT',
      }],
    } as BeautyAppointmentRow);
    expect(count(html, '8 000')).toBe(1);
  });
  it('способ «Бонусы» не предлагается, пока не известно, что бонусы есть', () => {
    const html = renderToStaticMarkup(createElement(AppointmentCard, {
      day, row: priced, canUpdate: true, canPay: true,
      scopeKey: JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' }), onDone() {},
    }));
    expect(html).toContain('Оплата записи');
    expect(html).not.toContain('value="BONUS"');
  });
});

describe('выезд на дом в карточке записи (владелец 27.10.2026)', () => {
  it('запись с выездом: строка «Выезд на дом» с адресом', () => {
    const html = render({ ...row, atHome: true, homeAddress: 'West Bay 5' });
    expect(html).toContain('Выезд на дом');
    expect(html).toContain('West Bay 5');
  });
  it('обычная запись: строки выезда нет', () => {
    expect(render()).not.toContain('Выезд на дом');
  });
});
