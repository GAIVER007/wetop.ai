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
  // владелец 29.10.2026: период окном как в журнале (готовые периоды слева, календарь, «Применить»),
  // без двух полей дат и «Показать период»; фильтры и «Новая запись» одной строкой
  expect(html).toContain('data-testid="appointments-period"');
  expect(html).toContain('Выберите период');
  expect(html).toContain('Применить');
  expect(html).not.toContain('Показать период');
  expect(html).not.toContain('Период с');
  expect(html).not.toContain('Поиск только по выбранному дню');
  const bar = html.slice(html.indexOf('beauty-list-bar'), html.indexOf('</section>'));
  for (const part of ['appointments-period', 'Все статусы', 'Все специалисты', 'Все услуги', 'Имя или телефон', 'Новая запись'])
    expect(bar).toContain(part);
});

describe('C2 (паритет с zapis.kz): автор и источник в реестре', () => {
  it('показывает колонки «Источник» и «Автор» со словами, а не кодами', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentsList, {
        day: {
          ...day,
          appointments: [{
            ...day.appointments[0],
            source: 'WEBSITE' as const,
            createdByName: 'Тест Админ',
          }],
        } as BeautyDay,
        customers: [],
        readOnly: true,
      }),
    );
    expect(html).toContain('Источник');
    expect(html).toContain('Сайт');
    expect(html).toContain('Автор');
    expect(html).toContain('Тест Админ');
  });
});

describe('аудит 21.10.2026 п.3 и п.19: список записей', () => {
  it('выключенная «Новая запись» всегда объяснена ссылками на услуги и специалистов', () => {
    const html = renderToStaticMarkup(createElement(AppointmentsList, {
      day: { ...day, columns: [], services: [] },
      customers: [],
      readOnly: false,
    }));
    expect(html).toContain('Для новой записи нужны услуги и специалисты');
    expect(html).toContain('href="/services"');
    expect(html).toContain('href="/employees"');
  });
  it('у поиска есть подсказка в поле, служебных строк под ним нет; фильтры в одной карточке', () => {
    const html = renderToStaticMarkup(createElement(AppointmentsList, { day, customers: [], readOnly: false }));
    expect(html).toContain('placeholder="Имя или телефон"');
    expect(html).not.toContain('Поиск по выбранному периоду.');
    expect(html).not.toContain('После перезагрузки поиск клиента очищается.');
    expect(html).not.toContain('Для новой записи нужны');
    const panel = html.slice(html.indexOf('beauty-list-panel'));
    // «Сбросить фильтры» появляется, только когда фильтр выбран (владелец 29.10.2026: без лишних кнопок)
    expect(panel).not.toContain('Сбросить фильтры');
    expect(panel.indexOf('appointments-period')).toBeLessThan(panel.indexOf('</section>'));
  });
});
