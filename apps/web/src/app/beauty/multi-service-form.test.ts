import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi, beautyApi, type BeautyDay } from '../../lib/api';
import { AppointmentForm, appointmentLineDefaults } from './appointment-form';
import { createAppointment, moveAppointment } from './journal-actions';
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
afterEach(() => vi.restoreAllMocks());
const scope = { organizationId: 'org', businessId: 'business', locationId: 'location' };
const day: BeautyDay = {
  date: '2026-10-18',
  location: { id: 'location', name: 'Test salon', timezone: 'UTC', currency: 'USD' },
  columns: [
    {
      id: 'master',
      name: 'Test Master',
      intervals: [{ timeFrom: '09:00', timeTo: '18:00' }],
      timeOff: false,
      timeOffReason: null,
      serviceIds: ['cut'],
    },
  ],
  appointments: [],
  services: [
    {
      id: 'cut',
      name: 'Test haircut',
      category: null,
      sellable: true,
      durationMinutes: 30,
      priceMinor: '2500',
      currency: 'USD',
    },
  ],
  bounds: { fromMinutes: 540, toMinutes: 1080 },
};
describe('report A1 A2 A3 A5: appointment form contract', () => {
  it('offers a line list, duration and one client search rather than a single fixed service', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn() }),
    );
    expect(html).toContain('Добавить услугу');
    expect(html).toContain('Часы услуги 1');
    expect(html).toContain('Минуты услуги 1');
    expect(html).toContain('Телефон или имя');
    expect(html).toContain('Итого');
  });
  it('A3: итог показывает суммарную длительность визита по строкам', () => {
    const editing = {
      id: 'visit',
      serviceId: 'cut',
      employeeId: 'master',
      serviceName: 'Test haircut',
      customer: { id: 'c1', name: 'Клиент', phone: null },
      startsAt: '2026-10-18T10:00:00.000Z',
      endsAt: '2026-10-18T11:15:00.000Z',
      startMinutes: 600,
      endMinutes: 675,
      status: 'BOOKED',
      next: [],
      priceMinor: '5000',
      paidMinor: '0',
      refundedMinor: '0',
      currency: 'USD',
      notes: null,
      items: [
        {
          id: 'l1', position: 0, employeeId: 'master', employeeName: 'Test Master',
          serviceId: 'cut', serviceName: 'Test haircut',
          startsAt: '2026-10-18T10:00:00.000Z', endsAt: '2026-10-18T10:30:00.000Z',
          startMinutes: 600, endMinutes: 630, durationMinutes: 30,
          basePriceMinor: '2500', discountMinor: '0', discountPercent: null,
          surchargeMinor: '0', priceMinor: '2500',
        },
        {
          id: 'l2', position: 1, employeeId: 'master', employeeName: 'Test Master',
          serviceId: 'cut', serviceName: 'Test haircut',
          startsAt: '2026-10-18T10:30:00.000Z', endsAt: '2026-10-18T11:15:00.000Z',
          startMinutes: 630, endMinutes: 675, durationMinutes: 45,
          basePriceMinor: '2500', discountMinor: '0', discountPercent: null,
          surchargeMinor: '0', priceMinor: '2500',
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, {
        day, customers: [], employeeId: 'master', onDone: vi.fn(),
        editing: editing as never,
      }),
    );
    expect(html).toContain('1 ч 15 мин');
  });
  it('sends all ordered service lines with exact money, not only legacy serviceId', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({
      user: { organizationId: 'org' },
      context: scope,
    } as never);
    const save = vi
      .spyOn(beautyApi, 'createAppointment')
      .mockResolvedValue({ appointments: [{ id: 'saved' }] } as never);
    const items = [
      { employeeId: 'master', serviceId: 'cut', durationMinutes: 30 },
      {
        employeeId: 'master2',
        serviceId: 'colour',
        durationMinutes: 60,
        basePriceMinor: '5000',
        discountPercent: 10,
        surchargeMinor: '125',
      },
    ];
    const form = new FormData();
    form.set('scopeKey', JSON.stringify(scope));
    form.set('startsAt', '2026-10-18T10:00:00.000Z');
    form.set('firstName', 'Synthetic');
    form.set('items', JSON.stringify(items));
    expect(await createAppointment(null, form)).toMatchObject({ message: 'Запись создана' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ items }));
  });
  it('rejects an invalid service list locally without issuing a create request', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({
      user: { organizationId: 'org' },
      context: scope,
    } as never);
    const save = vi
      .spyOn(beautyApi, 'createAppointment')
      .mockResolvedValue({ appointments: [{ id: 'saved' }] } as never);
    const form = new FormData();
    form.set('scopeKey', JSON.stringify(scope));
    form.set('items', '{broken');
    expect(await createAppointment(null, form)).toMatchObject({ outcome: 'rejected' });
    expect(save).not.toHaveBeenCalled();
  });
});

it('sends edited service lines and notes without collapsing the visit to its first service', async () => {
  const save = vi.spyOn(beautyApi, 'moveAppointment').mockResolvedValue({} as never);
  const items = [
    {
      employeeId: 'master',
      serviceId: 'cut',
      durationMinutes: 45,
      basePriceMinor: '2500',
      discountMinor: '125',
    },
  ];
  const form = new FormData();
  form.set('id', 'visit');
  form.set('startsAt', '2026-10-18T10:00:00.000Z');
  form.set('items', JSON.stringify(items));
  form.set('notes', 'Synthetic note');
  expect(await moveAppointment(null, form)).toMatchObject({ message: 'Запись перенесена' });
  expect(save).toHaveBeenCalledWith(
    'visit',
    expect.objectContaining({ items, notes: 'Synthetic note' }),
  );
});

it('requires an explicit final price for a range or unpriced master service', () => {
  for (const priceType of ['RANGE', 'UNFIXED'] as const) {
    const pricedDay: BeautyDay = {
      ...day,
      services: [
        {
          ...day.services[0]!,
          masterPrices: [
            {
              employeeId: 'master',
              priceType,
              priceMinMinor: priceType === 'RANGE' ? '1500' : null,
              priceMaxMinor: priceType === 'RANGE' ? '3500' : null,
              durationMinutes: 45,
              currency: 'USD',
              source: 'MASTER',
              revision: 1,
            },
          ],
        },
      ],
    };
    expect(appointmentLineDefaults(pricedDay, 'cut', 'master')).toMatchObject({
      price: null,
      duration: 45,
    });
  }
});

it('offers percent or amount discounts inside each service adjustment disclosure', () => {
  const html = renderToStaticMarkup(
    createElement(AppointmentForm, {
      day,
      customers: [],
      employeeId: 'master',
      onDone: vi.fn(),
      canAdjustPrice: true,
    }),
  );
  expect(html).toContain('Тип скидки');
  expect(html).toContain('Процент');
  expect(html).toContain('Скидка и доплата');
});

it('offers separate hours and five-minute steps while retaining a legacy non-step duration', () => {
  const preciseDay: BeautyDay = {
    ...day,
    services: [{ ...day.services[0]!, durationMinutes: 47 }],
  };
  const html = renderToStaticMarkup(
    createElement(AppointmentForm, {
      day: preciseDay,
      customers: [],
      employeeId: 'master',
      onDone: vi.fn(),
      canAdjustPrice: true,
      editing: {
        id: 'visit',
        serviceId: 'cut',
        employeeId: 'master',
        startsAt: '2026-10-18T10:00:00Z',
        startMinutes: 600,
        endMinutes: 647,
        priceMinor: '2500',
        notes: null,
      } as never,
    }),
  );
  expect(html).toContain('Часы услуги 1');
  expect(html).toContain('Минуты услуги 1');
  expect(html).toContain('value="45"');
  expect(html).toContain('value="47" selected');
});

it('distinguishes clients with equal names by phone in the selection list', () => {
  const customers = ['+77000000001', '+77000000002'].map((phone, index) => ({
    id: `customer-${index}`,
    firstName: 'Тестовый',
    lastName: 'Клиент',
    phone,
    status: 'ACTIVE',
  }));
  const html = renderToStaticMarkup(
    createElement(AppointmentForm, {
      day,
      customers: customers as never,
      employeeId: 'master',
      onDone: vi.fn(),
    }),
  );
  expect(html).toContain('Тестовый Клиент, +77000000001');
  expect(html).toContain('Тестовый Клиент, +77000000002');
});

it('repeats a visit as a new draft with the same client and services, never the source id or payment', () => {
  const repeatFrom: import('../../lib/api').BeautyAppointmentRow = {
    id: 'original-paid-visit',
    employeeId: 'master',
    serviceId: 'cut',
    serviceName: 'Test haircut',
    customer: { id: 'repeat-customer', name: 'Synthetic Repeat Client', phone: '+77000000111' },
    startsAt: '2026-10-17T10:00:00.000Z',
    endsAt: '2026-10-17T10:30:00.000Z',
    startMinutes: 600,
    endMinutes: 630,
    status: 'DONE',
    next: [],
    priceMinor: '2500',
    paidMinor: '2500',
    refundedMinor: '0',
    currency: 'USD',
    notes: 'Synthetic note',
  };
  const html = renderToStaticMarkup(
    createElement(AppointmentForm, {
      day,
      customers: [],
      employeeId: 'master',
      onDone: vi.fn(),
      canAdjustPrice: true,
      ...{ repeatFrom },
    }),
  );
  expect(html).toContain('value="repeat-customer" selected=""');
  expect(html).toContain('Synthetic Repeat Client');
  expect(html).toContain('value="cut" selected=""');
  expect(html).toContain('Synthetic note');
  expect(html).toContain('>Записать</button>');
  expect(html).not.toContain('name="id"');
  expect(html).not.toContain('name="paidMinor"');
});
