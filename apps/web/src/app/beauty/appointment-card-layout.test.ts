import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyAppointmentRow, BeautyDay } from '../../lib/api';

vi.mock('./journal-actions', () => ({
  moveAppointment: vi.fn(), payAppointment: vi.fn(), refundAppointment: vi.fn(), setAppointmentStatus: vi.fn(),
  customerBonusQuote: vi.fn(), lookupCertificate: vi.fn(),
}));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));
import { AppointmentCard } from './appointment-card';

const row: BeautyAppointmentRow = {
  id: 'appointment', employeeId: 'employee', serviceId: 'service', serviceName: 'Тестовая услуга',
  customer: { id: 'customer', name: 'Тестовый клиент', phone: '+77000000000' },
  startsAt: '2026-10-21T05:30:00Z', endsAt: '2026-10-21T06:30:00Z', startMinutes: 630, endMinutes: 690,
  status: 'BOOKED', next: ['CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED'], priceMinor: '800000', paidMinor: '300000',
  refundedMinor: '0', currency: 'KZT', notes: null,
};
const day: BeautyDay = {
  location: { id: 'location', name: 'Тестовый салон', timezone: 'Asia/Almaty', currency: 'KZT' },
  date: '2026-10-21',
  columns: [{ id: 'employee', name: 'Тестовый мастер', intervals: [], timeOff: false, timeOffReason: null, serviceIds: [] }],
  appointments: [row], services: [], bounds: { fromMinutes: 480, toMinutes: 1200 },
};
const render = (appointment = row) => renderToStaticMarkup(createElement(AppointmentCard, {
  day, row: appointment, canUpdate: true, canCreate: true, canPay: true, canAdjustPrice: true,
  scopeKey: JSON.stringify({ organizationId: 'org', businessId: 'business', locationId: 'location' }), onDone() {},
}));

describe('ТЗ 25.10.2026 п.8: карточка записи на один экран', () => {
  it('шапка: имя клиента, телефон ссылкой tel:, значок состояния', () => {
    const html = render();
    const head = html.slice(html.indexOf('class="appointment-card-head"'), html.indexOf('appointment-card-summary"'));
    expect(head).toContain('Тестовый клиент');
    expect(head).toMatch(/<a [^>]*href="tel:\+77000000000"/);
    expect(head).toMatch(/data-testid="beauty-card-status"[^>]*>Записан</);
  });
  it('сводка: услуга, мастер, дата и время по-человечески, оплачено и остаток', () => {
    const html = render();
    const summary = html.slice(html.indexOf('appointment-card-summary"'), html.indexOf('</dl>'));
    expect(summary).toContain('Тестовая услуга');
    expect(summary).toContain('Тестовый мастер');
    expect(summary).toContain('21 октября, 10:30–11:30');
    expect(summary).not.toContain('2026-10-21');
    expect(summary).toContain('data-testid="beauty-card-paid">3 000 ₸ из 8 000 ₸');
    expect(summary).toMatch(/Осталось<\/dt><dd[^>]*>5 000 ₸/);
  });
  it('действия строкой: следующий шаг главной кнопкой, отмена опасной, прочее в «Ещё»', () => {
    const html = render();
    const bar = html.slice(html.indexOf('class="beauty-bar appointment-card-actions"'));
    expect(bar).toMatch(/<button[^>]*class="btn btn--sm"[^>]*>Подтвердить</);
    expect(bar).toMatch(/<button[^>]*class="btn btn--danger btn--sm"[^>]*>Отменить запись</);
    const more = bar.slice(bar.indexOf('<details class="appointment-card-more"'), bar.indexOf('</details>'));
    expect(more).toMatch(/<summary[^>]*>Ещё<\/summary>/);
    expect(more).toContain('История изменений');
    expect(more).toContain('Повторить запись');
    expect(more).toContain('Изменить услуги');
  });
  it('оплата отдельной колонкой рядом со сводкой', () => {
    const html = render();
    const side = html.slice(html.indexOf('class="appointment-card-side"'));
    expect(html.indexOf('class="appointment-card-main"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="appointment-card-main"')).toBeLessThan(html.indexOf('class="appointment-card-side"'));
    expect(side).toContain('aria-label="Оплата записи"');
    expect(side).toContain('Принять оплату');
  });
});
