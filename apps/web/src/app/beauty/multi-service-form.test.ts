import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
// язык стойки (KK2) читает куку запроса; здесь запроса нет, тексты русские
vi.mock('../../i18n/server', async () => ({ serverT: async () => (await import('../../i18n')).translator('ru'), currentLocale: async () => 'ru' }));
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
  it('аудит салона 22.10.2026: до выбора услуги нет «Стоимость: Проверьте сумму»', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn() }),
    );
    expect(html).not.toContain('Проверьте сумму');
    expect(html).not.toContain('Стоимость:');
  });
  it('пояс филиала словами, без кода вроде Asia/Almaty (живой сайт 21.10.2026, телефон)', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, {
        day: { ...day, location: { ...day.location, timezone: 'Asia/Almaty' } }, // tz-allow: данные теста
        customers: [],
        employeeId: 'master',
        onDone: vi.fn(),
      }),
    );
    expect(html).not.toContain('Asia/Almaty'); // tz-allow: проверка отсутствия кода пояса
    expect(html).toContain('Алматы, UTC+5');
  });
  it('A5: рядом с поиском клиента есть «Гость» и «Последний клиент»', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn() }),
    );
    expect(html).toContain('>Гость<');
    // «Последний клиент» только когда он есть (владелец 26.10.2026: без серых пустых кнопок)
    expect(html).not.toContain('Последний клиент');
  });
  it('клиент одним блоком (владелец 25.10.2026): поиск «Телефон или имя», быстрые кнопки и одна строка нового клиента, без второго выбора «Клиент»', () => {
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn() }),
    );
    const block = html.slice(html.indexOf('appointment-customer-fields'), html.indexOf('appointment-pick'));
    expect(block.match(/>Клиент</g)).toHaveLength(1);
    expect(block).not.toContain('<select');
    expect(block).toContain('type="hidden" name="customerId" value=""');
    // одно поле поиска; имя, фамилия и телефон нового клиента берутся из него скрытыми полями (владелец 26.10.2026)
    expect(block.match(/<input[^>]*type="search"/g)).toHaveLength(1);
    expect(block).toContain('type="hidden" name="firstName"');
    expect(block).toContain('type="hidden" name="lastName"');
    expect(block).toContain('type="hidden" name="phone"');
    expect(block).not.toContain('>Имя клиента<');
    expect(block).not.toContain('>Фамилия<');
    expect(block).not.toContain('Новый клиент<');
  });
  it('повтор записи: выбранный клиент чипом «имя, телефон ×», строки нового клиента нет, id уходит прежним полем', () => {
    const repeatFrom = {
      id: 'visit', serviceId: 'cut', employeeId: 'master', serviceName: 'Test haircut',
      customer: { id: 'c1', name: 'Тестовая Клиентка', phone: '+97451865708' },
      startsAt: '2026-10-18T10:00:00.000Z', endsAt: '2026-10-18T10:30:00.000Z', startMinutes: 600, endMinutes: 630,
      status: 'DONE', next: [], priceMinor: '2500', paidMinor: '2500', refundedMinor: '0', currency: 'USD', notes: null,
    };
    const html = renderToStaticMarkup(
      createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn(), repeatFrom: repeatFrom as never }),
    );
    expect(html).toContain('type="hidden" name="customerId" value="c1"');
    expect(html).toMatch(/data-testid="appointment-customer-chip"[^>]*>Тестовая Клиентка, \+974/);
    expect(html).toContain('aria-label="Убрать клиента: Тестовая Клиентка"');
    expect(html).not.toContain('name="firstName"');
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

// телефон в списке группами «+7 700 000 00 01» (владелец 22.10.2026)
const repeatBase = {
  id: 'visit', serviceId: 'cut', employeeId: 'master', serviceName: 'Test haircut',
  startsAt: '2026-10-18T10:00:00.000Z', endsAt: '2026-10-18T10:30:00.000Z', startMinutes: 600, endMinutes: 630,
  status: 'DONE', next: [], priceMinor: '2500', paidMinor: '2500', refundedMinor: '0', currency: 'USD', notes: null,
};
it('distinguishes clients with equal names by phone in the selection list', () => {
  const customers = ['+77000000001', '+77000000002'].map((phone, index) => ({
    id: `customer-${index}`,
    firstName: 'Тестовый',
    lastName: 'Клиент',
    phone,
    status: 'ACTIVE',
  }));
  // список выбора теперь чип выбранного клиента (ТЗ 25.10.2026, п. 6): тёзки различаются телефоном в чипе
  const chipFor = (id: string) =>
    renderToStaticMarkup(
      createElement(AppointmentForm, {
        day,
        customers: customers as never,
        employeeId: 'master',
        onDone: vi.fn(),
        repeatFrom: { ...repeatBase, customer: { id, name: 'Тестовый Клиент', phone: null } } as never,
      }),
    );
  expect(chipFor('customer-0')).toMatch(/data-testid="appointment-customer-chip"[^>]*>Тестовый Клиент, \+7 700 000 00 01/);
  expect(chipFor('customer-1')).toMatch(/data-testid="appointment-customer-chip"[^>]*>Тестовый Клиент, \+7 700 000 00 02/);
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
  expect(html).toContain('type="hidden" name="customerId" value="repeat-customer"');
  expect(html).toContain('Synthetic Repeat Client');
  expect(html).toContain('value="cut" selected=""');
  expect(html).toContain('Synthetic note');
  expect(html).toContain('>Записать</button>');
  expect(html).not.toContain('name="id"');
  expect(html).not.toContain('name="paidMinor"');
});

/** Выезд на дом (владелец 27.10.2026): галочка в окне записи, адрес появляется только с галочкой */
describe('выезд на дом', () => {
  it('в окне записи галочка «Выезд на дом», поля адреса без галочки нет', () => {
    const html = renderToStaticMarkup(createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn() }));
    expect(html).toContain('Выезд на дом');
    expect(html).toMatch(/type="checkbox"[^>]*name="atHome"|name="atHome"[^>]*type="checkbox"/);
    expect(html).not.toContain('name="homeAddress"');
  });
  it('изменение записи с выездом: галочка стоит, адрес заполнен', () => {
    const source = { id: 'visit', employeeId: 'master', serviceId: 'cut', startsAt: '2026-10-18T10:00:00.000Z', startMinutes: 600, endMinutes: 630, priceMinor: '2500', notes: null, atHome: true, homeAddress: 'West Bay 5' };
    const html = renderToStaticMarkup(createElement(AppointmentForm, { day, customers: [], employeeId: 'master', onDone: vi.fn(), editing: source as never }));
    expect(html).toMatch(/name="atHome"[^>]*checked|checked[^>]*name="atHome"/);
    expect(html).toMatch(/name="homeAddress"[^>]*value="West Bay 5"|value="West Bay 5"[^>]*name="homeAddress"/);
  });
  it('создание передаёт выезд и адрес в API', async () => {
    vi.spyOn(authApi, 'me').mockResolvedValue({ user: { organizationId: 'org' }, context: scope } as never);
    const save = vi.spyOn(beautyApi, 'createAppointment').mockResolvedValue({ appointments: [{ id: 'saved' }] } as never);
    const form = new FormData();
    form.set('scopeKey', JSON.stringify(scope));
    form.set('startsAt', '2026-10-18T10:00:00.000Z');
    form.set('firstName', 'Synthetic');
    form.set('items', JSON.stringify([{ employeeId: 'master', serviceId: 'cut' }]));
    form.set('atHome', 'on');
    form.set('homeAddress', 'West Bay 5');
    expect(await createAppointment(null, form)).toMatchObject({ message: 'Запись создана' });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ atHome: 'on', homeAddress: 'West Bay 5' }));
  });
  it('изменение передаёт выезд всегда: снятая галочка стирает адрес', async () => {
    const save = vi.spyOn(beautyApi, 'moveAppointment').mockResolvedValue({} as never);
    const form = new FormData();
    form.set('id', 'visit');
    form.set('startsAt', '2026-10-18T10:00:00.000Z');
    form.set('items', JSON.stringify([{ employeeId: 'master', serviceId: 'cut' }]));
    await moveAppointment(null, form);
    expect(save).toHaveBeenCalledWith('visit', expect.objectContaining({ atHome: '', homeAddress: '' }));
  });
});
